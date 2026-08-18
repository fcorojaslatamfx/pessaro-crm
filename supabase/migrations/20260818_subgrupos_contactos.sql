-- ============================================================================
-- Migración: subgrupos dentro de un grupo de contactos
-- Fecha: 2026-08-18
--
-- Contexto: un grupo como «Radex Latam» junta 237 contactos que en la práctica
-- se trabajan por partes (por ciudad, por tanda de ingreso, por interés). Sin
-- subgrupos había que crear grupos sueltos sin relación entre sí, y al elegir
-- destinatarios de una campaña no se veía cuáles pertenecían al mismo bloque.
--
-- Modelo: auto-referencia parent_id. Un subgrupo es un grupo con padre; todo lo
-- demás (miembros, RLS, historial de traspasos) sigue igual, así que ni la
-- pertenencia ni los permisos cambian.
--
-- Regla: SÓLO UN NIVEL. Sin ella aparecen árboles de cuatro niveles que nadie
-- entiende al elegir a quién enviarle una campaña, y el conteo de destinatarios
-- deja de ser evidente. La regla vive en la base, no en el frontend, porque es
-- una invariante del modelo y no una comodidad de la pantalla.
-- ============================================================================

ALTER TABLE crm_contact_groups
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES crm_contact_groups(id) ON DELETE CASCADE;

-- ON DELETE CASCADE a propósito: un subgrupo sin padre queda huérfano y no hay
-- forma de encontrarlo en la interfaz. Borrar el padre borra sus subgrupos
-- (los contactos NO se tocan: sólo desaparece la agrupación).

CREATE INDEX IF NOT EXISTS crm_contact_groups_parent_idx
  ON crm_contact_groups (parent_id) WHERE parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION crm_grupos_un_solo_nivel() RETURNS trigger AS $fn$
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Un grupo no puede ser subgrupo de sí mismo';
  END IF;

  IF EXISTS (SELECT 1 FROM crm_contact_groups g
             WHERE g.id = NEW.parent_id AND g.parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Los subgrupos no pueden tener subgrupos: elige un grupo principal';
  END IF;

  IF EXISTS (SELECT 1 FROM crm_contact_groups g WHERE g.parent_id = NEW.id) THEN
    RAISE EXCEPTION 'Este grupo ya tiene subgrupos, así que no puede ser a su vez un subgrupo';
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_grupos_un_solo_nivel ON crm_contact_groups;
CREATE TRIGGER trg_crm_grupos_un_solo_nivel
  BEFORE INSERT OR UPDATE OF parent_id ON crm_contact_groups
  FOR EACH ROW EXECUTE FUNCTION crm_grupos_un_solo_nivel();

COMMENT ON COLUMN crm_contact_groups.parent_id IS
  'Grupo padre. Sólo se admite un nivel: un subgrupo no puede tener subgrupos (trigger trg_crm_grupos_un_solo_nivel).';
