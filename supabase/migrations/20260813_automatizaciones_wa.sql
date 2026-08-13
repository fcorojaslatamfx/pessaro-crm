-- ─────────────────────────────────────────────────────────────────────────────
-- Automatizaciones de WhatsApp: baja, reactivación y bienvenida
--
-- Acompaña a whatsapp-webhook v16, que resuelve la intención del mensaje
-- entrante (botón de respuesta rápida o texto libre) y ejecuta tres flujos:
--   baja     → whatsapp_opt_outs + crm_contacts.status='inactivo' + confirmación
--   alta     → marca opted_in_at + confirmación
--   comenzar → crm_contacts.status='activo', campaign_leads.etapa=2 + bienvenida
--
-- Nota importante sobre el bloqueo de campañas: cambiar crm_contacts.status a
-- 'inactivo' NO excluye a nadie de los envíos masivos, porque runCampaign() no
-- filtra por estado al armar los destinatarios (ni desde grupos de contactos ni
-- desde campaign_leads). El único filtro real es whatsapp_opt_outs vía
-- isOptedOut(). Por eso el flujo de baja escribe en las dos partes: la tabla
-- bloquea y el estado se ve.
-- ─────────────────────────────────────────────────────────────────────────────

-- La reactivación no borra la fila, la marca: así queda la auditoría de quién
-- pidió la baja y cuándo, que es lo que Meta exige poder demostrar.
alter table public.whatsapp_opt_outs
  add column if not exists opted_in_at timestamptz;

comment on column public.whatsapp_opt_outs.opted_in_at is
  'No nulo = el contacto se volvió a suscribir; la fila deja de bloquear envíos';

-- Distingue en la bandeja lo que contestó el sistema de lo que escribió el asesor
alter table public.whatsapp_messages
  add column if not exists auto_reply boolean not null default false;

comment on column public.whatsapp_messages.auto_reply is
  'true = respuesta automática del webhook, no la escribió un asesor';

create index if not exists whatsapp_opt_outs_activos_idx
  on public.whatsapp_opt_outs (client_phone) where opted_in_at is null;
