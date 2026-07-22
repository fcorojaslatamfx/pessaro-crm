# 🎫 SPEC — Módulo Soporte: Tickets + OTP (crm.pessaro.cl)

**Versión:** 1.0 · **Fecha:** 2026-07-19
**Documento base:** PESSARO_CRM_INFRASTRUCTURE.md v1.6 (2026-07-02)
**Estado:** 📝 Pendiente de aprobación — nada aplicado en Supabase ni en repos
**Flujo:** staging-first obligatorio (rama `staging` + Vercel preview → aprobación → `master`)

---

## 1. Objetivo y alcance

Sistema de tickets de soporte integrado al CRM, con verificación OTP del cliente, usando exclusivamente recursos propios (Supabase + Vercel + GitHub + Resend).

| Fase | Canal OTP / notificación | Estado |
|---|---|---|
| **Fase 1** | Email vía Resend (`send@pessaro.cl`, dominio verificado) | Este spec |
| **Fase 2** | SMS vía Mensatek (API) — solo SMS; WhatsApp sigue vía Meta Cloud API | Diferida |

**Decisiones tomadas (2026-07-19):**
1. Portal de tickets en rutas de `crm.pessaro.cl` (`/soporte`), NO subdominio `wafinance.pessaro.cl`. El link de Google AI Mode que originó esta iniciativa asumía un subdominio inexistente — inconsistencia con §Vercel Hosting del MD.
2. Se reutiliza el patrón OTP de `wafinance_otp` v6 (§Edge Functions activos), no se crea lógica paralela desde cero.
3. Mensatek NO reemplaza Meta WhatsApp Cloud API (§Estado de integraciones externas — verificación Meta pendiente, crítica #1). Solo aporta SMS.

---

## 2. Migración SQL — `support_tickets_2026_07_19`

> Precaución: instancia Supabase única (`ldlflxujrjihiybrcree`) compartida con producción. Solo se crean objetos nuevos; cero ALTER sobre tablas existentes. Riesgo para flujo actual: nulo.

### 2.1 Tablas

```sql
-- Secuencia para número legible de ticket
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1;

CREATE TABLE support_tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number  text UNIQUE NOT NULL DEFAULT ('PSR-' || lpad(nextval('support_ticket_seq')::text, 5, '0')),
  contact_id     uuid REFERENCES crm_contacts(id),          -- NULL si el email no matchea un contacto
  client_email   text NOT NULL,
  client_phone   text,
  client_name    text,
  subject        text NOT NULL,
  category       text NOT NULL DEFAULT 'general'
                 CHECK (category IN ('trading','cuenta','deposito','retiro','tecnico','general')),
  priority       text NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('baja','normal','alta','urgente')),
  status         text NOT NULL DEFAULT 'abierto'
                 CHECK (status IN ('abierto','en_proceso','cerrado')),
  assigned_to    uuid REFERENCES crm_staff_profiles(id),    -- ⚠️ FK a crm_staff_profiles.id, NUNCA auth.users (aprendizaje clave MD)
  team_id        uuid REFERENCES crm_teams(id),
  otp_verified   boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  closed_at      timestamptz
);

CREATE TABLE support_ticket_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type     text NOT NULL CHECK (sender_type IN ('client','staff','system')),
  sender_staff_id uuid REFERENCES crm_staff_profiles(id),   -- NULL si sender_type = client/system
  content         text NOT NULL,
  attachment_path text,                                      -- Storage bucket support-attachments
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_otp_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email  text NOT NULL,
  client_phone  text,
  channel       text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms')),  -- 'sms' se activa en Fase 2
  code_hash     text NOT NULL,                               -- SHA-256, nunca el código en claro
  attempts      int  NOT NULL DEFAULT 0,                     -- máx 5
  expires_at    timestamptz NOT NULL,                        -- now() + 10 min
  verified_at   timestamptz,
  session_token text UNIQUE,                                 -- emitido al verificar; TTL 24h
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_status   ON support_tickets(status);
CREATE INDEX idx_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX idx_tickets_email    ON support_tickets(client_email);
CREATE INDEX idx_msgs_ticket      ON support_ticket_messages(ticket_id);
```

### 2.2 Triggers

```sql
-- updated_at automático
CREATE OR REPLACE FUNCTION touch_support_ticket() RETURNS trigger AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER trg_support_ticket_touch
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION touch_support_ticket();
```

Al crear ticket con `contact_id` resuelto, el Edge Function inserta entrada en `contact_activity_log` (`activity_type = 'support_ticket'`) — coherente con §Contactos (historial de actividades).

### 2.3 Storage

Bucket nuevo `support-attachments` (privado, 5MB, jpg/png/webp/pdf) — patrón `whatsapp-attachments`.

---

## 3. RLS

Los clientes NO usan Supabase Auth: acceden solo vía Edge Functions con `session_token` (patrón WAFinance). Las tablas quedan cerradas a `anon`; el service role de los Edge Functions opera por encima de RLS.

```sql
ALTER TABLE support_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_otp_sessions    ENABLE ROW LEVEL SECURITY;

-- ⚠️ Aprendizajes MD: DROP + CREATE (no IF NOT EXISTS); SECURITY DEFINER helpers, nunca EXISTS sobre la misma tabla (42P17)

DROP POLICY IF EXISTS staff_read_tickets ON support_tickets;
CREATE POLICY staff_read_tickets ON support_tickets FOR SELECT
  USING ( is_super_admin() OR (is_crm_staff() AND assigned_to = (get_my_profile()).id) );

DROP POLICY IF EXISTS staff_update_tickets ON support_tickets;
CREATE POLICY staff_update_tickets ON support_tickets FOR UPDATE
  USING ( is_super_admin() OR (is_crm_staff() AND assigned_to = (get_my_profile()).id) );

DROP POLICY IF EXISTS staff_read_msgs ON support_ticket_messages;
CREATE POLICY staff_read_msgs ON support_ticket_messages FOR SELECT
  USING ( is_super_admin() OR is_crm_staff() );

DROP POLICY IF EXISTS staff_insert_msgs ON support_ticket_messages;
CREATE POLICY staff_insert_msgs ON support_ticket_messages FOR INSERT
  WITH CHECK ( is_crm_staff() AND sender_type = 'staff' );

-- support_otp_sessions: sin políticas → solo service role (Edge Functions)
```

Nota: doble capa obligatoria (aprendizaje MD 2026-07-02) — el filtrado por asesor/equipo se refuerza también server-side en los Edge Functions, nunca solo en frontend. Verificar firma exacta de `get_my_profile()` antes de aplicar (retorna perfil compuesto; ajustar sintaxis `(get_my_profile()).id` si difiere).

---

## 4. Edge Functions (nuevas)

| Función | verify_jwt | Propósito |
|---|---|---|
| `support_otp` v1 | false | `action: request` → genera código 6 dígitos, hash SHA-256, envía vía Resend (Fase 1). `action: verify` → valida, emite `session_token` (TTL 24h). Rate limit: 3 solicitudes/10 min por email, 5 intentos por código. Base: estructura de `wafinance_otp` v6. |
| `support_tickets` v1 | false | API cliente con `session_token`: `create_ticket`, `list_my_tickets` (por email verificado), `get_ticket`, `add_message`. Server-side: resuelve `contact_id` por email contra `crm_contacts`, hereda `assigned_to`/`team_id` del asesor del contacto si existe; si no, asigna a super_admin (patrón `whatsapp-webhook`). |
| `support_notify` v1 | true | Al crear ticket / nuevo mensaje de cliente → email al asesor asignado vía Resend + reutiliza `push_notifications_2026_02_27` v24 para fan-out. Cron opcional de tickets sin respuesta >24h (pg_cron, patrón `task_notifications`). |
| `mensatek_send` v1 — **Fase 2** | true | Wrapper API Mensatek para SMS (OTP + avisos). Secret `MENSATEK_API_KEY` en Vault → ⚠️ requiere redeploy tras agregarse (aprendizaje MD). |

Secrets Fase 1: ninguno nuevo (Resend ya configurado para `crm_send_email`).

---

## 5. Frontend — repo `pessaro-crm`, rama `staging`

| Archivo | Acción | Contenido |
|---|---|---|
| `src/pages/SupportPortal.jsx` | NUEVO | Página pública `/soporte`: form (email, asunto, categoría) → OTP → creación de ticket. Estilo Premium-Fintech coherente con `WAFinanceChat.jsx`. |
| `src/pages/SupportTicketView.jsx` | NUEVO | `/soporte/ticket/{ticket_number}`: hilo del ticket, respuesta del cliente, realtime sobre `support_ticket_messages`. |
| `src/components/support/SupportInbox.jsx` | NUEVO | Módulo staff en el CRM: lista con filtros (Abiertos/En proceso/Cerrados/Míos), asignación de asesor (solo super_admin, patrón Contactos), respuesta inline, cierre. |
| `src/App.jsx` | EDITAR | Rutas públicas `/soporte/*` en el root `<Routes>` fuera del Layout (⚠️ aprendizaje React Router v6 del MD) + entrada de menú "Soporte" para staff + módulo en `team_tools` si aplica. |

Realtime: canal Supabase sobre `support_ticket_messages` filtrado por `ticket_id` (patrón WAFinance Fase 1).

**Validación pre-push obligatoria (§Instrucciones críticas):**
```bash
grep -rnE '^(<{7}|={7}|>{7})' src/ --exclude=index.css
npx esbuild --loader:.jsx=jsx --bundle=false src/App.jsx --outfile=/tmp/out.js
git log origin/master..origin/staging --oneline   # verificar sincronía antes de trabajar en staging
```

---

## 6. Fase 2 — Mensatek (diferida)

1. **Alcance:** OTP por SMS (`channel = 'sms'` en `support_otp_sessions`, columna ya prevista) + avisos SMS de respuesta de ticket.
2. **Qué NO hace:** WhatsApp. Meta Cloud API sigue siendo el canal WA oficial (número `+56 9 2207 1511`); duplicarlo con Mensatek crearía dos vías WA inconsistentes.
3. **Requisitos previos:** cuenta Mensatek, API key, evaluación de costo por SMS a Chile, alta del secret en Vault + redeploy.
4. **Integración:** `mensatek_send` v1 + registro como proveedor SMS en `push_notifications_2026_02_27` (hoy declara fan-out SMS sin proveedor — hueco documental a cerrar).

---

## 7. Plan de implementación (checklist)

1. ☐ Aprobación de este spec por Francisco
2. ☐ `apply_migration` `support_tickets_2026_07_19` (tablas + triggers + RLS + bucket)
3. ☐ Deploy `support_otp` v1 → prueba OTP email end-to-end
4. ☐ Deploy `support_tickets` v1 → prueba create/list/message vía curl
5. ☐ Deploy `support_notify` v1 → verificar email al asesor
6. ☐ Frontend en rama `staging` → Vercel preview
7. ☐ QA en preview: flujo cliente completo + inbox staff + RLS (asesor no ve tickets ajenos)
8. ☐ Revisión y aprobación explícita → merge a `master`
9. ☐ Actualizar `PESSARO_CRM_INFRASTRUCTURE.md` (ver §8)

---

## 8. Actualización documental requerida — `PESSARO_CRM_INFRASTRUCTURE.md`

| Sección | Cambio |
|---|---|
| Tabla de contenidos + Alcance actual | Agregar "Soporte (Tickets OTP)" |
| §Tablas principales | Nuevo bloque: `support_tickets`, `support_ticket_messages`, `support_otp_sessions` |
| §Storage buckets | Agregar `support-attachments` |
| §RLS | Agregar políticas de soporte |
| §Edge Functions activos | Agregar `support_otp`, `support_tickets`, `support_notify` (+ `mensatek_send` en Fase 2) |
| §Estado de integraciones externas | Fase 2: fila Mensatek (SMS) con estado |
| §Mejoras pendientes | Agregar "Fase 2 Mensatek SMS" en 🟡 Importantes |
| §Funcionalidad operativa | Nueva subsección Soporte |

---

## 9. 🤖 Instrucciones para Claude Code — creación de archivos (SOLO archivos, sin commit ni deploy)

> **Contexto de ejecución:** Francisco no tiene acceso al repo local en este momento. Claude Code debe **únicamente crear/editar los archivos** listados abajo dentro del clon local de `pessaro-crm`. **PROHIBIDO en esta pasada:** `git commit`, `git push`, `supabase functions deploy`, `apply_migration` o cualquier mutación en Supabase/Vercel. El deploy y los commits se harán en una sesión posterior, al reconectar con el repo local, previa aprobación explícita.

### 9.1 Preparación

1. Verificar rama: `git fetch origin && git checkout staging` y confirmar sincronía con `git log origin/master..origin/staging --oneline` (§Instrucciones críticas del MD).
2. Leer `PESSARO_CRM_INFRASTRUCTURE.md` v1.6 y este SPEC completo antes de escribir código. Nunca asumir información no documentada.
3. Reutilizar como referencia de patrones: `supabase/functions/wafinance_otp` (OTP), `src/pages/WAFinanceChat.jsx` (flujo público OTP→chat realtime), `src/components/whatsapp/WAFinanceChatInbox.jsx` (inbox staff). ⚠️ Rutas reales verificadas 2026-07-21 — las del MD §GitHub Repos están desactualizadas.

### 9.2 Archivos a crear

| # | Archivo | Contenido |
|---|---|---|
| 1 | `supabase/migrations/20260721_support_tickets.sql` | SQL completo de §2 (secuencia, `support_tickets`, `support_ticket_messages`, `support_otp_sessions`, índices, trigger `touch_support_ticket`) + RLS de §3. NO ejecutar; solo dejar el archivo listo para `apply_migration`. |
| 2 | `supabase/functions/support_otp/index.ts` | Edge Function §4: `action: request` (código 6 dígitos, hash SHA-256, envío vía Resend desde `send@pessaro.cl`, rate limit 3/10min) y `action: verify` (máx 5 intentos, emite `session_token` TTL 24h). Base: estructura de `wafinance_otp` v6. CORS igual al resto de funciones públicas. `verify_jwt: false`. |
| 3 | `supabase/functions/support_tickets/index.ts` | Edge Function §4: `create_ticket`, `list_my_tickets`, `get_ticket`, `add_message` — todas validando `session_token` server-side. Resuelve `contact_id` por email contra `crm_contacts`; hereda asesor/equipo o asigna a super_admin (patrón `whatsapp-webhook`). Inserta en `contact_activity_log` si hay contacto. `verify_jwt: false`. |
| 4 | `supabase/functions/support_notify/index.ts` | Edge Function §4: notificación email al asesor vía Resend al crear ticket / mensaje de cliente; reutiliza patrón de `push_notifications_2026_02_27`. `verify_jwt: true`. |
| 5 | `src/pages/SupportPortal.jsx` | Página pública `/soporte`: form (nombre, email, teléfono opcional, categoría, asunto, mensaje) → OTP email → creación de ticket → redirección al hilo. Estilo Premium-Fintech coherente con `WAFinanceChat.jsx` (paleta navy `#0a1628`, accent `#6c5ce7`, gold `#f0a500`). |
| 6 | `src/pages/SupportTicketView.jsx` | `/soporte/ticket/{ticket_number}`: hilo de mensajes, respuesta del cliente, realtime Supabase sobre `support_ticket_messages` filtrado por `ticket_id` (patrón WAFinance). Requiere `session_token` vigente; si expiró, re-OTP. |
| 7 | `src/components/support/SupportInbox.jsx` | Módulo staff: lista de tickets con filtros (Abiertos/En proceso/Cerrados/Míos), badge de no leídos, asignación de asesor (solo super_admin, dropdown patrón Contactos), respuesta inline, cierre de ticket. |

### 9.3 Archivo a editar

`src/App.jsx` (⚠️ monolito ~4.700 líneas — **merge y complementar, jamás reemplazar contenido existente**):

1. Import lazy de `SupportPortal`, `SupportTicketView`, `SupportInbox`.
2. Rutas públicas `/soporte` y `/soporte/ticket/:ticketNumber` en el **root `<Routes>`, fuera del Layout** (aprendizaje React Router v6 del MD).
3. Entrada de menú "Soporte" para staff → `SupportInbox` (visibilidad: todo staff; acciones de asignación solo super_admin).

### 9.4 Validación final (obligatoria, dentro de la misma pasada)

```bash
npx esbuild --loader:.jsx=jsx --bundle=false src/App.jsx --outfile=/tmp/out.js
npx esbuild --loader:.jsx=jsx --bundle=false src/pages/SupportPortal.jsx --outfile=/tmp/out2.js
npx esbuild --loader:.jsx=jsx --bundle=false src/pages/SupportTicketView.jsx --outfile=/tmp/out3.js
npx esbuild --loader:.jsx=jsx --bundle=false src/components/support/SupportInbox.jsx --outfile=/tmp/out4.js
grep -rnE '^(<{7}|={7}|>{7})' src/ --exclude=index.css
```

Claude Code termina reportando: lista de archivos creados/editados, resultado de las validaciones y recordatorio de que **commit + push + apply_migration + deploy de las 3 Edge Functions quedan pendientes** para la sesión con acceso al repo.

### 9.5 Pasada posterior (cuando Francisco reconecte el repo local)

1. ☐ Revisión de archivos por Francisco
2. ☐ `apply_migration` `20260721_support_tickets`
3. ☐ Deploy `support_otp`, `support_tickets`, `support_notify` (respetar `verify_jwt` exacto de §4 — aprendizaje MD)
4. ☐ Commit + push a `staging` → QA en Vercel preview → aprobación → merge a `master`
5. ☐ Actualizar `PESSARO_CRM_INFRASTRUCTURE.md` según §8

---

**Autor:** Claude (sesión 2026-07-19, actualizado 2026-07-21 v1.1) · **Aprobación pendiente:** Francisco Rojas-Aranda
