-- ============================================================================
-- Migración: support_tickets_2026_07_19
-- Origen:    SPEC_SOPORTE_TICKETS_OTP_2026_07_19.md §2 y §3
-- Estado:    NO EJECUTADA — dejar lista para apply_migration en sesión posterior
-- Precaución: instancia Supabase única (ldlflxujrjihiybrcree) compartida con
--             producción. Solo se crean objetos NUEVOS; cero ALTER sobre
--             tablas existentes. Riesgo para flujo actual: nulo.
-- ============================================================================

-- ── 2.1 Tablas ───────────────────────────────────────────────────────────────

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
CREATE INDEX idx_otp_email        ON support_otp_sessions(client_email);
CREATE INDEX idx_otp_token        ON support_otp_sessions(session_token);

-- ── 2.2 Triggers ─────────────────────────────────────────────────────────────

-- updated_at automático
CREATE OR REPLACE FUNCTION touch_support_ticket() RETURNS trigger AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER trg_support_ticket_touch
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION touch_support_ticket();

-- Nota: al crear ticket con contact_id resuelto, el Edge Function support_tickets
-- inserta entrada en contact_activity_log (activity_type = 'support_ticket') —
-- coherente con §Contactos (historial de actividades). No requiere trigger SQL.

-- ── 2.3 Storage ──────────────────────────────────────────────────────────────
-- Bucket nuevo `support-attachments` (privado, 5MB, jpg/png/webp/pdf) — patrón
-- `whatsapp-attachments`. Crear vía Dashboard/API de Storage al aplicar esta
-- migración (no soportado directamente en SQL migration estándar).

-- ============================================================================
-- §3 RLS
-- ============================================================================
-- Los clientes NO usan Supabase Auth: acceden solo vía Edge Functions con
-- session_token (patrón WAFinance). Las tablas quedan cerradas a `anon`; el
-- service role de los Edge Functions opera por encima de RLS.

ALTER TABLE support_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_otp_sessions    ENABLE ROW LEVEL SECURITY;

-- ⚠️ Aprendizajes MD: DROP + CREATE (no IF NOT EXISTS); SECURITY DEFINER helpers,
-- nunca EXISTS sobre la misma tabla (42P17)
-- ⚠️ Verificar firma exacta de get_my_profile() antes de aplicar (retorna
-- perfil compuesto; ajustar sintaxis (get_my_profile()).id si difiere).

DROP POLICY IF EXISTS staff_read_tickets ON support_tickets;
CREATE POLICY staff_read_tickets ON support_tickets FOR SELECT
  USING ( is_super_admin() OR (is_crm_staff() AND assigned_to = ((get_my_profile())->>'id')::uuid) );

DROP POLICY IF EXISTS staff_update_tickets ON support_tickets;
CREATE POLICY staff_update_tickets ON support_tickets FOR UPDATE
  USING ( is_super_admin() OR (is_crm_staff() AND assigned_to = ((get_my_profile())->>'id')::uuid) );

-- Aislamiento por asesor vía EXISTS sobre support_tickets (tabla distinta a la
-- de la política → sin riesgo de recursión 42P17). Evita que un asesor lea/
-- escriba mensajes de tickets asignados a otro asesor.
DROP POLICY IF EXISTS staff_read_msgs ON support_ticket_messages;
CREATE POLICY staff_read_msgs ON support_ticket_messages FOR SELECT
  USING (
    is_super_admin() OR (
      is_crm_staff() AND EXISTS (
        SELECT 1 FROM support_tickets st
        WHERE st.id = support_ticket_messages.ticket_id
          AND st.assigned_to = ((get_my_profile())->>'id')::uuid
      )
    )
  );

DROP POLICY IF EXISTS staff_insert_msgs ON support_ticket_messages;
CREATE POLICY staff_insert_msgs ON support_ticket_messages FOR INSERT
  WITH CHECK (
    sender_type = 'staff' AND (
      is_super_admin() OR (
        is_crm_staff() AND EXISTS (
          SELECT 1 FROM support_tickets st
          WHERE st.id = support_ticket_messages.ticket_id
            AND st.assigned_to = ((get_my_profile())->>'id')::uuid
        )
      )
    )
  );

-- support_otp_sessions: sin políticas → solo service role (Edge Functions)

-- Nota: doble capa obligatoria (aprendizaje MD 2026-07-02) — el filtrado por
-- asesor/equipo se refuerza también server-side en los Edge Functions, nunca
-- solo en frontend.
