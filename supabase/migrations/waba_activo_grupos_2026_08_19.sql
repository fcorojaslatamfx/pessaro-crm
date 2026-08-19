-- ============================================================================
-- Migración: bandera waba_activo en grupos de contactos (+ subgrupos)
-- Fecha: 2026-08-19
--
-- El webhook de WABA (whatsapp-webhook, repo pessarocl) decidía a qué grupo
-- podía responder el bot comparando contra un único UUID guardado en el
-- secret WABA_PRODUCCION_GRUPO: un solo grupo activo a la vez, y cambiar de
-- grupo exigía editar el secret (fuera del alcance del clasificador de
-- permisos de Claude Code) y esperar el reinicio de la función.
--
-- send_campaign (whatsapp-send) ya soporta enviar a varios grupos a la vez
-- (target_filter.contact_group_ids): el límite de "un solo grupo" era
-- artificial y solo afectaba si el bot contestaba los mensajes entrantes.
--
-- waba_activo mueve esa decisión a la base: cualquier grupo con la bandera en
-- true recibe respuesta del bot para sus contactos. Default false a propósito
-- -- un grupo nuevo no debe empezar a recibir respuestas automáticas sin que
-- alguien lo decida. No reemplaza WABA_PRODUCCION_ACTIVO (apagado de
-- emergencia global).
--
-- Cascada: activar un grupo PADRE activa también a sus subgrupos (así se
-- puede prender toda una cartera de una vez sin marcar subgrupo por
-- subgrupo). Activar solo un SUBGRUPO no activa al padre ni a sus hermanos.
-- Se apoya en la invariante de un solo nivel de anidamiento que ya impone el
-- trigger trg_crm_grupos_un_solo_nivel (20260818_subgrupos_contactos.sql):
-- un LEFT JOIN a un nivel de padre alcanza, no hace falta recursión.
-- ============================================================================

ALTER TABLE crm_contact_groups
  ADD COLUMN IF NOT EXISTS waba_activo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN crm_contact_groups.waba_activo IS
  'true = el bot de WABA en producción (whatsapp-webhook, repo pessarocl) responde a los contactos de este grupo. Activar un grupo padre cascada a sus subgrupos (ver waba_contacto_en_grupo_activo). No reemplaza el apagado de emergencia WABA_PRODUCCION_ACTIVO.';

CREATE OR REPLACE FUNCTION waba_contacto_en_grupo_activo(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM crm_contact_group_members m
    JOIN crm_contacts c        ON c.id = m.contact_id
    JOIN crm_contact_groups g  ON g.id = m.group_id
    LEFT JOIN crm_contact_groups gp ON gp.id = g.parent_id
    WHERE c.phone IN (p_phone, '+' || p_phone)
      AND (g.waba_activo OR COALESCE(gp.waba_activo, false))
  );
$$;

COMMENT ON FUNCTION waba_contacto_en_grupo_activo(text) IS
  'true si el teléfono pertenece a un grupo (o subgrupo cuyo padre esté activo) con waba_activo. La llama whatsapp-webhook con service_role, así que ignora RLS a propósito: el bot tiene que ver los grupos de todos los asesores, no solo los propios.';
