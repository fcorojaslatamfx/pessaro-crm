-- ============================================================================
-- Migración: tipo del grupo (personas / empresas / mixto)
-- Fecha: 2026-08-18
--
-- Los contactos ya distinguen persona y empresa (crm_contacts.contact_type),
-- pero el grupo no decía nada, y al armar una campaña no se veía si «Radex
-- Latam» era cartera de personas o de empresas — que cambia la plantilla y el
-- tono del mensaje.
--
-- 'mixto' es el valor por defecto y no un caso raro: los grupos que ya existen
-- se armaron sin este criterio, y marcarlos como personas o empresas sería
-- inventar un dato que nadie declaró.
-- ============================================================================

ALTER TABLE crm_contact_groups
  ADD COLUMN IF NOT EXISTS group_type text NOT NULL DEFAULT 'mixto';

ALTER TABLE crm_contact_groups DROP CONSTRAINT IF EXISTS crm_contact_groups_group_type_check;
ALTER TABLE crm_contact_groups ADD CONSTRAINT crm_contact_groups_group_type_check
  CHECK (group_type IN ('P2P', 'B2B', 'mixto'));

COMMENT ON COLUMN crm_contact_groups.group_type IS
  'P2P = personas, B2B = empresas, mixto = sin distinguir. Es una etiqueta del grupo: no restringe quién puede entrar.';
