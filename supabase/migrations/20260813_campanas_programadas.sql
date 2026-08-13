-- ─────────────────────────────────────────────────────────────────────────────
-- Campañas WABA programadas: el planificador que faltaba
--
-- Diagnóstico: al crear una campaña con fecha, el CRM guardaba la fila con
-- status='scheduled' y ahí terminaba todo. NADA la ejecutaba después, así que
-- el mensaje no llegaba nunca. El badge «Programada» del historial es una
-- etiqueta de estado, no un botón, por eso al hacer clic tampoco pasaba nada.
--
-- Además scheduled_at se guardaba con la hora local sin zona ('2026-08-13T09:25'),
-- que Postgres interpretaba como UTC: la campaña quedaba programada 4 h antes de
-- lo elegido. Eso se corrige en el frontend (CampaignSender.jsx → localAISO).
--
-- Aquí va la parte de base de datos:
--   1. estado 'failed' para que una campaña que no puede ejecutarse no quede
--      reintentándose en cada ciclo del planificador
--   2. índice para la consulta de campañas vencidas
--   3. el job de pg_cron que cada 5 min llama a whatsapp-send/run_due_campaigns
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.whatsapp_campaigns drop constraint if exists whatsapp_campaigns_status_check;
alter table public.whatsapp_campaigns add constraint whatsapp_campaigns_status_check
  check (status = any (array['draft','scheduled','sending','completed','paused','failed']));

create index if not exists whatsapp_campaigns_due_idx
  on public.whatsapp_campaigns (scheduled_at) where status = 'scheduled';

-- ── Planificador ────────────────────────────────────────────────────────────
-- OJO: el job real lleva dos valores que NO se versionan aquí:
--   - la anon key del proyecto, en la cabecera Authorization (whatsapp-send
--     tiene verify_jwt activo, así que el bearer debe ser un JWT válido)
--   - WA_CRON_SECRET, en el cuerpo; es el que autoriza de verdad la action.
--     Vive en los secrets de la edge function (npx supabase secrets set) y se
--     eligió en vez de la service role key para no dejar esa clave escrita en
--     cron.job, que es legible por cualquiera con acceso a la base.
--
-- Para recrearlo, sustituye los dos marcadores y ejecuta:
--
-- select cron.schedule(
--   'wa-campanas-programadas',
--   '*/5 * * * *',
--   $job$
--   select net.http_post(
--     url := 'https://ldlflxujrjihiybrcree.supabase.co/functions/v1/whatsapp-send',
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer <ANON_KEY>'
--     ),
--     body := jsonb_build_object(
--       'action','run_due_campaigns',
--       'cron_secret','<WA_CRON_SECRET>'
--     ),
--     timeout_milliseconds := 120000
--   );
--   $job$
-- );
--
-- Para desactivarlo:  select cron.unschedule('wa-campanas-programadas');
-- Para revisarlo:     select * from cron.job_run_details where jobid = (
--                       select jobid from cron.job where jobname='wa-campanas-programadas'
--                     ) order by start_time desc limit 10;
