-- ─────────────────────────────────────────────────────────────────────────────
-- Perfil comercial del contacto (P2P / B2B), etapa de venta y KPIs del asesor
-- Fecha: 2026-08-13
--
-- Decisiones que conviene tener presentes al leer esto:
--
-- 1) NO se crea `crm_sales_activities`. Ya existe `contact_activity_log` con la
--    misma forma (contact_id, user_id, activity_type, description, metadata), la
--    escribe logActivity() y la lee buildTimeline() para la ficha y los export a
--    HTML/PDF. Una tabla paralela partiría el historial del contacto en dos. Se
--    extiende la que hay con `occurred_at` y `outcome`.
--
-- 2) `sales_stage` es ortogonal a `status`. NO se sincronizan solos: status
--    'inactivo' lo usan las automatizaciones de WhatsApp para la baja del
--    contacto (20260813_automatizaciones_wa.sql), así que un negocio perdido no
--    puede arrastrar al contacto fuera de las campañas. La ficha sugiere el
--    cambio de status al cerrar, y lo decide el asesor.
--
-- 3) La propiedad del contacto es `user_id`. `assigned_advisor_id` existe en la
--    tabla pero está NULL en las 39 filas y ninguna política la usa como
--    criterio principal; no se toca.
--
-- 4) El RUT de empresa no lleva CHECK de formato: la columna es `company_tax_id`
--    y un identificador extranjero no tiene por qué cumplir el módulo 11 chileno.
--    La validación del RUT vive en la ficha, como aviso y no como bloqueo.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Perfil comercial en crm_contacts ─────────────────────────────────────
alter table public.crm_contacts
  add column if not exists contact_type     text not null default 'P2P',
  add column if not exists company_name     text,
  add column if not exists company_tax_id   text,
  add column if not exists sales_stage      text not null default 'PROSPECTO',
  add column if not exists estimated_value  numeric(14,2),
  add column if not exists next_followup_at timestamptz;

do $$ begin
  alter table public.crm_contacts
    add constraint crm_contacts_contact_type_chk
    check (contact_type in ('P2P','B2B'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.crm_contacts
    add constraint crm_contacts_sales_stage_chk
    check (sales_stage in ('PROSPECTO','CONTACTADO','REUNION_AGENDADA',
                           'PROPUESTA_ENVIADA','EN_NEGOCIACION',
                           'CERRADO_GANADO','CERRADO_PERDIDO'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.crm_contacts
    add constraint crm_contacts_estimated_value_chk
    check (estimated_value is null or estimated_value >= 0);
exception when duplicate_object then null; end $$;

comment on column public.crm_contacts.contact_type     is 'P2P (persona natural) | B2B (empresa)';
comment on column public.crm_contacts.company_name     is 'Razón social; null en P2P';
comment on column public.crm_contacts.company_tax_id   is 'RUT de la empresa u otro identificador fiscal; null en P2P';
comment on column public.crm_contacts.sales_stage      is 'Etapa comercial. Ortogonal a status: no se sincronizan automáticamente.';
comment on column public.crm_contacts.estimated_value  is 'Monto proyectado de inversión, en USD como el resto del CRM';
comment on column public.crm_contacts.next_followup_at is 'Próximo seguimiento comprometido. Denormalizado para ordenar la lista y el KPI de vencidos; la tarea formal sigue viviendo en crm_tasks.';

-- Backfill de la etapa desde el estado que ya existía. Hoy las 39 filas están en
-- 'activo', así que todas aterrizan en CONTACTADO; el mapa cubre el resto de
-- valores para que la migración sea correcta si se reejecuta más adelante.
update public.crm_contacts
set sales_stage = case status
                    when 'cliente'   then 'CERRADO_GANADO'
                    when 'prospecto' then 'PROSPECTO'
                    when 'activo'    then 'CONTACTADO'
                    else 'PROSPECTO'   -- 'inactivo' no es un negocio perdido
                  end
where sales_stage = 'PROSPECTO' and status is not null;

create index if not exists crm_contacts_user_stage_idx
  on public.crm_contacts (user_id, sales_stage);
create index if not exists crm_contacts_user_followup_idx
  on public.crm_contacts (user_id, next_followup_at)
  where next_followup_at is not null;
-- El mismo asesor no debería tener dos fichas de la misma empresa. Dos asesores
-- distintos sí pueden trabajar la misma, igual que pasa con los grupos.
create unique index if not exists crm_contacts_user_taxid_uq
  on public.crm_contacts (user_id, company_tax_id)
  where company_tax_id is not null;

-- ── 2. contact_activity_log: la actividad comercial ─────────────────────────
alter table public.contact_activity_log
  add column if not exists occurred_at timestamptz,
  add column if not exists outcome     text;

-- created_at es cuándo se registró; occurred_at es cuándo ocurrió de verdad. El
-- asesor anota el lunes la llamada del viernes, y el KPI del mes tiene que
-- contarla en su mes.
update public.contact_activity_log
set occurred_at = created_at
where occurred_at is null;

alter table public.contact_activity_log
  alter column occurred_at set default now(),
  alter column occurred_at set not null;

comment on column public.contact_activity_log.occurred_at is
  'Cuándo ocurrió la interacción (created_at es cuándo se registró).';
comment on column public.contact_activity_log.outcome is
  'Resultado libre de la gestión: contestó, no contestó, reagendó…';

-- 'reunion' no estaba en el CHECK: sin esto, registrar una reunión desde la
-- ficha reventaría con 23514.
alter table public.contact_activity_log
  drop constraint if exists contact_activity_log_activity_type_check;
alter table public.contact_activity_log
  add constraint contact_activity_log_activity_type_check
  check (activity_type in (
    'registro','email_enviado','whatsapp_chat','wafinance_invitacion',
    'nota_agregada','estado_cambiado','tarea_creada','tarea_completada',
    'llamada','asignacion','otro',
    'reunion'
  ));

create index if not exists contact_activity_log_user_occurred_idx
  on public.contact_activity_log (user_id, occurred_at desc);
create index if not exists contact_activity_log_contact_occurred_idx
  on public.contact_activity_log (contact_id, occurred_at desc);

-- ── 3. KPIs del asesor ──────────────────────────────────────────────────────
-- security definer con el alcance decidido dentro: un asesor sólo puede pedir lo
-- suyo, un admin o super admin puede pedir el de cualquiera o el del equipo
-- entero. Es una ampliación deliberada y acotada: el admin ve AGREGADOS de toda
-- la cartera, no las filas de contacto —para eso la RLS de crm_contacts sigue
-- siendo (user_id = auth.uid() or is_super_admin()) y no se toca aquí.
create or replace function public.sales_kpis(
  p_user_id uuid  default null,
  p_from    date  default null,
  p_to      date  default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_admin  boolean := public.is_crm_admin();
  v_scope  uuid;
  v_todos  boolean;
  v_from   date := coalesce(p_from, date_trunc('month', current_date)::date);
  v_to     date := coalesce(p_to,   current_date);
  v_out    jsonb;
begin
  -- Un asesor sólo ve lo suyo, pida lo que pida.
  if v_admin then
    v_scope := p_user_id;
    v_todos := p_user_id is null;
  else
    v_scope := auth.uid();
    v_todos := false;
  end if;

  with cartera as (
    select * from public.crm_contacts c
    where v_todos or c.user_id = v_scope
  ),
  -- Etapas activas: todo lo que no está cerrado.
  agg as (
    select
      count(*)::int                                                      total,
      count(*) filter (where sales_stage = 'CERRADO_GANADO')::int        ganados,
      count(*) filter (where sales_stage = 'CERRADO_PERDIDO')::int       perdidos,
      count(*) filter (where sales_stage not like 'CERRADO%')::int       activos,
      count(*) filter (where contact_type = 'P2P')::int                  p2p,
      count(*) filter (where contact_type = 'B2B')::int                  b2b,
      coalesce(sum(estimated_value) filter (where sales_stage not like 'CERRADO%'), 0)      pipeline,
      coalesce(sum(estimated_value) filter (where sales_stage = 'CERRADO_GANADO'), 0)       ganado_monto,
      coalesce(sum(estimated_value) filter (where contact_type = 'P2P'), 0)                 monto_p2p,
      coalesce(sum(estimated_value) filter (where contact_type = 'B2B'), 0)                 monto_b2b,
      -- Pipeline ponderado por probabilidad de etapa: la suma cruda trata igual
      -- un prospecto frío que una propuesta enviada.
      coalesce(sum(estimated_value * case sales_stage
        when 'PROSPECTO'         then 0.10
        when 'CONTACTADO'        then 0.20
        when 'REUNION_AGENDADA'  then 0.40
        when 'PROPUESTA_ENVIADA' then 0.60
        when 'EN_NEGOCIACION'    then 0.80
        else 0 end), 0)                                                  pipeline_ponderado,
      count(*) filter (where next_followup_at < now())::int              seg_vencidos,
      count(*) filter (where next_followup_at::date = current_date)::int seg_hoy,
      count(*) filter (where next_followup_at >= now()
                         and next_followup_at < now() + interval '7 days')::int seg_semana
    from cartera
  ),
  etapas as (
    select coalesce(jsonb_object_agg(sales_stage, jsonb_build_object(
             'n', n, 'monto', monto)), '{}'::jsonb) j
    from (
      select sales_stage, count(*)::int n, coalesce(sum(estimated_value),0) monto
      from cartera group by sales_stage
    ) t
  ),
  -- Se agrega sobre el desglose por tipo para tener de una vez el total y el
  -- reparto. Sin GROUP BY, la agregación externa devuelve siempre una fila:
  -- con cero actividades da n=0 y por_tipo={}.
  actividades as (
    select coalesce(sum(n_tipo), 0)::int n,
           coalesce(jsonb_object_agg(activity_type, n_tipo), '{}'::jsonb) por_tipo
    from (
      select a.activity_type, count(*)::int n_tipo
      from public.contact_activity_log a
      join cartera c on c.id = a.contact_id
      where a.occurred_at >= v_from
        and a.occurred_at < (v_to + 1)
      group by a.activity_type
    ) x
  )
  select jsonb_build_object(
    'desde', v_from, 'hasta', v_to,
    'alcance', case when v_todos then 'equipo' else 'asesor' end,
    'es_admin', v_admin,
    'total', agg.total,
    'ganados', agg.ganados,
    'perdidos', agg.perdidos,
    'activos', agg.activos,
    -- Dos tasas distintas, porque "tasa de conversión" a secas es ambigua:
    -- cierre  = ganados sobre negocios ya resueltos
    -- cartera = ganados sobre todo lo que se tiene
    'tasa_cierre', case when (agg.ganados + agg.perdidos) = 0 then 0
                        else round(agg.ganados::numeric * 100 / (agg.ganados + agg.perdidos), 1) end,
    'conversion_cartera', case when agg.total = 0 then 0
                        else round(agg.ganados::numeric * 100 / agg.total, 1) end,
    'pipeline', agg.pipeline,
    'pipeline_ponderado', round(agg.pipeline_ponderado, 2),
    'ganado_monto', agg.ganado_monto,
    'p2p', agg.p2p, 'b2b', agg.b2b,
    'monto_p2p', agg.monto_p2p, 'monto_b2b', agg.monto_b2b,
    'pct_p2p', case when agg.total = 0 then 0 else round(agg.p2p::numeric * 100 / agg.total, 1) end,
    'pct_b2b', case when agg.total = 0 then 0 else round(agg.b2b::numeric * 100 / agg.total, 1) end,
    'seguimientos', jsonb_build_object('vencidos', agg.seg_vencidos,
                                       'hoy', agg.seg_hoy,
                                       'semana', agg.seg_semana),
    'etapas', etapas.j,
    'actividades', coalesce((select n from actividades), 0),
    'actividades_por_tipo', coalesce((select por_tipo from actividades), '{}'::jsonb)
  ) into v_out
  from agg, etapas;

  return v_out;
end;
$$;

comment on function public.sales_kpis(uuid, date, date) is
  'KPIs comerciales. El asesor sólo obtiene los suyos; admin y super_admin pueden pedir los de un asesor concreto o los del equipo (p_user_id null).';

revoke all on function public.sales_kpis(uuid, date, date) from public, anon;
grant execute on function public.sales_kpis(uuid, date, date) to authenticated;
