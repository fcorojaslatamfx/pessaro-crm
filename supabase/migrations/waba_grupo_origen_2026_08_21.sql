-- ============================================================================
-- waba_grupo_origen(phone): grupo/subgrupo de origen de un contacto WABA
-- Fecha: 2026-08-21
--
-- Mismo criterio que waba_contacto_en_grupo_activo() (waba_activo_grupos_
-- 2026_08_19.sql) pero devuelve la FILA del grupo en vez de un booleano: lo
-- necesita el bot educativo (pessarocl/_shared/waba_bot.ts,
-- sincronizarContactoCRM()) para saber en qué grupo/subgrupo meter al
-- contacto que acaba de confirmar su correo.
--
-- Devuelve como mucho una fila: si el teléfono está en más de un grupo activo
-- de WABA (no debería pasar en el piloto, un solo grupo a la vez), se queda
-- con el que tiene waba_activo=true directamente antes que el heredado del
-- padre.
-- ============================================================================

create or replace function waba_grupo_origen(p_phone text)
returns table(id uuid, name text, user_id uuid, parent_id uuid)
language sql
stable
set search_path = public
as $$
  select g.id, g.name, g.user_id, g.parent_id
  from crm_contact_group_members m
  join crm_contacts c        on c.id = m.contact_id
  join crm_contact_groups g  on g.id = m.group_id
  left join crm_contact_groups gp on gp.id = g.parent_id
  where c.phone in (p_phone, '+' || p_phone)
    and (g.waba_activo or coalesce(gp.waba_activo, false))
  order by g.waba_activo desc nulls last
  limit 1
$$;

comment on function waba_grupo_origen(text) is
  'Grupo/subgrupo de origen (waba_activo) de un teléfono, para atribuir un contacto nuevo del bot educativo. Ver waba_bot.ts sincronizarContactoCRM().';
