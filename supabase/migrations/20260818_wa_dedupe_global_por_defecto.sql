-- ============================================================================
-- Migración: la política por defecto de repetición pasa a 'global' 30 días
-- Fecha: 2026-08-18
--
-- 20260818_wa_campaign_recipients.sql dejó el valor por defecto en 'campaign',
-- que sólo evita repetir DENTRO de la misma campaña. La regla de la casa es
-- más estricta: a un contacto que recibió cualquier campaña en los últimos
-- 30 días no se le vuelve a escribir, venga de la campaña que venga.
--
-- Ojo con dedupe_days: para los alcances 'template' y 'global', NULL significa
-- "sin límite de tiempo" en whatsapp-send. Si sólo se cambiara dedupe_scope,
-- una campaña creada fuera del formulario heredaría 'global' + NULL y dejaría
-- fuera a todo el que haya recibido algo alguna vez. Por eso los dos valores
-- por defecto se cambian juntos.
--
-- Las campañas ya existentes NO se tocan: las tres están 'completed' y son
-- historial. Cambiarles la política retroactivamente no tendría efecto (una
-- campaña completada no se reenvía) y falsearía con qué reglas se enviaron.
-- ============================================================================

ALTER TABLE whatsapp_campaigns ALTER COLUMN dedupe_scope SET DEFAULT 'global';
ALTER TABLE whatsapp_campaigns ALTER COLUMN dedupe_days  SET DEFAULT 30;

COMMENT ON COLUMN whatsapp_campaigns.dedupe_scope IS
  'campaign = no repetir dentro de esta campaña; template = ni la misma plantilla en dedupe_days; global = ni ninguna campaña en dedupe_days. Por defecto global.';
COMMENT ON COLUMN whatsapp_campaigns.dedupe_days IS
  'Ventana en días para dedupe_scope template/global. Por defecto 30. Nulo con esos alcances = sin límite de tiempo.';
