-- ============================================================================
-- Migración: grupos de contactos
-- Fecha: 2026-08-12
--
-- Contexto: Contactos no tenía forma de segmentar. El asesor necesita agrupar
-- sus contactos (por interés, origen, etapa comercial) y usar esos grupos como
-- destino de campañas de WhatsApp.
--
-- Modelo:
--   crm_contact_groups         → el grupo, con dueño (user_id)
--   crm_contact_group_members  → N:N contra crm_contacts
--
-- Un contacto puede estar en varios grupos. El grupo es del asesor que lo crea;
-- el super_admin ve y administra los de todos, igual que con crm_contacts.
--
-- Nota: los grupos sólo agrupan filas reales de crm_contacts. Los formularios
-- web (contact_submissions) que el super_admin ve mezclados en la lista no son
-- contactos todavía, así que no se pueden agrupar hasta convertirlos.
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_contact_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  color       text NOT NULL DEFAULT '#6c5ce7',
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Dos asesores pueden tener cada uno su grupo "Prospectos"; el mismo asesor no.
  CONSTRAINT crm_contact_groups_user_name_key UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS crm_contact_group_members (
  group_id   uuid NOT NULL REFERENCES crm_contact_groups(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id)       ON DELETE CASCADE,
  added_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, contact_id)
);

-- La ficha del contacto pregunta "¿en qué grupos está?", que va por contact_id;
-- la PK sólo cubre el sentido group_id → contactos.
CREATE INDEX IF NOT EXISTS crm_contact_group_members_contact_idx
  ON crm_contact_group_members (contact_id);

CREATE INDEX IF NOT EXISTS crm_contact_groups_user_idx
  ON crm_contact_groups (user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE crm_contact_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_contact_groups_select ON crm_contact_groups;
CREATE POLICY crm_contact_groups_select ON crm_contact_groups
  FOR SELECT USING (auth.uid() = user_id OR is_super_admin());

DROP POLICY IF EXISTS crm_contact_groups_insert ON crm_contact_groups;
CREATE POLICY crm_contact_groups_insert ON crm_contact_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id OR is_super_admin());

DROP POLICY IF EXISTS crm_contact_groups_update ON crm_contact_groups;
CREATE POLICY crm_contact_groups_update ON crm_contact_groups
  FOR UPDATE USING (auth.uid() = user_id OR is_super_admin());

DROP POLICY IF EXISTS crm_contact_groups_delete ON crm_contact_groups;
CREATE POLICY crm_contact_groups_delete ON crm_contact_groups
  FOR DELETE USING (auth.uid() = user_id OR is_super_admin());

-- La membresía hereda el permiso del grupo: si ves el grupo, ves y editas
-- quién está dentro.
DROP POLICY IF EXISTS crm_contact_group_members_all ON crm_contact_group_members;
CREATE POLICY crm_contact_group_members_all ON crm_contact_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_contact_groups g
      WHERE g.id = crm_contact_group_members.group_id
        AND (g.user_id = auth.uid() OR is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contact_groups g
      WHERE g.id = crm_contact_group_members.group_id
        AND (g.user_id = auth.uid() OR is_super_admin())
    )
  );

COMMENT ON TABLE crm_contact_groups IS 'Grupos de contactos por asesor. El super_admin ve y administra los de todos.';
COMMENT ON TABLE crm_contact_group_members IS 'Pertenencia N:N de crm_contacts a crm_contact_groups.';
