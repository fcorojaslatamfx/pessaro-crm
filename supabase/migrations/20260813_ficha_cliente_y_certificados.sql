-- ─────────────────────────────────────────────────────────────────────────────
-- Ficha online del cliente + emisión de certificados
--
-- 1) crm_contacts gana los campos del registro completo del cliente
--    (nacimiento, profesión, apertura de cuenta, broker, PAMM/MAM, etc.)
-- 2) crm_client_movements guarda depósitos y retiros con fecha
-- 3) is_crm_admin(): admin o super_admin, leyendo el rol del mismo sitio que
--    get_my_profile() (auth.users.raw_user_meta_data) y tolerando el rol
--    guardado en crm_staff_profiles
-- 4) Certificados: la emisión pasa a ser server-side y sólo admin/super_admin,
--    validando el progreso real del alumno (lecciones publicadas completadas)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Registro completo del cliente ────────────────────────────────────────
alter table public.crm_contacts
  add column if not exists birth_date        date,
  add column if not exists profession        text,
  add column if not exists account_opened    boolean not null default false,
  add column if not exists account_opened_at date,
  add column if not exists account_kind      text,
  add column if not exists broker            text,
  add column if not exists account_number    text,
  add column if not exists initial_balance   numeric(14,2),
  add column if not exists managed_type      text;

do $$ begin
  alter table public.crm_contacts
    add constraint crm_contacts_account_kind_chk
    check (account_kind is null or account_kind in ('demo','real'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.crm_contacts
    add constraint crm_contacts_managed_type_chk
    check (managed_type is null or managed_type in ('PAMM','MAM','ninguno'));
exception when duplicate_object then null; end $$;

comment on column public.crm_contacts.profession      is 'Profesión, actividad u oficio';
comment on column public.crm_contacts.account_kind    is 'demo | real';
comment on column public.crm_contacts.managed_type    is 'PAMM | MAM | ninguno';
comment on column public.crm_contacts.initial_balance is 'Equidad o balance inicial de la cuenta';

-- ── 2. Depósitos y retiros ──────────────────────────────────────────────────
create table if not exists public.crm_client_movements (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references public.crm_contacts(id) on delete cascade,
  kind          text not null check (kind in ('deposito','retiro')),
  amount        numeric(14,2) not null check (amount >= 0),
  currency      text not null default 'USD',
  movement_date date not null default current_date,
  note          text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create index if not exists crm_client_movements_contact_idx
  on public.crm_client_movements (contact_id, movement_date desc);

alter table public.crm_client_movements enable row level security;

-- Mismo alcance que crm_contacts: el dueño del contacto o el super admin
drop policy if exists crm_client_movements_select on public.crm_client_movements;
create policy crm_client_movements_select on public.crm_client_movements
  for select using (
    is_super_admin() or exists (
      select 1 from public.crm_contacts c
      where c.id = crm_client_movements.contact_id and c.user_id = auth.uid()
    )
  );

drop policy if exists crm_client_movements_write on public.crm_client_movements;
create policy crm_client_movements_write on public.crm_client_movements
  for all using (
    is_super_admin() or exists (
      select 1 from public.crm_contacts c
      where c.id = crm_client_movements.contact_id and c.user_id = auth.uid()
    )
  ) with check (
    is_super_admin() or exists (
      select 1 from public.crm_contacts c
      where c.id = crm_client_movements.contact_id and c.user_id = auth.uid()
    )
  );

-- ── 3. Helper de rol: admin o super admin ───────────────────────────────────
create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public','auth'
as $$
  select coalesce(
    (select raw_user_meta_data->>'role' from auth.users where id = auth.uid())
      in ('super_admin','admin')
    or exists (
      select 1 from public.crm_staff_profiles
      where user_id = auth.uid() and role in ('super_admin','admin')
    ),
  false);
$$;

comment on function public.is_crm_admin() is
  'true si el usuario autenticado es admin o super_admin del CRM';

-- ── 4. Certificados ─────────────────────────────────────────────────────────
alter table public.education_certificates
  add column if not exists issued_by_user_id uuid,
  add column if not exists issue_note        text,
  add column if not exists revoked_at        timestamptz,
  add column if not exists revoked_reason    text;

create unique index if not exists education_certificates_number_uq
  on public.education_certificates (certificate_number);
create unique index if not exists education_certificates_verification_uq
  on public.education_certificates (verification_code);
-- Un certificado vigente por alumno y módulo
create unique index if not exists education_certificates_user_module_uq
  on public.education_certificates (user_id, module_id) where is_valid;

create sequence if not exists public.education_certificate_seq;

-- La emisión deja de ser libre: sólo entra por issue_education_certificate()
drop policy if exists certificates_insertable_by_system on public.education_certificates;
drop policy if exists certificates_insertable_by_admin on public.education_certificates;
create policy certificates_insertable_by_admin on public.education_certificates
  for insert with check (is_crm_admin());

drop policy if exists certificates_readable_by_admin on public.education_certificates;
create policy certificates_readable_by_admin on public.education_certificates
  for select using (is_crm_admin());

-- Progreso de un alumno en un módulo: lecciones publicadas completadas
create or replace function public.education_module_progress(p_user_id uuid, p_module_id uuid)
returns table (total_lessons int, done_lessons int, pct int)
language sql
stable
security definer
set search_path to 'public'
as $$
  with total as (
    select count(*)::int n
    from public.education_lessons
    where module_id = p_module_id and is_published
  ), done as (
    select count(distinct ec.lesson_id)::int n
    from public.education_completion ec
    join public.education_lessons l on l.id = ec.lesson_id and l.is_published
    where ec.user_id = p_user_id and l.module_id = p_module_id
  )
  select total.n,
         done.n,
         case when total.n = 0 then 0 else (done.n * 100 / total.n) end
  from total, done;
$$;

-- Candidatos a certificado: asignaciones aprobadas + progreso + certificado
-- ya emitido, si lo hay. Sólo admin/super_admin.
drop function if exists public.list_certificate_candidates(text);
create function public.list_certificate_candidates(p_email text default null)
returns table (
  assignment_id      uuid,
  user_id            uuid,
  client_name        text,
  client_email       text,
  module_id          uuid,
  module_title       text,
  difficulty_level   text,
  assigned_at        timestamptz,
  total_lessons      int,
  done_lessons       int,
  pct                int,
  certificate_id     uuid,
  certificate_number text,
  certificate_url    text,
  issued_at          timestamptz,
  is_valid           boolean
)
language sql
stable
security definer
set search_path to 'public','auth'
as $$
  select
    a.id,
    a.assigned_to_user_id,
    coalesce(nullif(trim(coalesce(cp.first_name,'') || ' ' || coalesce(cp.last_name,'')), ''), u.email, '—'),
    coalesce(cp.email, u.email),
    a.module_id,
    m.title,
    m.difficulty_level,
    a.assigned_at,
    p.total_lessons,
    p.done_lessons,
    p.pct,
    c.id,
    c.certificate_number,
    c.certificate_url,
    c.issued_at,
    c.is_valid
  from public.education_course_assignments a
  join public.education_modules m on m.id = a.module_id
  left join auth.users u on u.id = a.assigned_to_user_id
  left join public.client_profiles_2026_02_08_22_02 cp on cp.user_id = a.assigned_to_user_id
  left join lateral public.education_module_progress(a.assigned_to_user_id, a.module_id) p on true
  left join public.education_certificates c
    on c.user_id = a.assigned_to_user_id and c.module_id = a.module_id and c.is_valid
  where public.is_crm_admin()
    and a.status = 'approved'
    and (p_email is null or lower(coalesce(cp.email, u.email)) = lower(p_email))
  order by p.pct desc, a.assigned_at desc;
$$;

-- Emisión: admin/super_admin, y sólo si el alumno completó el módulo
create or replace function public.issue_education_certificate(p_assignment_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_assignment public.education_course_assignments%rowtype;
  v_pct        int;
  v_total      int;
  v_cert       public.education_certificates%rowtype;
  -- certificate_url es NOT NULL; se arma igual que en la edge function
  -- generate-certificate del portal, para que ambas vías apunten al mismo objeto
  v_base       text := 'https://ldlflxujrjihiybrcree.supabase.co';
begin
  if not public.is_crm_admin() then
    raise exception 'Sólo un admin o super admin puede emitir certificados'
      using errcode = '42501';
  end if;

  select * into v_assignment
  from public.education_course_assignments where id = p_assignment_id;

  if not found then
    raise exception 'La asignación no existe';
  end if;
  if v_assignment.status <> 'approved' then
    raise exception 'La asignación todavía no está aprobada';
  end if;

  select total_lessons, pct into v_total, v_pct
  from public.education_module_progress(v_assignment.assigned_to_user_id, v_assignment.module_id);

  if v_total = 0 then
    raise exception 'El curso no tiene lecciones publicadas';
  end if;
  if v_pct < 100 then
    raise exception 'El alumno lleva % %% del curso; el certificado se emite al 100 %%', v_pct;
  end if;

  select * into v_cert
  from public.education_certificates
  where user_id = v_assignment.assigned_to_user_id
    and module_id = v_assignment.module_id
    and is_valid;

  if found then
    return jsonb_build_object('already_issued', true, 'certificate_number', v_cert.certificate_number);
  end if;

  insert into public.education_certificates
    (user_id, module_id, certificate_number, certificate_url, verification_code,
     issued_at, is_valid, issued_by_user_id, issue_note)
  values (
    v_assignment.assigned_to_user_id,
    v_assignment.module_id,
    'PC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.education_certificate_seq')::text, 5, '0'),
    v_base || '/storage/v1/object/public/certificates/'
      || v_assignment.assigned_to_user_id || '/' || v_assignment.module_id || '.pdf',
    upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 12)),
    now(), true, auth.uid(), nullif(p_note,'')
  )
  returning * into v_cert;

  return jsonb_build_object(
    'already_issued',     false,
    'certificate_id',     v_cert.id,
    'certificate_number', v_cert.certificate_number,
    'certificate_url',    v_cert.certificate_url,
    'verification_code',  v_cert.verification_code,
    'issued_at',          v_cert.issued_at
  );
end;
$$;

-- Anulación: sólo super admin
create or replace function public.revoke_education_certificate(p_certificate_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_super_admin() then
    raise exception 'Sólo el super admin puede anular un certificado'
      using errcode = '42501';
  end if;

  update public.education_certificates
  set is_valid = false, revoked_at = now(), revoked_reason = nullif(p_reason,'')
  where id = p_certificate_id and is_valid;

  if not found then
    raise exception 'El certificado no existe o ya estaba anulado';
  end if;

  return jsonb_build_object('revoked', true);
end;
$$;

revoke all on function public.list_certificate_candidates(text)          from public, anon;
revoke all on function public.issue_education_certificate(uuid, text)    from public, anon;
revoke all on function public.revoke_education_certificate(uuid, text)   from public, anon;
revoke all on function public.education_module_progress(uuid, uuid)      from public, anon;
grant execute on function public.list_certificate_candidates(text)        to authenticated;
grant execute on function public.issue_education_certificate(uuid, text)  to authenticated;
grant execute on function public.revoke_education_certificate(uuid, text) to authenticated;
grant execute on function public.education_module_progress(uuid, uuid)    to authenticated;
grant execute on function public.is_crm_admin()                           to authenticated;
