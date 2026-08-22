-- ============================================================================
-- crm_contacts_source_check: permitir source='waba'
-- Fecha: 2026-08-22
--
-- Encontrado al depurar "no se pudo abrir la ficha del cliente" para un
-- cliente del portal sin contacto CRM previo (creado desde ClientsPortalKYC.jsx,
-- que también insertaba un source fuera de la lista permitida — corregido por
-- separado a 'manual').
--
-- Al revisar la restricción real (pg_constraint, no lo que dice ningún doc)
-- se confirmó que solo permitía 'manual'/'csv'/'formulario' — nunca incluyó
-- 'waba', pese a que sincronizarContactoCRM() (pessarocl/supabase/functions/
-- _shared/waba_bot.ts) inserta con source:'waba' desde el 2026-08-21
-- (PLAN_WABA_CONTACTO_CRM_SUBGRUPO_2026_08_21.md, dado por "implementado y
-- desplegado"). Verificado en producción: 0 filas con source='waba' pese al
-- uso real del bot — el INSERT llevaba fallando en silencio (esa función es
-- "mejor esfuerzo": solo hace console.error, no tumba el registro del
-- cliente), así que ningún contacto WABA nuevo (que no existiera antes en el
-- CRM) llegó a crear su fila.
--
-- Esta migración no repara el histórico — los contactos que debieron crearse
-- entre el 21 y el 22 de agosto y no se crearon siguen sin existir. Backfill,
-- si se decide hacer, es un paso aparte.
-- ============================================================================

alter table public.crm_contacts drop constraint crm_contacts_source_check;

alter table public.crm_contacts add constraint crm_contacts_source_check
  check (source = any (array['manual','csv','formulario','waba']));
