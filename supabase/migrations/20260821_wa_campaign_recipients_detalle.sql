-- ============================================================================
-- Migración: detalle de estado por destinatario en el reporte de campañas WABA
-- Fecha: 2026-08-21
--
-- Problema: el reporte de una campaña sólo mostraba contadores agregados
-- (whatsapp_campaigns.sent_count/delivered_count/read_count/failed_count).
-- No había forma de ver, destinatario por destinatario, quién recibió, quién
-- leyó, cuál número falló (y por qué) o quién pidió la baja después.
--
-- Ese detalle vive hoy en whatsapp_messages.status (sent/delivered/read/failed),
-- que el webhook actualiza por meta_message_id — pero su RLS es por asesor
-- asignado (super_admin OR assigned_to en whatsapp_assignments), así que un
-- asesor sin conversación asignada no vería nada aunque sí haya recibido el
-- envío masivo de una campaña.
--
-- Solución: espejar ese estado en whatsapp_campaign_recipients, que ya es
-- legible por cualquier staff interno (policy wa_campaign_recipients_select,
-- is_crm_staff()) porque el reporte de campañas es una vista de equipo, no
-- una bandeja 1:1. Mismo patrón que el trigger recalc_wa_campaign_counters()
-- de 20260811_wa_campaigns_optout.sql: se resuelve con un trigger en la base
-- para no depender de que el webhook (que vive en pessarocl, ver
-- SUPABASE_COMPARTIDO.md) sepa nada de esta tabla.
--
-- La baja (whatsapp_opt_outs) no se duplica acá: ya es de lectura libre para
-- staff (policy staff_read_optouts) y es global por teléfono, no por campaña,
-- así que el frontend la cruza en la consulta del detalle.
-- ============================================================================

ALTER TABLE whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS status        text CHECK (status IN ('sent','delivered','read','failed')),
  ADD COLUMN IF NOT EXISTS delivered_at  timestamptz,
  ADD COLUMN IF NOT EXISTS read_at       timestamptz,
  ADD COLUMN IF NOT EXISTS error_code    text,
  ADD COLUMN IF NOT EXISTS error_message text;

COMMENT ON COLUMN whatsapp_campaign_recipients.status IS
  'Espejo de whatsapp_messages.status para outcome=sent, sincronizado por trigger. NULL en filas skipped_*/failed de outcome (esas ya lo dicen en outcome/error).';
COMMENT ON COLUMN whatsapp_campaign_recipients.error_code IS
  'Error de entrega posterior al envío (ej. número no en WhatsApp), distinto de "error" que es el rechazo de Meta al momento de enviar.';

CREATE INDEX IF NOT EXISTS wa_campaign_recipients_meta_msg_idx
  ON whatsapp_campaign_recipients (meta_message_id) WHERE meta_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wa_campaign_recipients_status_idx
  ON whatsapp_campaign_recipients (wa_campaign_id, status);

-- ── Trigger: mantener el espejo al día cuando cambia whatsapp_messages.status ──
CREATE OR REPLACE FUNCTION sync_wa_campaign_recipient_status() RETURNS trigger AS $fn$
BEGIN
  IF NEW.wa_campaign_id IS NULL OR NEW.meta_message_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE whatsapp_campaign_recipients r SET
    status        = NEW.status,
    delivered_at  = CASE WHEN NEW.status IN ('delivered','read') THEN COALESCE(r.delivered_at, now()) ELSE r.delivered_at END,
    read_at       = CASE WHEN NEW.status = 'read' THEN COALESCE(r.read_at, now()) ELSE r.read_at END,
    error_code    = CASE WHEN NEW.status = 'failed' THEN NEW.error_code ELSE r.error_code END,
    error_message = CASE WHEN NEW.status = 'failed' THEN NEW.error_message ELSE r.error_message END
  WHERE r.meta_message_id = NEW.meta_message_id;

  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_wa_campaign_recipient_status ON whatsapp_messages;
CREATE TRIGGER trg_sync_wa_campaign_recipient_status
  AFTER INSERT OR UPDATE OF status ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION sync_wa_campaign_recipient_status();

-- ── Backfill: lo que ya se envió antes de esta migración ────────────────────
UPDATE whatsapp_campaign_recipients
   SET status = 'sent'
 WHERE outcome = 'sent' AND status IS NULL;

-- Sin updated_at en whatsapp_messages, now() es la mejor aproximación posible
-- para delivered_at/read_at de mensajes ya entregados/leídos antes de esta
-- migración; a partir de acá el trigger registra el momento real.
UPDATE whatsapp_campaign_recipients r
   SET status        = m.status,
       delivered_at  = CASE WHEN m.status IN ('delivered','read') THEN now() ELSE r.delivered_at END,
       read_at       = CASE WHEN m.status = 'read' THEN now() ELSE r.read_at END,
       error_code    = CASE WHEN m.status = 'failed' THEN m.error_code ELSE r.error_code END,
       error_message = CASE WHEN m.status = 'failed' THEN m.error_message ELSE r.error_message END
  FROM whatsapp_messages m
 WHERE r.meta_message_id IS NOT NULL
   AND m.meta_message_id = r.meta_message_id;
