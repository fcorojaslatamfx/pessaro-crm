-- ============================================================================
-- Migración: envío de campañas WhatsApp + opt-out
-- Fecha: 2026-08-11
--
-- 1. whatsapp_opt_outs — registro de bajas. Hoy no existe ningún campo de
--    opt-out de WhatsApp en el esquema, pese a que campana_minimalist promete
--    en su pie 'Responde "Salir" para dejar de recibir mensajes'.
-- 2. whatsapp_campaigns.header_image_url — las plantillas con encabezado de
--    imagen (campana_minimalist) exigen la imagen en CADA envío.
-- 3. whatsapp_messages.wa_campaign_id — sin este vínculo no hay forma de
--    atribuir entregas/lecturas a la campaña que las originó.
-- 4. Trigger que recalcula los contadores de la campaña desde los mensajes.
--    Se hace en la base y no en el webhook para evitar carreras entre los
--    callbacks de estado que Meta manda en paralelo.
-- ============================================================================

-- ── 1. Opt-outs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_opt_outs (
  client_phone text PRIMARY KEY,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  source       text,   -- 'button' | 'text' | 'manual'
  raw_text     text
);

ALTER TABLE whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_read_optouts ON whatsapp_opt_outs;
CREATE POLICY staff_read_optouts ON whatsapp_opt_outs
  FOR SELECT USING ( is_crm_staff() );

-- Solo super_admin puede revertir una baja (dar de alta de nuevo)
DROP POLICY IF EXISTS superadmin_manage_optouts ON whatsapp_opt_outs;
CREATE POLICY superadmin_manage_optouts ON whatsapp_opt_outs
  FOR ALL USING ( is_super_admin() ) WITH CHECK ( is_super_admin() );

COMMENT ON TABLE whatsapp_opt_outs IS 'Clientes que pidieron no recibir más mensajes. whatsapp-send bloquea todo envío a estos números.';

-- ── 2. Imagen de encabezado por campaña ─────────────────────────────────────
ALTER TABLE whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS header_image_url text;

COMMENT ON COLUMN whatsapp_campaigns.header_image_url IS 'URL pública HTTPS de la imagen de encabezado. Obligatoria si la plantilla tiene header_type = IMAGE.';

-- ── 3. Vínculo mensaje → campaña de WhatsApp ────────────────────────────────
-- Ojo: whatsapp_messages.campaign_id ya existe pero apunta a campaigns(id),
-- que es la campaña de negocio, no la de WhatsApp. Por eso una columna nueva.
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS wa_campaign_id uuid REFERENCES whatsapp_campaigns(id);

CREATE INDEX IF NOT EXISTS idx_wa_messages_wa_campaign
  ON whatsapp_messages(wa_campaign_id) WHERE wa_campaign_id IS NOT NULL;

-- ── 4. Contadores de campaña recalculados desde los mensajes ────────────────
CREATE OR REPLACE FUNCTION recalc_wa_campaign_counters() RETURNS trigger AS $fn$
DECLARE cid uuid;
BEGIN
  cid := COALESCE(NEW.wa_campaign_id, OLD.wa_campaign_id);
  IF cid IS NULL THEN RETURN NULL; END IF;

  UPDATE whatsapp_campaigns c SET
    sent_count      = s.n_sent,
    delivered_count = s.n_delivered,
    read_count      = s.n_read,
    failed_count    = s.n_failed
  FROM (
    SELECT
      count(*) FILTER (WHERE status IN ('sent','delivered','read')) AS n_sent,
      count(*) FILTER (WHERE status IN ('delivered','read'))        AS n_delivered,
      count(*) FILTER (WHERE status = 'read')                       AS n_read,
      count(*) FILTER (WHERE status = 'failed')                     AS n_failed
    FROM whatsapp_messages
    WHERE wa_campaign_id = cid
  ) s
  WHERE c.id = cid;

  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_wa_campaign_counters ON whatsapp_messages;
CREATE TRIGGER trg_wa_campaign_counters
  AFTER INSERT OR UPDATE OF status ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION recalc_wa_campaign_counters();
