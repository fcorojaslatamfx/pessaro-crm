# Pessaro Capital CRM — Changelog

**Repo hermano:** `pessarocl` (`C:\Users\fcoro\documents\pessarocl`, sitio público y portal de clientes) tiene su propio registro histórico en `HISTORICO.md` — no se fusiona con este archivo porque describe trabajo de otro repo, pero comparte el mismo proyecto Supabase. Ver `SUPABASE_COMPARTIDO.md` (duplicado literal en ambos repos) para lo que cruza a los dos.

## [2026-08-14] — El análisis del CRM volvía a fecharse un día antes que el portal

### Síntoma

El desplegable del **Análisis Diario** del CRM mostraba `13-08-2026 · hoy` mientras el portal de clientes, leyendo **las mismas filas**, fechaba `14 de agosto · hoy`. El rótulo se contradecía a sí mismo: el `· hoy` sale de comparar la cadena cruda contra el día local, y esa comparación sí daba `2026-08-14`.

### Causa

`fmtDate()` hacía `new Date('2026-08-14')`. Una fecha suelta —sin hora— la parsea JavaScript como **medianoche UTC**; al pintarla en hora de Chile (UTC−4) retrocede a las 20:00 del día anterior. Todas las columnas de tipo `date` salían un día atrás.

No era un problema de datos ni del planificador: BTC 62.874, ETH 1.872,24, NAS100 732,07 y SPX500 777,88 coincidían en CRM y portal. Sólo estaba mal la etiqueta.

Es el **mismo error, en la otra mitad del recorrido** que el arreglo del 2026-08-13: allí se corrigió cómo se *calcula* el día (`toISOString()` → horario local); aquí, cómo se *muestra*.

### Cambios

- `fmtDate()` arma los días de calendario (`YYYY-MM-DD`) en horario local y deja intactas las marcas `timestamptz`, que sí deben convertirse a la zona del usuario. Corrige de paso **fecha de nacimiento**, **fecha de movimiento** y **fecha límite de tareas**, que son columnas `date` y venían mostrándose un día antes.
- `fd()`, el formateador de la ficha exportada a HTML/PDF, recibe el mismo arreglo: sin él la ficha habría quedado contradiciendo a la pantalla en nacimiento, apertura de cuenta y fechas de movimiento.
- Comprobado con `TZ=America/Santiago`: `'2026-08-14'` pasa de `13-08-2026` a `14-08-2026`, y `'2026-08-14T13:04:00Z'` sigue dando `14-08-2026`.

### Regla para no repetirlo

> Una columna `date` es un **día de calendario**, no un instante. Nunca pasa por `new Date(cadena)` sin hora, ni por `toISOString()`. Vale igual para el CRM y para el portal (`pessaro_CL`), que muestran la misma tabla: ver `ANALISIS_DIARIO_INSTRUMENTOS.md` §8.

### Pendiente detectado ese día

El 2026-08-14 sólo se publicaron **5 de los 9 instrumentos** (BTC/USD, ETH/USD, NAS100, SPX500, WTI/USD). Los cuatro que faltan —EUR/USD, GBP/USD, USD/JPY y XAU/USD— son **exactamente los cuatro de Twelve Data**; el día anterior salieron los nueve. El cron corrió y terminó bien (`analisis-diario-instrumentos`, 12:00 UTC, `succeeded`), así que apunta al proveedor de datos, no al planificador. Queda por revisar la cuota/respuesta de Twelve Data.

---

## [2026-08-13 · segunda parte] — Análisis diario, artículos con fuentes citadas, KPIs de ventas y dos fallos silenciosos

Todo esto es posterior al commit de documentación de ese día, así que no estaba recogido aquí.

### Análisis diario de instrumentos

- 9 instrumentos (divisas, metales, energía, índices y cripto) analizados cada mañana y publicados en el **portal de clientes** y en el **panel del asesor**. No se envía por WhatsApp ni por ningún otro canal push.
- **Los números no los inventa el modelo:** soporte, resistencia, tendencia y precio de referencia los calcula el código sobre series de precios reales; `claude-opus-5` sólo redacta las dos narrativas. Un instrumento que no pasa **todas** las validaciones no se publica.
- **Dos tablas, no una.** RLS es row-level, no column-level: una sola tabla con `SELECT` para `authenticated` habría dado a los clientes del portal —que autentican contra este mismo proyecto— la lectura técnica interna. Por eso `analisis_instrumentos` (pública para autenticados) y `analisis_instrumentos_staff` (sólo `is_crm_staff()`).
- Aviso de carácter educativo **obligatorio por esquema** (`NOT NULL` + CHECK de longitud): no se puede insertar un análisis sin él.
- Edge function `generar-analisis-diario` + pg_cron `analisis-diario-instrumentos` (`0 12 * * *` UTC). Detalle completo en `ANALISIS_DIARIO_INSTRUMENTOS.md`.

### Artículos exclusivos automatizados con fuentes citadas

- Los 4 artículos del portal eran la siembra de marzo de 2026: firmados por analistas que **no son personas del equipo**, con referencias de hace cinco meses y con la columna `content` que el portal nunca renderizaba. La migración los despublica.
- Mismo reparto de trabajo que el análisis diario: **las fuentes las trae el código, no el modelo.** La función lee feeds RSS reales, extrae titular, medio, URL y fecha, y guarda esos registros tal como vienen. Al modelo se le pasan como material y sólo redacta el comentario propio. Un modelo al que se le pide «cita a Bloomberg» produce URLs plausibles pero inventadas, y una referencia falsa publicada a clientes de una firma de asesoría es peor que no tener el artículo.
- Fuentes comprobadas una a una: Federal Reserve y SEC (dominio público), MarketWatch, CNBC e Investing.com. Descartadas: IMF y BLS devuelven 403, el Banco Central de Chile no publica RSS y el feed del BCE trae un solo ítem.
- Se cita y se enlaza (titular, medio, fecha, enlace); **no se reproduce** el texto de la nota original. Firma institucional «Pessaro Capital»: la responsabilidad editorial la asume la empresa en vez de atribuirla a un analista inventado.
- Validación antes de publicar: longitud de cuerpo y bajada, categoría del enum, mínimo de dos fuentes, **ausencia de URLs en el cuerpo** (al modelo se le prohíben, así que una URL delata que se la inventó) y ausencia de lenguaje de recomendación.
- **Ya está desplegado y corriendo**: job `articulos-exclusivos`, 12:30 UTC los **lunes, miércoles y viernes** (`30 12 * * 1,3,5`). Comprobado el 2026-08-14: publicó un artículo con **8 fuentes de 5 medios**.

### Ventas: perfil P2P/B2B, etapa comercial y KPIs del asesor

- `crm_contacts` gana `contact_type` (P2P|B2B), `company_name`, `company_tax_id`, `sales_stage` (7 etapas), `estimated_value` y `next_followup_at`. Índice único parcial `(user_id, company_tax_id)`: el mismo asesor no debería tener dos fichas de la misma empresa; dos asesores distintos sí.
- **No se creó `crm_sales_activities`.** Ya existía `contact_activity_log` con la misma forma, que escribe `logActivity()` y lee `buildTimeline()` para la ficha y los export; una tabla paralela habría partido el historial del contacto en dos. Se extendió con `occurred_at` y `outcome`, y su CHECK con `'reunion'` — que no estaba, así que registrar una reunión habría reventado con 23514.
- `occurred_at` aparte de `created_at`: uno es cuándo ocurrió la gestión y otro cuándo se registró. El asesor anota el lunes la llamada del viernes y el KPI del mes tiene que contarla en su mes.
- **`sales_stage` es ortogonal a `status` y no se sincronizan solos.** `status = 'inactivo'` lo usan las automatizaciones de WhatsApp para dar de baja: un negocio perdido no puede sacar al contacto de las campañas por su cuenta.
- RPC `sales_kpis(p_user_id, p_from, p_to)`, security definer con el alcance decidido dentro: el asesor obtiene sólo lo suyo pida lo que pida; admin y super admin pueden pedir el de un asesor o el del equipo, y ven **agregados**, no filas. Se agrega en SQL y no en el navegador: traerse la cartera entera para sumarla en el cliente funciona con 39 contactos y deja de funcionar con 4.000.
- **Dos tasas en vez de una**, porque «tasa de conversión» a secas es ambigua: cierre (ganados sobre resueltos) y conversión de cartera (ganados sobre todo). Pipeline **ponderado por probabilidad de etapa**: la suma cruda trata igual un prospecto frío que una propuesta enviada.
- UI en `src/components/sales/`, autocontenida, siguiendo el patrón de `components/webcontent` y `components/whatsapp` en vez de extraerle los primitivos al monolito de `App.jsx`. En B2B aparecen razón social y RUT (validación por módulo 11 **como aviso, no como bloqueo**: la columna admite identificadores extranjeros).
- Todo lo comercial está cerrado tras `!esSub`: los formularios web que el super admin ve mezclados llevan id `sub_<uuid>` y no son filas de `crm_contacts`; escribirles habría reventado con 22P02.
- `Input()` de `App.jsx` pasa a propagar `...rest`: sin eso el `onBlur` de la ficha se perdía y los campos no guardaban al salir.

### Las notas de la ficha no se guardaban desde el 2026-06-18

- Escribir una nota y pulsar «+» no hacía nada: ni error a la vista ni nota en la lista.
- **Causa:** `fn_log_note_added()`, el trigger `AFTER INSERT` sobre `crm_notes`, insertaba `NEW.contact_id`. Esa columna no existe en `crm_notes` — la suya se llama `crm_contact_id`. La función reventaba con 42703 y, al ir en la misma transacción, **se llevaba por delante el INSERT de la nota**.
- Alcance medido antes de tocar nada: **0 notas de contacto** guardadas en toda la vida de la tabla; la última nota de cualquier tipo era del 2026-06-18.
- Por qué nadie lo vio: `addNote()` hacía `console.error` y salía. El botón parecía inerte y el error sólo estaba en la consola del navegador. Ahora el error se enseña en la ficha.
- Se retiró el `logActivity()` manual de `addNote()`: con el trigger arreglado habría dejado dos actividades por cada nota. Una nota de formulario web o de lead tiene `crm_contact_id` null, así que ahí el trigger no registra nada en vez de fallar.

### El panel de análisis se vaciaba cada noche

- Por la tarde-noche el Análisis Diario aparecía vacío con «revisa el planificador», aunque el planificador había publicado bien; se arreglaba solo por la mañana, lo que hacía el fallo aún más confuso.
- **Causa:** el componente calculaba el día con `new Date().toISOString()`, que es UTC. Desde las ~20:00 de Chile el día UTC ya había cambiado y la consulta pedía el día siguiente: 0 filas.
- El día pasa a calcularse en horario local, el panel abre en el **último día publicado** en vez de exigir que sea hoy, el aviso del planificador sale sólo si **no hay ningún** análisis publicado, y se añade selector de **histórico** (la tabla guardaba todos los días desde el alta; sólo faltaba poder verlos).

### Migraciones de este bloque

| Archivo | Qué hace |
|---|---|
| `20260813_analisis_instrumentos.sql` | `analisis_instrumentos` + `analisis_instrumentos_staff`, RLS separado, disclaimer obligatorio |
| `20260813_articulos_exclusivos_automatizados.sql` | `sources`/`disclaimer`/`generated_by`/`validacion`, CHECK de fuentes, despublica la siembra de marzo |
| `20260813_ventas_b2b_y_kpis.sql` | Campos comerciales en `crm_contacts`, `occurred_at`/`outcome`, RPC `sales_kpis()` |
| `20260813_fix_trigger_notas.sql` | `fn_log_note_added()` usa `crm_contact_id` |

---

## [2026-08-13] — Ficha del cliente, certificados de staff, campañas unificadas y automatizaciones de WhatsApp

### Contexto

Seis bloques de trabajo en una sesión. Tres de ellos nacieron de fallos que no daban ningún error visible: campañas programadas que nunca salían, bajas de WhatsApp que no se registraban, y un `estado = inactivo` que la gente creía que excluía de los envíos y no lo hacía.

---

### Ficha online del cliente (Contactos)

- El botón **Ver** abre una ficha a **pantalla completa** en vez del modal estrecho: cabecera fija, cierre con `Escape`, dos columnas en pantallas anchas.
- Secciones: registro completo (nombre, nacimiento con edad calculada, profesión, móvil, correo, dirección, alta, asesor, grupos), **cuenta de inversión** (apertura y fecha, demo/real, broker, número de cuenta, PAMM/MAM, balance inicial), **depósitos y retiros** con totales y alta de movimientos, **tareas** separadas en asignadas/pendientes/completadas, notas, gestión (estado y asesor) e historial consolidado.
- Migración `20260813_ficha_cliente_y_certificados.sql`: `crm_contacts` gana `birth_date`, `profession`, `account_opened`, `account_opened_at`, `account_kind`, `broker`, `account_number`, `initial_balance` y `managed_type`; nueva tabla `crm_client_movements` con RLS igual a la de contactos (dueño o super admin).
- El export HTML/PDF de la ficha se mantiene en sincronía con lo que se ve en pantalla.

### Certificados: emisión exclusiva del staff

- Nueva pestaña **Certificados** en Educación y bloque equivalente en la ficha del cliente, con el progreso real (lecciones publicadas completadas) y emisión habilitada sólo al 100 %.
- `issue_education_certificate()` valida rol admin/super_admin con `is_crm_admin()` y el avance **en el servidor**; `revoke_education_certificate()` queda para super_admin. `list_certificate_candidates()` cruza asignaciones aprobadas, progreso y certificado emitido.
- **La autoemisión del portal quedó desactivada.** La edge function `generate-certificate` permitía que el propio alumno se emitiera el certificado usando la *service role key* (que ignora RLS). Ahora responde **403 `self_issue_disabled`** con un mensaje entendible; se conservó el endpoint para no devolver un 404 al portal. La función pasa a estar versionada en el repo.
- `certificate_url` es `NOT NULL`: la RPC la arma con el mismo formato que usaba la edge function (`/storage/v1/object/public/certificates/{user}/{module}.pdf`), para que ambas vías apunten al mismo objeto.

### Campañas unificadas por canal

- El módulo **Campañas** absorbe los envíos WABA, que vivían escondidos en una subpestaña de Mensajes WA. Selector de canal: **Todas** (recuento y resumen) · **WhatsApp (WABA)** (sólo super admin) · **Enlace** · **Otras**.
- **«Campañas admin» desaparece del sidebar**: es la pestaña **Administrar** dentro del mismo módulo.
- Botón **⟳ Sincronizar desde Meta** en la pestaña WABA. El único disparador estaba en el selector de plantillas de un chat, que ya no es donde se gestionan las campañas.
- Botón **⧉ Reutilizar**: copia plantilla, destinatarios, imagen y saludo a un borrador nuevo. Antes había que crear la campaña desde cero para repetir un envío ya probado.

### Campañas programadas: el planificador que faltaba

- **Diagnóstico:** una campaña con fecha se guardaba con `status='scheduled'` y ahí terminaba todo. **No existía ningún planificador**, así que el mensaje no llegaba nunca. El badge «Programada» del historial es una etiqueta de estado, no un botón, por eso al pulsarlo tampoco pasaba nada.
- Además `scheduled_at` se guardaba con la hora local **sin zona** (`2026-08-13T09:25`), que Postgres interpretaba como UTC: la campaña quedaba programada 4 h antes de lo elegido.
- `whatsapp-send` **v17**: nueva action `run_due_campaigns`, que ejecuta las campañas vencidas. La llama **pg_cron cada 5 min** (job `wa-campanas-programadas`). Se autoriza con `WA_CRON_SECRET` **en el body**, porque la función tiene `verify_jwt` activo y el bearer debe ser un JWT válido (el cron manda la anon key). Se eligió un secreto propio en vez de la service role key para no dejarla escrita en `cron.job`, que es legible por cualquiera con acceso a la base.
- `runCampaign()`: la ejecución sale de `send_campaign` a una función propia, compartida por el disparo manual y el planificador.
- Una campaña sin destinatarios pasa a **`failed`** en vez de quedarse en `scheduled`, que hacía que el cron la reintentara en cada ciclo (`20260813_campanas_programadas.sql` amplía el CHECK de `status`).
- Frontend: `localAISO()` convierte la hora local al instante correcto, el formulario indica la zona horaria del usuario, el historial muestra la hora programada y hay botón **Enviar ahora** con confirmación en dos pasos.

### Formato único de móvil: sólo dígitos

- Los móviles pasan de `+56 9 7331 2927` a `56973312927`, que es lo que espera Meta.
- **El cambio no podía limitarse a `crm_contacts`.** El webhook guardaba `'+' + msg.from` y `normalizePhone()` conservaba el `+`, así que las claves de WhatsApp iban todas con `+`. Quitarlo sólo de contactos habría roto en silencio: los **opt-out** (`isOptedOut()` compara contra `whatsapp_opt_outs`, y una baja con `+` habría dejado de coincidir) y las **asignaciones** (`canSendToPhone()`), además de partir el hilo de la bandeja en dos conversaciones por persona.
- Migración `20260813_telefonos_solo_digitos.sql`: normaliza `crm_contacts`, `campaign_leads`, `contact_submissions`, `whatsapp_messages`, `whatsapp_assignments` y `whatsapp_opt_outs`.
- `whatsapp-send` **v18** y `whatsapp-webhook` **v15** normalizan a sólo dígitos. `App.jsx` gana `soloDigitos()` en alta manual, edición e importación CSV; las plantillas de carga masiva (CSV y TXT) y los placeholders pasan a `56912345678`.
- Fuera de alcance a propósito: `crm_staff_profiles`, `client_profiles`, `support_*`, `newsletter`, `education_downloads`, `live_chat_*`, `risk_profiles` y `user_profiles`.

### Automatizaciones de WhatsApp (baja, reactivación, bienvenida)

- **Fallo en vivo corregido:** el patrón de opt-out no reconocía **«Darme de baja»**, que es el texto exacto del botón de la plantilla aprobada `invitacion_educacion_pessaro_img`. `whatsapp_opt_outs` tenía **0 filas** y esa gente seguía entrando en las campañas.
- `whatsapp-webhook` **v16** resuelve la intención del entrante (botón de respuesta rápida o texto libre) por **texto normalizado** —sin tildes ni mayúsculas— contra una lista de frases, y cubre también `msg.type = 'interactive'` (`button_reply`), que antes quedaba fuera. Verificado con 21 casos: reconoce «Darme de baja», «BAJA», «Salir», «STOP», y **no** dispara con «Hola», «la bolsa está en baja» ni «quiero darme de baja del gimnasio».
- Tres flujos:
  - **baja** → `whatsapp_opt_outs` + `crm_contacts.status='inactivo'` + confirmación
  - **alta** → marca `opted_in_at` + confirmación
  - **comenzar** → `status='activo'`, `campaign_leads.etapa=2` + mensaje de bienvenida
- **Detalle que no es obvio:** cambiar `crm_contacts.status` a `'inactivo'` **NO excluye de los envíos masivos**, porque `runCampaign()` no filtra por estado al armar destinatarios. El bloqueo real es `whatsapp_opt_outs` vía `isOptedOut()`, así que el flujo de baja escribe en ambos sitios.
- `opted_in_at` (migración `20260813_automatizaciones_wa.sql`): la reactivación **marca** la fila en vez de borrarla, para conservar la auditoría de la baja. `isOptedOut()` y `runCampaign()` pasan a ignorar las filas reactivadas; sin eso un ALTA no habría surtido efecto.
- `responder()` envía a Graph **directamente** y no vía `whatsapp-send`, que bloquea a los dados de baja y por tanto impediría confirmarle la baja a quien la acaba de pedir. Las respuestas se insertan en `whatsapp_messages` con `auto_reply = true` para que salgan en las burbujas del CRM.
- Pulsar «Comenzar» estando de baja **responde** la bienvenida (es una petición explícita) pero **no reactiva**: salir de las campañas sólo se revierte con un ALTA explícito, como exige Meta.
- **Requiere que el botón sea de respuesta rápida.** Los botones de tipo URL **no generan ningún evento**: Meta no avisa del clic, abre el navegador y ahí acaba. Se verificó con datos (plantilla enviada, cero entrantes después; en todo el historial nunca hubo un entrante `button` ni `interactive`). El botón «Comenzar» se convirtió a respuesta rápida en Meta y el flujo quedó **funcionando en producción**: entrante `button` a las 17:31:47, bienvenida enviada 1,6 s después.

### Envío WABA desde Contactos y variable del saludo

- Botón **💬 WABA** en la fila del listado y **💬 Enviar WABA** en la ficha, **sólo super admin**. Usa `start_chat`, que valida el rol en el backend y auto-asigna el chat. Si el contacto pidió la baja el botón aparece bloqueado, en vez de dejar que el envío falle.
- Marca **«no contactar»** visible en la lista y en la ficha para quien tiene baja activa.
- `StartChatModal` gana soporte de plantillas con **encabezado de imagen**: sin esto el envío de `invitacion_educacion_pessaro_img` fallaba en Meta por parámetros faltantes, tanto desde Contactos como desde la bandeja.
- **Variable `{{1}}` de la campaña:** el envío masivo la rellenaba siempre con la primera palabra del nombre del contacto. Con el contacto «Para pruebas WABA» el mensaje salió como *«Hola, Para.»* — la plantilla de Meta estaba correcta, el valor lo ponía el CRM. Ahora la campaña elige entre **primer nombre de cada destinatario** (por defecto) o **un mismo texto para todos**, con vista previa. Se guarda en `whatsapp_campaigns.body_variable`; `null` = automático, así que las campañas existentes no cambian de comportamiento.
- `TemplatePicker` no recibía el nombre del contacto y pedía escribir la variable a mano en cada envío desde un chat; ahora `ChatWindow` se lo pasa y viene rellena.

---

### Migraciones de este bloque

| Archivo | Qué hace |
|---|---|
| `20260813_ficha_cliente_y_certificados.sql` | Campos de ficha en `crm_contacts`, `crm_client_movements`, `is_crm_admin()`, RPCs de certificados |
| `20260813_campanas_programadas.sql` | Estado `failed`, índice de vencidas, documentación del job de pg_cron |
| `20260813_telefonos_solo_digitos.sql` | Normaliza los teléfonos de las seis tablas de la cadena |
| `20260813_automatizaciones_wa.sql` | `opted_in_at`, `auto_reply` |
| `20260813_campanas_variable_saludo.sql` | `body_variable` |

### Pendientes conocidos

- El job de pg_cron **`task-reminders-daily`** usa `current_setting('app.settings.service_role_key')`, que **no está definido** en esta base: manda un `Bearer` vacío y probablemente lleva tiempo fallando. Detectado al montar el planificador de campañas; fuera del alcance de esta sesión.
- La `VITE_SUPABASE_ANON_KEY` del `.env` local sigue caducada (producción no se ve afectada por el fallback de `App.jsx`, pero `npm run dev` puede fallar).
- Si el portal `pessaro.cl` tiene un botón de «descargar certificado» que llama a `generate-certificate`, ahora mostrará el 403: conviene ocultarlo en ese repo.

---

## [2026-08-12] — Sync de plantillas WA + Grupos de contactos + Ficha del contacto

### Contexto

Dos problemas distintos, ambos de "el CRM no refleja la realidad":

1. Una plantilla aprobada en Meta no aparecía nunca en el módulo WhatsApp. El catálogo `whatsapp_templates` sólo se movía con la action manual `sync_templates`, y el único disparador (el botón "Sincronizar desde Meta") estaba sin commitear: en producción no existía forma de refrescarlo. La tabla llevaba congelada desde el último sync manual.
2. Contactos no permitía segmentar ni ver la historia de un contacto: el historial vivía repartido en seis tablas sin ningún punto de reunión.

---

### Plantillas de WhatsApp en tiempo real

- `whatsapp-webhook` **v14**: procesa `message_template_status_update` y `template_category_update`. Cuando Meta aprueba, rechaza o pausa una plantilla, la fila se actualiza en segundos.
- El evento de Meta **no trae `components`**, así que el handler relee la plantilla completa por su `message_template_id` antes del upsert. Sin ese paso una plantilla recién aprobada entraría con `body_text` vacío y `variables_count = 0`, y el envío fallaría por parámetros faltantes.
- El estado del evento pisa al de la relectura: la API de lectura de Meta a veces todavía devuelve `PENDING` cuando el evento ya dice `APPROVED`.
- Si la relectura falla, sólo se actualiza el estado de la fila existente; nunca se inserta una fila a medias.
- `TemplatePicker`: auto-sync al abrir si el catálogo tiene más de 30 min (sólo super_admin, con guard contra el doble efecto de StrictMode), indicador de antigüedad, y aviso al asesor cuando lleva más de 6 h sin refrescar.
- **Requiere** suscribir `message_template_status_update` en Meta App → WhatsApp → Configuración → Webhooks. Sin esa casilla el evento no llega y sólo queda el auto-sync como red.

### Grupos de contactos

- Migración `20260812_crm_contact_groups.sql`: `crm_contact_groups` (dueño `user_id`, nombre, descripción, color) y `crm_contact_group_members` (N:N contra `crm_contacts`).
- RLS con `is_super_admin()`, igual que `crm_contacts`: el grupo es del asesor que lo crea y el super_admin ve y administra los de todos. La membresía hereda el permiso del grupo.
- `UNIQUE(user_id, name)`: dos asesores pueden tener cada uno su grupo "Prospectos"; el mismo asesor no puede repetirlo.
- UI en Contactos: botón «🗂 Grupos» (crear/editar/eliminar con color), panel de miembros por grupo con buscador y selección múltiple, filtro por grupo en la lista y chips clicables en la ficha.
- **Limitación conocida**: sólo se agrupan filas reales de `crm_contacts`. Los `contact_submissions` que el super_admin ve mezclados en la lista no son contactos todavía; hay que convertirlos primero.

### Ficha del contacto

- Al abrir un contacto se consolidan en paralelo: notas + `contact_activity_log`, `whatsapp_messages`, `campaign_leads` + `contact_submissions`, y `support_tickets` + `crm_tasks` + `client_profiles_2026_02_08_22_02`.
- WhatsApp se cruza por los **últimos 8 dígitos** del teléfono: los números entran con formatos distintos según el origen (manual, CSV, landing, webhook) y comparar el string completo no acierta.
- Los tickets se deduplican porque pueden llegar por `contact_id` y por `client_email` a la vez.
- Todo se funde en una línea de tiempo única ordenada por fecha (`buildTimeline`), con tipo, icono y color por fuente. Reemplaza al antiguo bloque "Historial de Actividades".
- Exportación con el patrón de reportes ya existente en el repo, sin dependencias nuevas: **⬇ Ficha HTML** descarga un `.html` autocontenido vía Blob, y **⬇ Ficha PDF** abre la vista con `@media print` y botón Imprimir/Guardar PDF. Incluye disclaimer de confidencialidad y asesor responsable.

### Campañas de WhatsApp dirigidas a un grupo

- `CampaignSender`: selector "Destinatarios" — leads de campaña o un grupo de contactos. Al elegir grupo se ocultan variante y etapa, que sólo existen en `campaign_leads`.
- `whatsapp-send` **v16**: `send_campaign` ramifica según `target_filter.contact_group_id` y arma los destinatarios desde `crm_contact_group_members → crm_contacts`.
- En modo grupo `whatsapp_messages.lead_id` va **nulo**: su FK apunta a `campaign_leads` y el id del contacto no vive ahí. Sin esto todos los inserts del envío fallarían.
- Opt-out, dedup por teléfono normalizado y tope de 1000 destinatarios siguen aplicando igual en ambos modos.
- **Pendiente**: lanzar campañas sigue restringido a super_admin, así que un asesor puede crear grupos pero no dispararles una campaña.

### Archivos

`src/App.jsx`, `src/components/whatsapp/{TemplatePicker,CampaignSender,ChatWindow,StartChatModal}.jsx`, `src/hooks/useWhatsAppChat.ts`, `supabase/functions/whatsapp-{send,webhook}/index.ts`, `supabase/migrations/20260811_*.sql`, `supabase/migrations/20260812_crm_contact_groups.sql`.

---

## [2026-05-19] — Unificación campaign_leads + Tab Landings

### Contexto

El CRM manejaba dos tablas paralelas para la campaña Q2:

- `campaign_participants` — participantes registrados manualmente desde el CRM
- `campaign_leads` — leads que llegaban por las landing pages (gestionados por el CMS)

Esto generaba fragmentación: el equipo tenía que revisar dos lugares para ver el universo completo de leads y los datos no estaban sincronizados entre el CRM y el CMS.

---

### Cambios en `src/App.jsx`

#### 1. `CampanaModule` — Fuente única: `campaign_leads`

`campaign_participants` fue retirado como fuente de datos del módulo Campaña. El componente ahora lee directamente `globalLeads`, que es el array de `campaign_leads` cargado en el fetch principal de la aplicación.

**Antes:**
```js
supabase.from('campaign_participants').select('*').eq('campaign_id', campaign.id)
```

**Después:**
```js
// Lee globalLeads (campaign_leads) — sin fetch adicional
const leads = globalLeads || []
```

Beneficios:
- Sin fetch duplicado al montar el módulo
- Los leads que entran por `/campana/navy`, `/campana/editorial` y `/campana/bold` aparecen automáticamente en el CRM sin paso manual
- Una sola fuente de verdad compartida con el CMS

#### 2. `addLead()` — Inserción directa en `campaign_leads`

El botón **+ Añadir lead** ahora inserta directamente en `campaign_leads` con los campos:

| Campo | Valor |
|---|---|
| `source` | `'crm_manual'` |
| `referral_code` | Generado automáticamente (6 chars) |
| `advisor_assigned` | Email del usuario CRM autenticado |
| `variant` | Seleccionable: navy / editorial / bold |
| `perfil` | Seleccionable: retail / mam / asesor |
| `position_in_queue` | `leads.length + 1` |

El modal de añadir lead incluye dos campos nuevos: **Perfil** y **Landing (variant)**.

#### 3. `updateLead()` — Actualización en `campaign_leads`

Los toggles de Contactado / Cuenta / KYC / Depósito en "Mis Leads" ahora actualizan `campaign_leads` directamente:

```js
supabase.from('campaign_leads').update(updates).eq('id', id)
```

#### 4. Tab **🚀 Landings** — nuevo

Se agregó un tercer tab en `CampanaModule` con:

**Cards por variante** (Navy / Editorial / Bold):
- Total de leads registrados desde esa landing
- Depósitos confirmados
- Tasa de conversión (depósitos / leads × 100)
- Lead top scorer de la variante
- Botón **"Ver landing →"** → abre `pessaro.cl/campana/{variant}` en nueva pestaña
- Botón **"+ Ref"** → abre la landing con `?ref=DEMO`

**Tabla de links de referido:**
- Patrón: `https://pessaro.cl/campana/{variant}?ref=CODIGO`
- Botón copiar para cada variante

#### 5. Tab **👤 Mis Leads** — filtros agregados

Se agregaron filtros de **Landing** (variant) y **Perfil** en la vista de tabla de leads, consistentes con los filtros del Pipeline.

La variable `myParts` fue reemplazada por `filtered` (array de leads ya filtrado por variant/perfil).

---

### Estructura de tabs en CampanaModule

```
🏆 General   →  Leaderboard + Stats + Bonus tiers + Leads por capital
🚀 Landings  →  Cards de variantes + Links de referido         [NUEVO]
👤 Mis Leads →  Tabla editable de leads + Filtros + Añadir lead
```

---

### Base de datos

No se requirieron migraciones. `campaign_leads` ya tenía las columnas `variant` y `perfil` desde la migración `add_campaign_variant_perfil_2026_05_18`.

La vista `campaign_leads_admin` fue recreada el mismo día para incluir dichas columnas.

`campaign_participants` permanece en la base de datos (no fue eliminada) pero ya no es utilizada por el CRM. Puede archivarse en una futura limpieza.

---

### Leads de prueba insertados

Se insertaron 10 leads de prueba en `campaign_leads` para validar el flujo CMS ↔ CRM:

| Lead | Variante | Perfil | Score | Depósito |
|---|---|---|---|---|
| Matias Herrera | editorial | asesor | 200 | $52.000 |
| Diego Fuentes | navy | asesor | 90 | $8.500 |
| Camila Vargas | navy | mam | 90 | $6.200 |
| Sofia Reyes | bold | retail | 30 | — |
| Carlos Mendez | editorial | mam | 30 | — |
| Valentina Cruz | editorial | mam | 50 | — |
| Lucia Navarro | bold | retail | 30 | — |
| Ana Torres | navy | retail | 50 | — |
| Andres Morales | editorial | mam | 40 | — |
| Rodrigo Soto | bold | retail | 10 | — |

Emails actualizados a `@gmail.com` para que el CRM los reconozca correctamente.

---

### Commits asociados

```
feat(campana): unificar campaign_leads como fuente única, retirar campaign_participants
fix(campana): reemplazar participants.length por leads.length en barra de progreso
fix(campana): eliminar referencias a myParts — usar filtered
feat(campana): agregar tab Landings con cards de variantes, stats y links de referido
```

---

### Archivos modificados

```
src/App.jsx    — CampanaModule reescrito (función completa)
```
