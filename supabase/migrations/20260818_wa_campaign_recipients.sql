-- ============================================================================
-- Migración: registro de destinatarios por campaña WABA (no repetir envíos)
-- Fecha: 2026-08-18
--
-- Problema: no había forma fiable de saber a quién se le mandó qué campaña.
--   - whatsapp_messages.wa_campaign_id sólo deja fila cuando Meta ACEPTA el
--     envío; los fallidos y los bloqueados por opt-out no quedan en ninguna
--     parte.
--   - en un envío por grupo, lead_id se guarda en NULL a propósito (su FK
--     apunta a campaign_leads y el id es de crm_contacts), así que tampoco se
--     podía reconstruir "qué campañas recibió este contacto".
--
-- Consecuencia práctica: si el cron reintentaba una campaña, o si el asesor la
-- disparaba dos veces, el mismo cliente recibía el mismo mensaje otra vez.
--
-- Solución: whatsapp_campaign_recipients, que es a la vez el historial por
-- contacto y el candado contra el reenvío. UNIQUE(wa_campaign_id, phone) hace
-- imposible registrar dos veces al mismo número en la misma campaña.
--
-- Política de repetición, por campaña (whatsapp_campaigns.dedupe_scope):
--   'campaign' (por defecto) → no reenviar a quien ya recibió ESTA campaña
--   'template'               → tampoco a quien recibió esa misma plantilla
--                              en los últimos dedupe_days días
--   'global'                 → tampoco a quien recibió CUALQUIER campaña
--                              en los últimos dedupe_days días
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_campaign_id  uuid NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  -- Uno de los dos, según el origen del envío. Ninguno es obligatorio: lo que
  -- identifica al destinatario de verdad es el teléfono.
  contact_id      uuid REFERENCES crm_contacts(id)   ON DELETE SET NULL,
  lead_id         uuid REFERENCES campaign_leads(id) ON DELETE SET NULL,
  -- Sólo dígitos, igual que whatsapp_messages.client_phone y whatsapp_opt_outs
  phone           text NOT NULL,
  full_name       text,
  template_name   text,
  outcome         text NOT NULL CHECK (outcome IN ('sent','failed','skipped_opt_out','skipped_already_sent')),
  error           text,
  meta_message_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_campaign_recipients_camp_phone_key UNIQUE (wa_campaign_id, phone)
);

-- Consulta caliente: "¿este número ya recibió algo, y cuándo?"
CREATE INDEX IF NOT EXISTS wa_campaign_recipients_phone_idx
  ON whatsapp_campaign_recipients (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_campaign_recipients_contact_idx
  ON whatsapp_campaign_recipients (contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
-- Alcance 'template': el filtro es por plantilla + ventana de días
CREATE INDEX IF NOT EXISTS wa_campaign_recipients_template_idx
  ON whatsapp_campaign_recipients (template_name, created_at DESC) WHERE template_name IS NOT NULL;

ALTER TABLE whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- El staff lo lee (historial en la ficha y previsualización de la campaña).
-- Lo escribe la edge function con service role, que no pasa por RLS.
DROP POLICY IF EXISTS wa_campaign_recipients_select ON whatsapp_campaign_recipients;
CREATE POLICY wa_campaign_recipients_select ON whatsapp_campaign_recipients
  FOR SELECT USING ( is_crm_staff() );

COMMENT ON TABLE whatsapp_campaign_recipients IS
  'Un registro por destinatario y campaña, incluidos los omitidos. Historial por contacto y candado contra el reenvío.';
COMMENT ON COLUMN whatsapp_campaign_recipients.outcome IS
  'sent | failed | skipped_opt_out | skipped_already_sent';

-- ── Política de repetición por campaña ──────────────────────────────────────
ALTER TABLE whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS dedupe_scope text NOT NULL DEFAULT 'campaign',
  ADD COLUMN IF NOT EXISTS dedupe_days  integer;

ALTER TABLE whatsapp_campaigns DROP CONSTRAINT IF EXISTS whatsapp_campaigns_dedupe_scope_check;
ALTER TABLE whatsapp_campaigns ADD CONSTRAINT whatsapp_campaigns_dedupe_scope_check
  CHECK (dedupe_scope IN ('campaign','template','global'));

COMMENT ON COLUMN whatsapp_campaigns.dedupe_scope IS
  'campaign = no repetir dentro de esta campaña; template = ni la misma plantilla en dedupe_days; global = ni ninguna campaña en dedupe_days.';
COMMENT ON COLUMN whatsapp_campaigns.dedupe_days IS
  'Ventana en días para dedupe_scope template/global. Nulo con esos alcances = sin límite de tiempo.';

-- ── Backfill: lo ya enviado cuenta desde hoy ────────────────────────────────
-- Sin esto, la primera campaña posterior a la migración le volvería a escribir
-- a todos los que ya habían recibido algo, que es justo lo que se quiere evitar.
INSERT INTO whatsapp_campaign_recipients (
  wa_campaign_id, phone, full_name, template_name, outcome, meta_message_id, created_at)
SELECT DISTINCT ON (m.wa_campaign_id, regexp_replace(m.client_phone, '\D', '', 'g'))
  m.wa_campaign_id,
  regexp_replace(m.client_phone, '\D', '', 'g'),
  m.client_name,
  m.template_name,
  CASE WHEN m.status = 'failed' THEN 'failed' ELSE 'sent' END,
  m.meta_message_id,
  m.created_at
FROM whatsapp_messages m
WHERE m.wa_campaign_id IS NOT NULL
  AND coalesce(regexp_replace(m.client_phone, '\D', '', 'g'), '') <> ''
ORDER BY m.wa_campaign_id, regexp_replace(m.client_phone, '\D', '', 'g'), m.created_at
ON CONFLICT (wa_campaign_id, phone) DO NOTHING;

-- Enlazar con el contacto del CRM cuando el teléfono coincide, para que la
-- ficha pueda mostrar "campañas recibidas" también del histórico.
UPDATE whatsapp_campaign_recipients r
   SET contact_id = c.id
  FROM crm_contacts c
 WHERE r.contact_id IS NULL
   AND regexp_replace(c.phone, '\D', '', 'g') = r.phone;
