# Pessaro CRM

CRM interno de **Pessaro Capital** para la gestión de contactos, campañas, comunicaciones (WhatsApp/Email) y soporte a clientes. Es una SPA en React servida por Vite y desplegada en Vercel, con Supabase como backend (Postgres + Auth + Edge Functions + Storage).

Repos hermanos: `pessaro_CL` (sitio público pessaro.cl y portal de clientes, fuente de leads vía landings de campaña) y su **espejo** `pessaro` (pessarocapital.com), que se sincroniza desde `pessaro_CL` y **no se desarrolla por su cuenta**. El CRM comparte con ellos el proyecto Supabase, así que las tablas de contenido (análisis diario, artículos exclusivos) se leen desde los dos lados: lo que cambie de esquema aquí afecta al portal.

## Alcance actual

- **Contactos y leads**: gestión de contactos propios por asesor, import masivo CSV/TXT, notas, grupos y **ficha del cliente a pantalla completa** (registro, cuenta de inversión, depósitos/retiros, tareas e historial consolidado, exportable a HTML/PDF).
- **Campañas** (módulo unificado por canal): **WhatsApp (WABA)** con plantillas de Meta, programación y reutilización · **Enlace** (variantes de landing Navy/Bold/Editorial/Minimalist, leads en `campaign_leads`, asignación por asesor) · **Otras** · **Administrar** (alta de campañas y variantes, sólo super admin).
- **WhatsApp**: inbox de chats, envío de texto/plantillas/adjuntos, asignación de conversaciones a asesores (vía Meta WhatsApp Cloud API) y **automatizaciones** sobre los mensajes entrantes: baja (opt-out), reactivación con `ALTA` y bienvenida al pulsar el botón «Comenzar».
- **Emails**: envío transaccional y de campaña (Resend), tracking por asesor.
- **Ventas (perfil comercial y KPIs)**: cada contacto es **P2P o B2B** (con razón social y RUT en B2B) y avanza por una **etapa de venta** de siete pasos, con monto estimado y próximo seguimiento. Los KPIs del asesor —gestiones, tasa de cierre, conversión de cartera y pipeline ponderado por probabilidad de etapa— se calculan en SQL con la RPC `sales_kpis()`, que decide el alcance dentro: el asesor sólo obtiene lo suyo, admin y super admin ven agregados del equipo.
- **Análisis diario de instrumentos**: 9 instrumentos (divisas, metales, energía, índices, cripto) analizados cada mañana. Los niveles se calculan en código sobre series de precios reales y se validan antes de publicar; el modelo sólo redacta. Dos audiencias con RLS separado: lectura técnica para el asesor en el CRM, lectura divulgativa para el cliente en el portal. Selector de histórico por día. Detalle en `ANALISIS_DIARIO_INSTRUMENTOS.md`.
- **Artículos exclusivos automatizados**: un artículo para el portal cada lunes, miércoles y viernes, redactado sobre **fuentes reales que trae el código** (feeds RSS de la Reserva Federal, la SEC, MarketWatch, CNBC e Investing.com), citadas y enlazadas. El modelo no aporta referencias —las inventaría—, sólo el comentario propio; se valida longitud, categoría, mínimo de dos fuentes, ausencia de URLs en el cuerpo y ausencia de lenguaje de recomendación antes de publicar.
- **Educación**: asignación y aprobación de contenido educativo a clientes, y **emisión de certificados** según el progreso real del alumno — exclusiva de admin/super admin (la autoemisión desde el portal está desactivada).
- **Contenido Web (CMS)**: gestores de Blog, FAQs, Servicios, Instrumentos, Equipo, Páginas y Ajustes del sitio público.
- **Clientes / Portal KYC**: revisión de verificación KYC de clientes desde Contactos.
- **Soporte (Tickets con OTP)** — módulo más reciente y activo:
  - Portal público `/soporte` donde el cliente abre un ticket verificando su email por OTP (sin necesidad de cuenta).
  - Inbox de staff en el CRM (`SupportInbox`), con tickets aislados por asesor asignado (RLS) y visión total para super admin.
  - Auditoría de cambios de estado/asignación (`support_ticket_events`) y reglas de cierre/reapertura (ver "Estado reciente" abajo).
- **Aislamiento de datos por rol**: cada asesor ve solo sus propios contactos, chats, emails, leads y KPIs; super admin ve todo.
- **WAFinance** (parcial/en curso): chat en vivo con OTP embebido en `crm.pessaro.cl/chat/:referralCode`. Invitación con vista previa OG **dinámica**: `WAFinanceInviteButton` arma el link `/invite/:referralCode?img=N`, que Vercel reescribe a `api/invite.js` (serverless) — este genera meta tags `og:title/og:image/og:url` a medida (imagen de galería 1-5 o default) y redirige (HTTP refresh) al chat real; `index.html` solo trae el OG estático de fallback para el link directo sin invitación.

Para el detalle completo de tablas, Edge Functions, roles e integraciones, ver **`PESSARO_CRM_INFRASTRUCTURE.md`** — es el documento vivo y el único que se mantiene al día. `PESSARO_INFRASTRUCTURE_v1.7.md` es una foto consolidada del 2026-08-13 que conserva la parte de sitio público y Educación; para el CRM está desfasada.

## Stack tecnológico

Según `package.json` y el código real en `src/` (algunos documentos de infraestructura mencionan Tailwind/React Router/shadcn como visión futura, pero **no están presentes en el código actual**):

| Capa | Tecnología |
|---|---|
| Frontend | React 18 (JSX, sin TypeScript salvo `useWhatsAppChat.ts`) |
| Bundler/dev server | Vite 5 (`@vitejs/plugin-react`) |
| Routing | Manual, vía `window.location.pathname` en `App.jsx` (sin React Router) |
| Estilos | Inline / sin librería CSS (no hay Tailwind ni archivos `.css` en `src/`) |
| Gráficos | Recharts |
| Backend / BD | Supabase (PostgreSQL + Auth + Row Level Security) |
| Lógica serverless | Supabase Edge Functions (Deno) |
| Comunicaciones | Meta WhatsApp Cloud API, Resend (email) |
| Hosting | Vercel |
| Generación de íconos PWA | `sharp` (script `scripts/gen-icons.cjs`) |

## Estructura de carpetas clave

```
src/
├── App.jsx                     # Núcleo del CRM: auth, sidebar, routing manual, mayoría de módulos
├── main.jsx                    # Entry point de React
├── lib/supabase.js             # Cliente Supabase
├── hooks/useWhatsAppChat.ts    # Hook de suscripción realtime a chats de WhatsApp
├── pages/
│   ├── SupportPortal.jsx       # Portal público /soporte (crear ticket, OTP)
│   ├── SupportTicketView.jsx   # Hilo público /soporte/ticket/:ticketNumber
│   └── WAFinanceChat.jsx       # Chat público /chat/:referralCode
└── components/
    ├── support/SupportInbox.jsx        # Inbox de staff del módulo Soporte
    ├── whatsapp/                       # Inbox, envío de plantillas, campañas WA
    ├── sales/                          # KPIs de ventas y primitivos del módulo comercial
    ├── education/EducationAdmin.jsx    # Módulo Educación
    ├── clients/ClientsPortalKYC.jsx    # Revisión KYC en Contactos
    └── webcontent/                     # 8 gestores de Contenido Web (CMS)

supabase/
├── functions/
│   ├── whatsapp-webhook/       # Recibe eventos de Meta (mensajes, estados) + automatizaciones
│   ├── whatsapp-send/          # Envío de texto/plantillas/media + campañas y planificador
│   ├── generate-certificate/   # Desactivada: la emisión de certificados es del staff (403)
│   ├── generar-analisis-diario/ # Análisis diario de instrumentos (datos reales + Claude)
│   ├── generar-articulos-referencias/ # Artículo diario del portal con fuentes RSS citadas
│   ├── support_otp/            # OTP por email para el portal de soporte
│   ├── support_tickets/        # CRUD de tickets (crear, listar, responder)
│   └── support_notify/         # Notificación al asesor asignado
└── migrations/                 # Migraciones SQL (incluye las de soporte, 2026-07)

scripts/gen-icons.cjs           # Genera íconos PWA (manifest.json / public/icons)
api/invite.js                   # Vercel serverless: OG dinámico por invitación WAFinance (/invite/:code)
public/                         # manifest.json, sw.js (service worker), íconos, OG image estático (fallback)
```

## Desarrollo local

Requisitos: Node.js (compatible con Vite 5) y acceso al proyecto Supabase (`ldlflxujrjihiybrcree`, según la documentación de infraestructura).

```bash
npm install
npm run dev        # levanta Vite en modo desarrollo (HMR)
npm run build      # build de producción a dist/
npm run preview    # sirve el build de dist/ localmente
```

## Variables de entorno

Definidas en `.env` / `.env.local` (no versionados, ver `.gitignore`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_VAPID_PUBLIC_KEY=...   # Web Push (VAPID pública; la privada solo vive en Supabase secrets)
```

`App.jsx` tiene un fallback hardcoded para la URL de Supabase si la env var no está presente, pero se recomienda siempre definir `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.

Los secretos de servidor (`WA_PERMANENT_TOKEN`, `WA_VERIFY_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, credenciales de Resend, etc.) se configuran como **secrets de Supabase Edge Functions**, nunca en el frontend.

## Despliegue

- Hosting: **Vercel**, build `npm run build` → `dist/` (ver `vercel.json`: rewrites SPA, headers de seguridad y caché para `sw.js`/`manifest.json`/`icons`/`assets`).
- Backend: Supabase (migraciones en `supabase/migrations/`, Edge Functions en `supabase/functions/`).
- Repo con rama `staging` para pruebas antes de mergear a `master` (ver flujo de trabajo y checklist pre-push en `PESSARO_CRM_INFRASTRUCTURE.md`, sección "Instrucciones críticas").

## Integraciones

- **WhatsApp (Meta Cloud API)**: webhook de recepción + función de envío (texto, plantillas aprobadas, adjuntos por super_admin), asignación de chats a asesores, almacenamiento de media en Supabase Storage. Detalle completo de arquitectura, modelo de datos, Edge Functions y checklist de implementación en `WHATSAPP_INTEGRATION.md`.
- **Email transaccional (Resend)**: envío de plantillas, OTP de soporte, notificaciones al asesor asignado, tracking por remitente.
- **Market data**: Twelve Data (forex/oro), Alpaca (snapshots de acciones/ETF) y CoinGecko (cripto) para el módulo de reportes/mercado.
- **Soporte con OTP**: patrón de verificación por email reutilizado del flujo WAFinance; ver `SPEC_SOPORTE_TICKETS_OTP_2026_07_19.md` y `SPEC_SOPORTE_TICKETS_OTP v1.2.md` para el detalle funcional.

## Estado actual / trabajo reciente

El repo está en desarrollo activo.

**2026-08-14 — El análisis del CRM volvía a fecharse un día antes que el portal.**

El desplegable del Análisis Diario mostraba `13-08-2026 · hoy` mientras el portal de clientes, con **las mismas filas**, fechaba `14 de agosto · hoy`. `fmtDate()` hacía `new Date('2026-08-14')`, y una fecha suelta la parsea JavaScript como medianoche UTC: pintada en hora de Chile (UTC−4) retrocedía al día anterior. Los datos siempre estuvieron sincronizados; sólo estaba mal la etiqueta. El arreglo alcanza también a **fecha de nacimiento**, **fecha de movimiento** y **fecha límite de tareas**, que son columnas `date`, y al formateador de la ficha exportada a HTML/PDF.

> **Regla:** una columna `date` es un día de calendario, no un instante. Nunca pasa por `new Date(cadena)` sin hora ni por `toISOString()`. Aplica igual al portal `pessaro_CL`, que muestra la misma tabla (`ANALISIS_DIARIO_INSTRUMENTOS.md` §8).

Pendiente detectado ese día: sólo se publicaron **5 de los 9 instrumentos**, y los cuatro que faltan son exactamente los de Twelve Data (EUR/USD, GBP/USD, USD/JPY, XAU/USD). El cron corrió y terminó bien, así que apunta al proveedor de datos.

**2026-08-13 (segunda parte) — Análisis diario, artículos con fuentes citadas, KPIs de ventas y dos fallos silenciosos.**

1. **Análisis diario de instrumentos** — 9 instrumentos publicados cada mañana en el portal y en el panel del asesor, con los niveles calculados en código sobre series reales y validados antes de publicar. Dos tablas con RLS separado porque **RLS es row-level, no column-level**: una sola tabla habría dado al cliente del portal la lectura técnica interna.
2. **Artículos exclusivos automatizados** — sustituyen a la siembra de marzo de 2026, que iba firmada por analistas que no son personas del equipo y con referencias de hace cinco meses. Las fuentes las trae el código de feeds RSS reales y se citan enlazadas; el modelo sólo redacta el comentario propio. Desplegado y corriendo (job `articulos-exclusivos`, 12:30 UTC los lunes, miércoles y viernes).
3. **Ventas: perfil P2P/B2B, etapa comercial y KPIs** — `sales_stage` es **ortogonal a `status`** y no se sincronizan solos: `status = 'inactivo'` lo usan las automatizaciones de WhatsApp para dar de baja, así que un negocio perdido no puede sacar al contacto de las campañas por su cuenta. Los KPIs se agregan en SQL (`sales_kpis()`), no en el navegador.
4. **Las notas de la ficha no se guardaban desde el 2026-06-18** — el trigger `fn_log_note_added()` insertaba `NEW.contact_id`, columna que no existe en `crm_notes` (la suya es `crm_contact_id`): reventaba con 42703 y, en la misma transacción, se llevaba por delante el INSERT de la nota. **0 notas de contacto** guardadas en toda la vida de la tabla. El botón parecía inerte porque el error sólo salía por consola.
5. **El panel de análisis se vaciaba cada noche** — el día se calculaba con `toISOString()` (UTC), así que desde las ~20:00 de Chile la consulta pedía el día siguiente y devolvía 0 filas. Ahora el día es local, el panel abre en el último día publicado y hay selector de histórico.

**2026-08-13 — Ficha del cliente, certificados de staff, campañas unificadas y automatizaciones de WhatsApp.**

Sesión larga con seis bloques; tres nacieron de fallos que **no daban ningún error visible**. Detalle completo en `CHANGELOG_CRM.md`.

1. **Ficha del cliente a pantalla completa** — `crm_contacts` gana los campos del registro (nacimiento, profesión, apertura de cuenta, demo/real, broker, nº de cuenta, PAMM/MAM, balance inicial) y aparece `crm_client_movements` para depósitos y retiros.
2. **Certificados sólo del staff** — `issue_education_certificate()` valida rol y 100 % de avance en el servidor; la edge function `generate-certificate`, que permitía al alumno autoemitirse el certificado con la *service role key*, responde ahora **403**.
3. **Campañas en un solo módulo**, separadas por canal (WABA / Enlace / Otras / Administrar). «Campañas admin» sale del sidebar. Botones de **sincronizar plantillas desde Meta** y de **reutilizar** una campaña ya probada.
4. **Campañas programadas: no existía planificador.** Las filas se quedaban en `status='scheduled'` para siempre y el mensaje nunca llegaba; además `scheduled_at` se guardaba sin zona horaria, adelantando la campaña 4 h. Ahora `whatsapp-send` v17 expone `run_due_campaigns` y **pg_cron lo llama cada 5 min** (job `wa-campanas-programadas`, autorizado con `WA_CRON_SECRET` en el body porque la función tiene `verify_jwt` activo).
5. **Móviles en formato único, sólo dígitos.** El cambio tuvo que abarcar `crm_contacts`, `campaign_leads`, `contact_submissions` y las tres tablas de WhatsApp: quitar el `+` sólo de contactos habría roto **en silencio** los opt-out y las asignaciones de chat.
6. **Automatizaciones de WhatsApp** — el patrón de opt-out no reconocía «Darme de baja», el texto exacto del botón aprobado, así que **ninguna baja se estaba registrando** y esa gente seguía entrando en las campañas. `whatsapp-webhook` v16 resuelve la intención por texto normalizado y ejecuta baja / reactivación (`ALTA`) / bienvenida, respondiendo automáticamente y dejando la respuesta en el historial (`auto_reply`).

Dos avisos que conviene tener presentes:

- **Un botón de plantilla sólo dispara automatizaciones si es de _respuesta rápida_.** Los de tipo URL abren el enlace y Meta **no envía ningún evento**, así que no hay nada que escuchar.
- **`crm_contacts.status = 'inactivo'` NO excluye de los envíos masivos**: `runCampaign()` no filtra por estado. El único bloqueo real es `whatsapp_opt_outs` vía `isOptedOut()`.

Pendientes conocidos de este bloque: el job de pg_cron `task-reminders-daily` usa `app.settings.service_role_key`, que no está definido en la base (manda un `Bearer` vacío y probablemente lleva tiempo fallando); y si el portal `pessaro.cl` tiene un botón de descarga de certificado que llama a `generate-certificate`, ahora recibirá el 403.

**2026-08-12 — WhatsApp: plantillas y campañas por grupo; Contactos: grupos y ficha.**

1. `fix(wa): la plantilla aprobada en Meta ya no se queda fuera del CRM` — el catálogo `whatsapp_templates` sólo se refrescaba con un sync manual cuyo botón estaba sin commitear, así que en producción no había forma de actualizarlo. `whatsapp-webhook` v14 procesa ahora `message_template_status_update` y `template_category_update` (relee la plantilla completa por su id, porque el evento no trae `components`), y el `TemplatePicker` hace auto-sync al abrir si el catálogo tiene más de 30 min. **Requiere suscribir `message_template_status_update` en Meta App → WhatsApp → Webhooks.**
2. `feat(contactos): grupos + ficha con historial consolidado` — nuevas tablas `crm_contact_groups` y `crm_contact_group_members` (grupo del asesor, super_admin ve todos), filtro por grupo y panel de miembros. La ficha del contacto consolida en una línea de tiempo única las notas, `contact_activity_log`, WhatsApp, leads de campaña, formularios web, tickets, tareas y cuenta de cliente, y se exporta a HTML y PDF (patrón `@media print`, sin dependencias nuevas).
3. `whatsapp-send` v16 — `send_campaign` acepta `target_filter.contact_group_id` para enviar a un grupo de contactos en vez de a `campaign_leads`.

Pendientes conocidos de este bloque: lanzar campañas sigue siendo exclusivo de super_admin, y los `contact_submissions` (formularios web) no se pueden agrupar hasta convertirlos en contactos.

**2026-07-21 — Módulo de Soporte (Tickets con verificación OTP)**, todavía en ajustes:

1. `feat(soporte): modulo de tickets de soporte con verificacion OTP` — alta del módulo (portal + inbox + Edge Functions).
2. `feat(soporte): integracion portal cliente <-> CRM (SPEC S10, sin OTP)` — reforzó la integración portal↔CRM.
3. `fix(soporte): reflejar cambios de estado/asignación en UI + realtime sobre support_tickets` — el inbox de staff no reflejaba en vivo los cambios de estado/asignación; se agregó canal realtime sobre `support_tickets` y corrección de estado local tras cada `update`.
4. `feat(soporte): cierre/reapertura de tickets con auditoria (support_ticket_events)` — nueva tabla `support_ticket_events` con trigger que audita automáticamente cada cambio de estado/asignación (creado, estado, asignación, cerrado, reabierto), y regla de negocio: **solo super_admin puede reabrir un ticket cerrado**.
5. `fix(soporte): cliente no puede reabrir ticket cerrado escribiendo` — el Edge Function `support_tickets` reabría el ticket automáticamente si el cliente escribía tras el cierre; ahora rechaza `add_message` en tickets cerrados (409) y exige que el cliente abra un ticket nuevo, dejando la reapertura del original exclusivamente al super_admin.

Pendientes conocidos del módulo de Soporte (ver `PESSARO_CRM_INFRASTRUCTURE.md`): bucket `support-attachments` para adjuntos aún no creado/integrado, y Fase 2 de OTP/avisos por SMS vía Mensatek.

Para el historial detallado de cambios previos (unificación de `campaign_leads`, tab Landings, etc.) ver `CHANGELOG_CRM.md`. Para la foto completa de infraestructura (tablas, RLS, Edge Functions, hosting, integraciones externas y mejoras pendientes) ver `PESSARO_CRM_INFRASTRUCTURE.md`.
