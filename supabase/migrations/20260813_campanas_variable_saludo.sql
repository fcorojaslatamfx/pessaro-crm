-- ─────────────────────────────────────────────────────────────────────────────
-- Qué se escribe en la variable {{1}} de la plantilla en un envío masivo
--
-- Hasta ahora era siempre la primera palabra del nombre del contacto. Con un
-- contacto llamado "Para pruebas WABA" el mensaje salía como "Hola, Para." La
-- plantilla de Meta estaba bien; el problema era el valor que ponía el CRM.
--
-- null  = automático (primer nombre del destinatario, con respaldo si no tiene)
-- texto = ese mismo texto para todos los destinatarios de la campaña
--
-- Las campañas existentes quedan en null, así que su comportamiento no cambia.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.whatsapp_campaigns
  add column if not exists body_variable text;

comment on column public.whatsapp_campaigns.body_variable is
  'Valor fijo para {{1}}. NULL = usar el primer nombre de cada destinatario';
