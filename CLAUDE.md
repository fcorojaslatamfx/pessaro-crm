# CLAUDE.md

Guía para Claude Code en este repositorio.

## Qué es este proyecto

CRM interno de **Pessaro Capital SpA**: gestión de contactos/leads, campañas (WhatsApp/Enlace), inbox de WhatsApp con automatizaciones, ventas (KPIs), análisis diario de instrumentos, artículos exclusivos automatizados, educación, CMS del sitio público y soporte con tickets OTP. Sirve `crm.pessaro.cl`.

**Este repo maneja datos personales de contactos/clientes reales y comparte Supabase con `pessarocl`** (el sitio público y portal de clientes) y la Academia — ver `SUPABASE_COMPARTIDO.md`. **Este repo es público en GitHub.** Nunca commitear detalle de vulnerabilidades sin corregir, credenciales, ni nada que un atacante pudiera usar directamente — ese contenido va en la memoria local de Claude Code (nunca en un archivo versionado), y solo se sube al repo una vez corregido.

`origin` → `github.com/fcorojaslatamfx/pessaro-crm`, rama por defecto `master`. Se trabaja en `staging` y se mergea a `master` con decisión humana — misma convención que `pessarocl`.

## Antes de trabajar

Antes de ejecutar cualquier tarea: (1) relee este archivo — ya se recarga automáticamente al inicio de cada sesión; (2) consulta la memoria del proyecto cuando sea relevante; (3) si la tarea toca Supabase Auth, roles, RLS, `whatsapp-webhook` o `whatsapp-send`, lee **`SUPABASE_COMPARTIDO.md`** primero — documenta lo que no se puede decidir mirando solo este repo, porque `pessarocl` despliega contra el mismo proyecto Supabase.

## Stack

React 18 (JSX, **sin TypeScript** salvo `src/hooks/useWhatsAppChat.ts`) · Vite 5 (`@vitejs/plugin-react`) · routing manual vía `window.location.pathname` en `App.jsx` (**sin** React Router) · estilos inline (**sin** Tailwind, sin `.css` en `src/`) · Recharts · Supabase (Postgres, Auth, Edge Functions Deno, Storage) · Meta WhatsApp Cloud API · Resend · Vercel.

Difiere de `pessarocl` en varios de estos puntos (ese sí usa TypeScript, Tailwind y React Router) — no asumas que un patrón de un repo aplica al otro.

## Comandos

```bash
npm install
npm run dev        # Vite dev server con HMR
npm run build      # build de producción → dist/
npm run preview    # sirve dist/ localmente
```

No hay script de lint ni de typecheck configurado (no hay ESLint ni `tsconfig.json` para el proyecto — solo `useWhatsAppChat.ts` es TS, sin chequeo integrado a `npm run build`).

## Reglas duras

- **`whatsapp-webhook` existe en este repo pero es una copia vieja — no desplegarla.** La versión real y desplegada vive en `pessarocl`. Ver `SUPABASE_COMPARTIDO.md`.
- **Nunca trackear `deno.lock`** (ignorado en `.gitignore`). Un lockfile generado localmente puede romper `supabase functions deploy` con errores de `eszip`. Los imports remotos de las Edge Functions van con versión exacta (`@2.112.3`, nunca solo `@2`) — ver `SUPABASE_COMPARTIDO.md`.
- **No hay base de staging separada.** Todo el trabajo (incluida `staging`) escribe sobre el mismo proyecto Supabase que ve producción. Marca cualquier fila de prueba de forma reconocible antes de crearla.
- Los roles del sistema están en **español** (`cliente`, `interno`, `asesor`, `super_admin`) — no existe `client` en inglés.
- El teléfono está en solo dígitos en las 6 tablas de la cadena WhatsApp/CRM (`crm_contacts`, `campaign_leads`, `contact_submissions`, `whatsapp_messages`, `whatsapp_assignments`, `whatsapp_opt_outs`), pero **no** en las tablas del portal (`pessarocl`). Cualquier cruce busca los dos formatos.
- Las columnas `date` (no `timestamptz`) son días de calendario: nunca `new Date(cadena)` sin hora ni `toISOString()` para calcularlas o mostrarlas — ver `CHANGELOG_CRM.md` (2026-08-14).
- Antes de tocar el switch de CAPTCHA/Attack Protection de Supabase Auth: afecta a los 4 frontends del proyecto compartido a la vez. Ver `SUPABASE_COMPARTIDO.md`.
- Trabajo en `staging` o ramas `feature/*`. Los merges a `master` son decisión humana.

## Índice de documentación

| Archivo | Contenido |
|---|---|
| `SUPABASE_COMPARTIDO.md` | Lo que no se puede decidir mirando solo este repo — duplicado literal en `pessarocl`. |
| `README.md` | Presentación del proyecto, alcance funcional, stack real (verificado contra el código, no contra planes previos), estructura de carpetas, despliegue. |
| `PESSARO_CRM_INFRASTRUCTURE.md` | **Documento vivo** — tablas, RLS, Edge Functions, hosting, integraciones externas y mejoras pendientes. Fuente de verdad de infraestructura del CRM. |
| `PESSARO_INFRASTRUCTURE_v1.7.md` | Foto consolidada del 2026-08-13, ya **no** es fuente de verdad (lo dice el propio archivo) — solo útil para la parte de sitio público/Educación que no repite `PESSARO_CRM_INFRASTRUCTURE.md`. |
| `CHANGELOG_CRM.md` | Changelog corriente de fixes/features, con causa raíz de cada uno. |
| `WHATSAPP_INTEGRATION.md` | Arquitectura completa de la integración WhatsApp (webhook, envío, modelo de datos). |
| `ANALISIS_DIARIO_INSTRUMENTOS.md` | Módulo de análisis diario de instrumentos (tablas, cron, RLS separado por audiencia). |
| `SPEC_SOPORTE_TICKETS_OTP_2026_07_19.md`, `SPEC_SOPORTE_TICKETS_OTP v1.2.md` | Spec funcional del módulo de Soporte. |
| `SPEC_CALENDARIO_THUNDERBIRD.md` | Spec de integración de calendario. |
| `WAFINANCE_CLAUDE_DESIGN_BRIEF.md` | Brief de diseño de WAFinance. |
