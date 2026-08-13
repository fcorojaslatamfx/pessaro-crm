# Pessaro Capital CRM — Changelog

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
