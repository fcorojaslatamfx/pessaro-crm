# Sincronizar el calendario de Thunderbird con el CRM

> **Estado:** propuesta. Nada de esto está implementado todavía.
> **Fecha:** 2026-08-18
> **Proyecto Supabase:** `ldlflxujrjihiybrcree` · **CRM:** `crm.pessaro.cl`
> **Decisión pendiente de aprobación:** ver §10.

---

## 1. Qué se quiere y qué no

Que lo que el asesor tiene agendado en el CRM —seguimientos, tareas con fecha y
reuniones— aparezca en el calendario de Thunderbird sin copiarlo a mano, y que
se mantenga al día solo.

Lo que **no** se plantea aquí es reemplazar el módulo de Tareas del CRM ni
convertir Thunderbird en la herramienta donde se gestiona la cartera. El CRM
sigue siendo el sistema de registro; Thunderbird, una ventana de lectura sobre
él.

## 2. Qué del CRM tiene fecha y merece ir al calendario

Todo esto ya existe en la base, sin campos nuevos:

| Origen | Campo con la fecha | Qué sería en el calendario |
|---|---|---|
| `crm_tasks` | `due_date` (date), `reminder_at` (timestamptz) | Tarea (`VTODO`) o evento de día completo |
| `crm_contacts` | `next_followup_at` (timestamptz) | Evento «Seguimiento: Ana Pérez» |
| `crm_doc_salas` | `meeting_at` (timestamptz) | Evento de la reunión, con enlace a la sala |
| `whatsapp_campaigns` | `scheduled_at` (timestamptz) | Opcional: cuándo sale una campaña programada |

Cada asesor debe ver **sólo lo suyo**: sus tareas (`assigned_to`), sus contactos
(`user_id`) y las salas que él creó. El super admin, lo de todos.

## 3. Las dos vías técnicas, y cuál conviene

Thunderbird trae el calendario integrado (antes «Lightning») desde la versión
60. Admite dos formas de hablar con un servidor:

### 3.1 Suscripción a un ICS remoto — **la recomendada**

Thunderbird pide por HTTPS un archivo `.ics` cada N minutos y lo pinta. Es
**sólo lectura**: lo que se cree en Thunderbird no vuelve al CRM.

- A favor: se resuelve con **una edge function** que devuelve texto. No hay
  estado, ni sesión, ni sincronización que pueda quedar a medias.
- En contra: unidireccional, y el refresco no es instantáneo (minutos).

### 3.2 Servidor CalDAV — potente y caro

Permitiría crear y editar eventos desde Thunderbird y que aparecieran en el CRM.
Exige implementar `PROPFIND`, `REPORT`, `MKCALENDAR`, gestión de `ETag`,
control de concurrencia y el manejo de recurrencias. Es un proyecto en sí mismo,
y la parte de recurrencias e invitaciones es donde se rompen casi todas las
implementaciones caseras.

**Recomendación:** empezar por ICS (§3.1). Cubre el 90 % del valor —ver la
agenda del CRM en Thunderbird— con una fracción del trabajo. CalDAV sólo si más
adelante se quiere de verdad agendar desde Thunderbird.

## 4. Arquitectura propuesta

```
Thunderbird ──GET /functions/v1/calendario_ics?token=xxxx──▶ Edge Function
                                                                  │
                                                                  ▼
                                                   crm_tasks · crm_contacts
                                                   crm_doc_salas (service role)
                                                                  │
              ◀──────────── text/calendar (VCALENDAR) ────────────┘
```

- Edge function **pública** (`verify_jwt = false`), igual que `support_otp` y
  `documento_acceso`: Thunderbird no sabe autenticarse contra Supabase.
- La credencial es un **token por asesor** en la URL. Es lo único que
  Thunderbird sabe transportar en una suscripción ICS.
- Sólo `GET`, sólo lectura, y siempre acotado a los datos de ese asesor.

## 5. Modelo de datos

Una tabla nueva, mínima:

```sql
CREATE TABLE crm_calendar_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,          -- para detectar uso raro o feeds olvidados
  revoked_at   timestamptz           -- revocar sin borrar, para auditoría
);
```

RLS: cada asesor ve y revoca **su** token; el super admin, todos. La edge
function lee con service role, así que no pasa por RLS.

## 6. El feed ICS

Cabeceras de respuesta:

```
Content-Type: text/calendar; charset=utf-8
Cache-Control: private, max-age=300
```

Cuerpo:

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Pessaro Capital//CRM//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Pessaro CRM — Francisco Rojas
X-WR-TIMEZONE:America/Santiago
REFRESH-INTERVAL;VALUE=DURATION:PT15M
X-PUBLISHED-TTL:PT15M
BEGIN:VEVENT
UID:seguimiento-<contact_id>@crm.pessaro.cl
DTSTAMP:20260818T210000Z
DTSTART:20260820T140000Z
DTEND:20260820T143000Z
SUMMARY:Seguimiento · Ana Pérez
DESCRIPTION:Etapa: Propuesta\nTeléfono: 56912345678
URL:https://crm.pessaro.cl/?contacto=<contact_id>
SEQUENCE:3
STATUS:CONFIRMED
CATEGORIES:CRM,Seguimiento
END:VEVENT
END:VCALENDAR
```

Cuatro detalles que deciden si esto funciona o da guerra:

1. **`UID` estable por registro** (`tarea-<id>@crm.pessaro.cl`). Si el UID
   cambia entre refrescos, Thunderbird no actualiza el evento: crea uno nuevo y
   el calendario se llena de duplicados.
2. **`SEQUENCE` derivado de `updated_at`**, para que un evento editado se
   reemplace en vez de convivir con su versión vieja.
3. **Todo en UTC con sufijo `Z`.** Evita tener que emitir un bloque `VTIMEZONE`
   correcto para Chile, que cambia de horario dos veces al año. Thunderbird lo
   muestra en la zona del usuario.
4. **Escapado y plegado del texto.** En ICS hay que escapar `\`, `;`, `,` y los
   saltos de línea, y plegar las líneas de más de 75 octetos. Un nombre con
   coma —«Pérez, Ana»— rompe el archivo entero si no se escapa.

Las tareas sin hora (`due_date` es `date`) van como evento de día completo
(`DTSTART;VALUE=DATE:20260820`) o como `VTODO`, que Thunderbird muestra en su
panel de Tareas. Las tareas ya cerradas (`done = true`) se omiten, salvo las de
los últimos 7 días, para que el calendario no mienta sobre lo que pasó.

## 7. Seguridad: el token *es* la credencial

Hay que decirlo sin adornos: **quien tenga esa URL ve la agenda de ese asesor**.
Thunderbird la guarda en claro en su configuración y la manda en cada refresco.

Por eso:

- Token largo (24 bytes), aleatorio, **revocable** desde el CRM y regenerable.
- El feed expone **sólo** lo del dueño del token. Nunca acepta un parámetro que
  diga de quién son los datos.
- `last_used_at` en cada petición: un feed que nadie usa hace meses es un token
  que sobra, y uno que se consulta desde donde no debería es una señal.
- No se incluyen en el feed datos que no hagan falta para reconocer la cita:
  nombre, etapa y teléfono bastan; ahí no van notas internas ni montos.
- Nunca se usa la anon key ni la service role key en la URL.

## 8. Cómo lo configura el asesor

En el CRM (módulo Tareas o el perfil del asesor): botón **«Conectar mi
calendario»** que muestra la URL, la copia al portapapeles y ofrece
**«Revocar y generar otra»**.

En Thunderbird:

1. **Calendario → Archivo → Nuevo → Calendario…**
2. **En la red** → *Siguiente*
3. Formato **iCalendar (ICS)**, pegar la URL, marcar *sólo lectura*
4. Nombre y color → *Finalizar*
5. En las propiedades del calendario, bajar el refresco a 15 minutos

## 9. Ganancia rápida e independiente: `.ics` adjunto en las invitaciones

Sin nada de lo anterior, el correo de invitación de una **sala de documentos**
(`documento_acceso → send_invites`) puede llevar adjunto un `.ics` con
`METHOD:REQUEST` y la fecha de `crm_doc_salas.meeting_at`. El invitado pulsa el
adjunto y la reunión entra en su calendario —Thunderbird, Outlook, Google o el
que use— sin que tengamos que sincronizar nada.

Son unas 30 líneas en una función que ya existe, y sirve para los **clientes**,
no sólo para el equipo. Se puede hacer antes o después del feed; no dependen
entre sí.

## 10. Decisiones pendientes

1. **¿Qué entra en el feed?** Propongo empezar con tareas y seguimientos
   (`next_followup_at`), dejando fuera las campañas programadas: son ruido en
   una agenda personal.
2. **¿Un calendario o varios?** Un solo feed mezcla tareas y reuniones. La
   alternativa es publicar dos URLs (`?tipo=tareas`, `?tipo=reuniones`) para que
   cada una sea un calendario con su color en Thunderbird.
3. **¿Tareas como `VTODO` o como evento de día completo?** `VTODO` es más
   correcto y aparece en el panel de Tareas; el evento se ve en la rejilla del
   día, que es donde la gente mira.
4. **¿Sólo asesores o también el super admin con todo el equipo?** Un feed con
   la agenda de todos puede ser útil para coordinar, pero es mucho dato en un
   archivo que vive en un cliente de correo.

## 11. Esfuerzo

| Pieza | Tamaño |
|---|---|
| Migración `crm_calendar_tokens` + RLS | pequeña |
| Edge function `calendario_ics` | mediana (el ICS bien formado es el grueso) |
| Botón «Conectar mi calendario» + revocar | pequeña |
| `.ics` adjunto en invitaciones (§9) | pequeña, independiente |

Una tanda de trabajo, comparable a la de las salas de documentos pero sin
frontend público.
