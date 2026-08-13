-- ─────────────────────────────────────────────────────────────────────────────
-- Análisis Diario de Instrumentos (divisas / commodities / índices / cripto)
--
-- Dos tablas, no una, a propósito: RLS es row-level, no column-level. Una sola
-- política de SELECT para 'authenticated' habría dado a los clientes del portal
-- —que autentican contra este mismo proyecto— acceso a analisis_staff, es decir
-- al análisis técnico interno. Separando la parte de staff en su propia tabla
-- cada lado tiene su propio RLS y su propia suscripción Realtime, sin fugas.
--
-- Los números (soporte, resistencia, tendencia) los calcula el orquestador a
-- partir de datos de mercado reales y se validan antes de publicar; el modelo
-- sólo redacta las dos narrativas. Nunca se publican niveles inventados.
--
-- El disclaimer educativo es obligatorio a nivel de esquema (NOT NULL + CHECK):
-- ninguna fila puede existir sin él. Es un requisito legal del sitio, no una
-- decoración de la interfaz.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: ¿el usuario es staff del CRM? ───────────────────────────────────
create or replace function public.is_crm_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public','auth'
as $$
  select coalesce(
    (select raw_user_meta_data->>'role' from auth.users where id = auth.uid())
      in ('super_admin','admin','asesor','broker','interno')
    or exists (select 1 from public.crm_staff_profiles where user_id = auth.uid()),
  false);
$$;

comment on function public.is_crm_staff() is
  'true si el usuario autenticado pertenece al staff del CRM (cualquier rol)';

-- ── Tabla pública: lo que ve el cliente en el portal ────────────────────────
create table if not exists public.analisis_instrumentos (
  id                uuid primary key default gen_random_uuid(),
  instrumento       text not null,
  fecha             date not null default current_date,
  tendencia         text not null check (tendencia in ('ALCISTA','BAJISTA','NEUTRA')),
  soporte           numeric(18,6) not null check (soporte > 0),
  resistencia       numeric(18,6) not null check (resistencia > 0),
  analisis_cliente  text not null,

  -- Trazabilidad: sobre qué datos se dijo esto
  precio_referencia numeric(18,6) not null check (precio_referencia > 0),
  fuente_datos      text not null,
  datos_at          timestamptz not null,
  validacion        jsonb not null default '{}'::jsonb,

  -- Requisito legal: carácter educativo, siempre presente
  disclaimer        text not null default
    'Este análisis tiene carácter exclusivamente educativo e informativo. No constituye asesoría de inversión, recomendación de compra o venta, ni oferta de instrumentos financieros. Los niveles señalados se calculan a partir de datos de mercado históricos y pueden variar sin previo aviso. Invertir en mercados financieros conlleva riesgo de pérdida de capital. Pessaro Capital SpA no garantiza resultados.',

  created_at        timestamptz not null default now(),

  constraint analisis_niveles_coherentes check (soporte < resistencia),
  constraint analisis_disclaimer_presente check (length(btrim(disclaimer)) >= 80)
);

-- Un análisis por instrumento y día: hace idempotente el reintento del cron
create unique index if not exists analisis_instrumentos_dia_uq
  on public.analisis_instrumentos (instrumento, fecha);
create index if not exists analisis_instrumentos_fecha_idx
  on public.analisis_instrumentos (fecha desc);

-- ── Tabla interna: sólo staff ───────────────────────────────────────────────
create table if not exists public.analisis_instrumentos_staff (
  id             uuid primary key default gen_random_uuid(),
  analisis_id    uuid not null unique
                   references public.analisis_instrumentos(id) on delete cascade,
  analisis_staff text not null,
  created_at     timestamptz not null default now()
);

create index if not exists analisis_staff_analisis_idx
  on public.analisis_instrumentos_staff (analisis_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.analisis_instrumentos       enable row level security;
alter table public.analisis_instrumentos_staff enable row level security;

-- Lectura pública (clientes del portal + staff). Sólo columnas seguras: la
-- narrativa técnica no vive en esta tabla.
drop policy if exists analisis_select_autenticados on public.analisis_instrumentos;
create policy analisis_select_autenticados on public.analisis_instrumentos
  for select to authenticated using (true);

-- Lectura interna: sólo staff del CRM
drop policy if exists analisis_staff_select on public.analisis_instrumentos_staff;
create policy analisis_staff_select on public.analisis_instrumentos_staff
  for select to authenticated using (public.is_crm_staff());

-- La escritura es exclusiva del service_role (la edge function). No se crea
-- ninguna política de INSERT/UPDATE/DELETE: con RLS activo y sin política,
-- ningún rol normal puede escribir, y el service_role ignora RLS por diseño.

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Sin esto la suscripción del CRM y la del portal no reciben nada.
do $$ begin
  alter publication supabase_realtime add table public.analisis_instrumentos;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.analisis_instrumentos_staff;
exception when duplicate_object then null; end $$;

comment on table public.analisis_instrumentos is
  'Análisis diario por instrumento — parte visible para clientes y staff';
comment on table public.analisis_instrumentos_staff is
  'Análisis técnico interno; sólo staff del CRM (ver is_crm_staff())';
comment on column public.analisis_instrumentos.validacion is
  'Resultado de las comprobaciones de los niveles antes de publicar';
comment on column public.analisis_instrumentos.disclaimer is
  'Aviso de carácter educativo. Obligatorio: NOT NULL + CHECK de longitud mínima';

-- ── Planificador ────────────────────────────────────────────────────────────
-- Job de pg_cron `analisis-diario-instrumentos`, '0 12 * * *' UTC.
-- 12:00 UTC = 08:00 en Chile en horario estándar. pg_cron no admite zona por
-- job y cambiar cron.timezone desplazaría los otros jobs diarios, así que en
-- horario de verano chileno (UTC-3) esto cae a las 09:00 locales.
--
-- No se versiona el job aquí porque lleva la anon key y ANALISIS_CRON_SECRET.
-- Para recrearlo, sustituye los marcadores:
--
-- select cron.schedule('analisis-diario-instrumentos','0 12 * * *', $job$
--   select net.http_post(
--     url := 'https://ldlflxujrjihiybrcree.supabase.co/functions/v1/generar-analisis-diario',
--     headers := jsonb_build_object('Content-Type','application/json',
--                                   'Authorization','Bearer <ANON_KEY>'),
--     body := jsonb_build_object('cron_secret','<ANALISIS_CRON_SECRET>'),
--     timeout_milliseconds := 150000);
-- $job$);
--
-- Diagnóstico y detalle completo: ANALISIS_DIARIO_INSTRUMENTOS.md
