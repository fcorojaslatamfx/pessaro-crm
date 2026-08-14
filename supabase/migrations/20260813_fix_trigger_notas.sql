-- ─────────────────────────────────────────────────────────────────────────────
-- Arreglo: las notas de la ficha no se guardaban
-- Fecha: 2026-08-13
--
-- Síntoma: en la ficha del cliente, escribir una nota y pulsar «+» no hacía
-- nada. Ni error a la vista ni nota en la lista.
--
-- Causa: fn_log_note_added(), que dispara el trigger AFTER INSERT
-- trg_log_note_added sobre crm_notes, insertaba `NEW.contact_id`. Esa columna no
-- existe en crm_notes — la suya se llama `crm_contact_id`. La función reventaba
-- con 42703 y, al ser parte de la misma transacción, se llevaba por delante el
-- INSERT de la nota.
--
-- Alcance real medido antes de tocar nada: 0 notas de contacto guardadas en toda
-- la vida de la tabla, y la última nota de cualquier tipo era del 2026-06-18.
-- El cliente sólo hacía console.error, así que el fallo era invisible.
--
-- Se aprovecha para cubrir el caso que faltaba: una nota de un formulario web o
-- de un lead de campaña tiene crm_contact_id null, y contact_activity_log
-- .contact_id es NOT NULL. Ahí no hay nada que registrar y el trigger no
-- escribe, en vez de fallar.
--
-- En App.jsx se retira además el logActivity() que addNote() hacía a mano: con
-- el trigger arreglado habría dejado dos actividades por cada nota.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_log_note_added()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Nota que no cuelga de un contacto del CRM: no hay actividad que registrar.
  if new.crm_contact_id is null then
    return new;
  end if;

  insert into contact_activity_log (contact_id, user_id, activity_type, description, metadata)
  values (
    new.crm_contact_id,
    coalesce(new.created_by, auth.uid()),
    'nota_agregada',
    'Nota agregada al contacto',
    jsonb_build_object('note_preview', left(new.content, 100))
  );
  return new;
end;
$function$;

comment on function public.fn_log_note_added() is
  'Registra en contact_activity_log la nota añadida a un contacto del CRM. Ignora las notas de formularios web y leads de campaña, que no tienen contacto asociado.';
