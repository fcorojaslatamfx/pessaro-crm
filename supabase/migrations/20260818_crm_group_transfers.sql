-- ============================================================================
-- Migración: traspaso de contactos entre grupos, con historial
-- Fecha: 2026-08-18
--
-- Contexto: los grupos (20260812_crm_contact_groups) sólo tenían alta y baja
-- de miembros, hechas con insert/delete directos desde la ficha. No quedaba
-- rastro: nadie podía responder "¿quién sacó a este cliente de Prospectos y
-- cuándo?", ni descargar la lista de los que se movieron de un grupo a otro.
--
-- Modelo:
--   crm_contact_group_transfers          → un registro por movimiento
--   transfer_contacts_between_groups()   → único camino para mover, atómico
--
-- Decisiones:
--   - from_group_id/to_group_id son NULLABLE y significan algo: from nulo es
--     un alta, to nulo es una baja. Así el historial cubre los tres casos con
--     una sola tabla.
--   - Además del id se guarda el NOMBRE del grupo en el momento del
--     movimiento. Los grupos se borran (ON DELETE SET NULL) y el historial no
--     puede quedar con dos columnas vacías y sin sentido.
--   - owner_id es el dueño del contacto, no quien lo movió. Es lo que decide
--     quién puede leer el historial: el asesor ve los movimientos de SUS
--     contactos aunque los haya movido el super admin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_contact_group_transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  -- Dueño del contacto al momento del movimiento; gobierna la lectura (RLS)
  owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  from_group_id   uuid REFERENCES crm_contact_groups(id) ON DELETE SET NULL,
  to_group_id     uuid REFERENCES crm_contact_groups(id) ON DELETE SET NULL,
  -- Copia del nombre: sobrevive al borrado del grupo
  from_group_name text,
  to_group_name   text,
  action          text NOT NULL CHECK (action IN ('mover','copiar','alta','baja')),
  note            text,
  moved_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_at        timestamptz NOT NULL DEFAULT now(),
  -- Un movimiento sin origen ni destino no es un movimiento
  CONSTRAINT crm_contact_group_transfers_algun_grupo
    CHECK (from_group_id IS NOT NULL OR to_group_id IS NOT NULL
           OR from_group_name IS NOT NULL OR to_group_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS crm_contact_group_transfers_contact_idx
  ON crm_contact_group_transfers (contact_id, moved_at DESC);
CREATE INDEX IF NOT EXISTS crm_contact_group_transfers_fecha_idx
  ON crm_contact_group_transfers (moved_at DESC);
CREATE INDEX IF NOT EXISTS crm_contact_group_transfers_from_idx
  ON crm_contact_group_transfers (from_group_id) WHERE from_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_contact_group_transfers_to_idx
  ON crm_contact_group_transfers (to_group_id) WHERE to_group_id IS NOT NULL;

ALTER TABLE crm_contact_group_transfers ENABLE ROW LEVEL SECURITY;

-- Sólo lectura desde el cliente. Escribir es exclusivo de la RPC de abajo, que
-- es SECURITY DEFINER: así no hay forma de dejar un movimiento sin historial.
DROP POLICY IF EXISTS crm_contact_group_transfers_select ON crm_contact_group_transfers;
CREATE POLICY crm_contact_group_transfers_select ON crm_contact_group_transfers
  FOR SELECT USING (
    owner_id = auth.uid() OR moved_by = auth.uid() OR is_super_admin()
  );

COMMENT ON TABLE crm_contact_group_transfers IS
  'Historial de altas, bajas y traspasos de contactos entre grupos. Lo escribe transfer_contacts_between_groups().';

-- ── RPC: el único camino para mover contactos ───────────────────────────────
-- Devuelve {movidos, omitidos, accion}. Omite en silencio (y los cuenta) los
-- contactos que no son del llamante o que no estaban en el grupo de origen,
-- en vez de abortar el lote entero por una fila.
CREATE OR REPLACE FUNCTION transfer_contacts_between_groups(
  p_contact_ids uuid[],
  p_from_group  uuid    DEFAULT NULL,
  p_to_group    uuid    DEFAULT NULL,
  p_note        text    DEFAULT NULL,
  p_copiar      boolean DEFAULT false
) RETURNS jsonb AS $fn$
DECLARE
  v_from_name text; v_to_name text;
  v_owner     uuid;
  v_cid       uuid;
  v_movidos   int := 0;
  v_omitidos  int := 0;
  v_accion    text;
  v_nota      text := nullif(btrim(coalesce(p_note,'')), '');
BEGIN
  IF p_from_group IS NULL AND p_to_group IS NULL THEN
    RAISE EXCEPTION 'Indica al menos un grupo de origen o de destino';
  END IF;
  IF p_from_group IS NOT NULL AND p_from_group = p_to_group THEN
    RAISE EXCEPTION 'El grupo de origen y el de destino son el mismo';
  END IF;

  IF p_from_group IS NOT NULL THEN
    SELECT g.name INTO v_from_name FROM crm_contact_groups g
      WHERE g.id = p_from_group AND (g.user_id = auth.uid() OR is_super_admin());
    IF v_from_name IS NULL THEN
      RAISE EXCEPTION 'No existe el grupo de origen o no tienes permiso sobre él';
    END IF;
  END IF;

  IF p_to_group IS NOT NULL THEN
    SELECT g.name INTO v_to_name FROM crm_contact_groups g
      WHERE g.id = p_to_group AND (g.user_id = auth.uid() OR is_super_admin());
    IF v_to_name IS NULL THEN
      RAISE EXCEPTION 'No existe el grupo de destino o no tienes permiso sobre él';
    END IF;
  END IF;

  v_accion := CASE
    WHEN p_from_group IS NULL THEN 'alta'
    WHEN p_to_group   IS NULL THEN 'baja'
    WHEN p_copiar              THEN 'copiar'
    ELSE 'mover'
  END;

  FOREACH v_cid IN ARRAY coalesce(p_contact_ids, ARRAY[]::uuid[]) LOOP
    SELECT c.user_id INTO v_owner FROM crm_contacts c WHERE c.id = v_cid;
    -- coalesce: un contacto sin dueño (user_id nulo) daría NULL, y un IF NULL
    -- no entra en la rama, así que sin esto el contacto se colaría.
    IF NOT FOUND OR NOT (coalesce(v_owner = auth.uid(), false) OR is_super_admin()) THEN
      v_omitidos := v_omitidos + 1; CONTINUE;
    END IF;

    -- Sacar de un grupo al que no pertenece no es un movimiento, es ruido
    IF p_from_group IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM crm_contact_group_members m
       WHERE m.group_id = p_from_group AND m.contact_id = v_cid) THEN
      v_omitidos := v_omitidos + 1; CONTINUE;
    END IF;

    -- Un alta sobre alguien que ya está dentro tampoco lo es
    IF v_accion = 'alta' AND EXISTS (
      SELECT 1 FROM crm_contact_group_members m
       WHERE m.group_id = p_to_group AND m.contact_id = v_cid) THEN
      v_omitidos := v_omitidos + 1; CONTINUE;
    END IF;

    IF p_to_group IS NOT NULL THEN
      INSERT INTO crm_contact_group_members (group_id, contact_id, added_by)
      VALUES (p_to_group, v_cid, auth.uid())
      ON CONFLICT (group_id, contact_id) DO NOTHING;
    END IF;

    IF p_from_group IS NOT NULL AND NOT p_copiar THEN
      DELETE FROM crm_contact_group_members
       WHERE group_id = p_from_group AND contact_id = v_cid;
    END IF;

    INSERT INTO crm_contact_group_transfers (
      contact_id, owner_id, from_group_id, to_group_id,
      from_group_name, to_group_name, action, note, moved_by)
    VALUES (v_cid, v_owner, p_from_group, p_to_group,
      v_from_name, v_to_name, v_accion, v_nota, auth.uid());

    v_movidos := v_movidos + 1;
  END LOOP;

  RETURN jsonb_build_object('movidos', v_movidos, 'omitidos', v_omitidos, 'accion', v_accion);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION transfer_contacts_between_groups(uuid[], uuid, uuid, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION transfer_contacts_between_groups(uuid[], uuid, uuid, text, boolean) TO authenticated;

COMMENT ON FUNCTION transfer_contacts_between_groups(uuid[], uuid, uuid, text, boolean) IS
  'Mueve (o copia) contactos entre grupos dejando historial. from nulo = alta, to nulo = baja.';
