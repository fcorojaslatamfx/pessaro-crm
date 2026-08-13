-- ============================================================================
-- Migración: whatsapp_templates preparada para sincronizar desde Meta
-- Fecha: 2026-08-11
--
-- Contexto: la tabla estaba vacía y con UNIQUE(template_name), lo que impide
-- tener la misma plantilla en varios idiomas (Meta sí lo permite: la clave
-- real de una plantilla es nombre + idioma).
--
-- Cambios:
--   1. UNIQUE(template_name) -> UNIQUE(template_name, language)
--   2. Columnas nuevas para trazabilidad del sync:
--      - parameter_format: POSITIONAL ({{1}}) o NAMED ({{nombre}})
--      - meta_template_id: id de la plantilla en Meta
--      - synced_at: última vez que la fila se refrescó desde Meta
-- ============================================================================

ALTER TABLE whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_template_name_key;

ALTER TABLE whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_name_language_key UNIQUE (template_name, language);

ALTER TABLE whatsapp_templates
  ADD COLUMN IF NOT EXISTS parameter_format text DEFAULT 'POSITIONAL',
  ADD COLUMN IF NOT EXISTS meta_template_id text,
  ADD COLUMN IF NOT EXISTS synced_at        timestamptz;

COMMENT ON TABLE  whatsapp_templates IS 'Catálogo de plantillas de WhatsApp. Se llena con la action sync_templates de la Edge Function whatsapp-send; no editar a mano (el sync sobrescribe).';
COMMENT ON COLUMN whatsapp_templates.status IS 'Estado en Meta: APPROVED | PENDING | REJECTED | PAUSED | DELETED. DELETED lo pone el sync cuando la plantilla ya no existe en Meta.';
