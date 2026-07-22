# Pessaro CRM

CRM interno de **Pessaro Capital** para la gestión de contactos, campañas, comunicaciones (WhatsApp/Email) y soporte a clientes. Es una SPA en React servida por Vite y desplegada en Vercel, con Supabase como backend (Postgres + Auth + Edge Functions + Storage).

Repo hermano relacionado: `pessarocl` (sitio público pessaro.cl, fuente de leads vía landings de campaña).

## Alcance actual

- **Contactos y leads**: gestión de contactos propios por asesor, import masivo CSV/TXT, notas.
- **Campañas**: variantes de landing (Navy/Bold/Editorial/Minimalist), leads (`campaign_leads`), asignación por asesor.
- **WhatsApp**: inbox de chats, envío de texto/plantillas/adjuntos, asignación de conversaciones a asesores (vía Meta WhatsApp Cloud API).
- **Emails**: envío transaccional y de campaña (Resend), tracking por asesor.
- **Educación**: módulo de asignación y aprobación de contenido educativo a clientes.
- **Contenido Web (CMS)**: gestores de Blog, FAQs, Servicios, Instrumentos, Equipo, Páginas y Ajustes del sitio público.
- **Clientes / Portal KYC**: revisión de verificación KYC de clientes desde Contactos.
- **Soporte (Tickets con OTP)** — módulo más reciente y activo:
  - Portal público `/soporte` donde el cliente abre un ticket verificando su email por OTP (sin necesidad de cuenta).
  - Inbox de staff en el CRM (`SupportInbox`), con tickets aislados por asesor asignado (RLS) y visión total para super admin.
  - Auditoría de cambios de estado/asignación (`support_ticket_events`) y reglas de cierre/reapertura (ver "Estado reciente" abajo).
- **Aislamiento de datos por rol**: cada asesor ve solo sus propios contactos, chats, emails, leads y KPIs; super admin ve todo.
- **WAFinance** (parcial/en curso): chat en vivo con OTP embebido en `crm.pessaro.cl/chat/:referralCode`. Invitación con vista previa OG **dinámica**: `WAFinanceInviteButton` arma el link `/invite/:referralCode?img=N`, que Vercel reescribe a `api/invite.js` (serverless) — este genera meta tags `og:title/og:image/og:url` a medida (imagen de galería 1-5 o default) y redirige (HTTP refresh) al chat real; `index.html` solo trae el OG estático de fallback para el link directo sin invitación.

Para el detalle completo de tablas, Edge Functions, roles e integraciones, ver `PESSARO_CRM_INFRASTRUCTURE.md` (documento vivo, más actualizado) y `PESSARO_INFRASTRUCTURE_v1.7.md`.

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
    ├── education/EducationAdmin.jsx    # Módulo Educación
    ├── clients/ClientsPortalKYC.jsx    # Revisión KYC en Contactos
    └── webcontent/                     # 8 gestores de Contenido Web (CMS)

supabase/
├── functions/
│   ├── whatsapp-webhook/       # Recibe eventos de Meta (mensajes, estados)
│   ├── whatsapp-send/          # Envío de texto/plantillas/media
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

El repo está en desarrollo activo. Los commits más recientes (`git log`) se concentran en el **módulo de Soporte (Tickets con verificación OTP)**, lanzado el 2026-07-21 y todavía en ajustes:

1. `feat(soporte): modulo de tickets de soporte con verificacion OTP` — alta del módulo (portal + inbox + Edge Functions).
2. `feat(soporte): integracion portal cliente <-> CRM (SPEC S10, sin OTP)` — reforzó la integración portal↔CRM.
3. `fix(soporte): reflejar cambios de estado/asignación en UI + realtime sobre support_tickets` — el inbox de staff no reflejaba en vivo los cambios de estado/asignación; se agregó canal realtime sobre `support_tickets` y corrección de estado local tras cada `update`.
4. `feat(soporte): cierre/reapertura de tickets con auditoria (support_ticket_events)` — nueva tabla `support_ticket_events` con trigger que audita automáticamente cada cambio de estado/asignación (creado, estado, asignación, cerrado, reabierto), y regla de negocio: **solo super_admin puede reabrir un ticket cerrado**.
5. `fix(soporte): cliente no puede reabrir ticket cerrado escribiendo` — el Edge Function `support_tickets` reabría el ticket automáticamente si el cliente escribía tras el cierre; ahora rechaza `add_message` en tickets cerrados (409) y exige que el cliente abra un ticket nuevo, dejando la reapertura del original exclusivamente al super_admin.

Pendientes conocidos del módulo de Soporte (ver `PESSARO_CRM_INFRASTRUCTURE.md`): bucket `support-attachments` para adjuntos aún no creado/integrado, y Fase 2 de OTP/avisos por SMS vía Mensatek.

Para el historial detallado de cambios previos (unificación de `campaign_leads`, tab Landings, etc.) ver `CHANGELOG_CRM.md`. Para la foto completa de infraestructura (tablas, RLS, Edge Functions, hosting, integraciones externas y mejoras pendientes) ver `PESSARO_CRM_INFRASTRUCTURE.md`.
