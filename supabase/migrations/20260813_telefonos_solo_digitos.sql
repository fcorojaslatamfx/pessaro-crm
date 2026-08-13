-- ─────────────────────────────────────────────────────────────────────────────
-- Formato único de móvil: sólo dígitos, sin '+' ni espacios
--
-- Hasta ahora convivían dos formatos. El webhook de WhatsApp guardaba
-- '+' || msg.from y normalizePhone() conservaba el '+', así que las claves de
-- WhatsApp (whatsapp_messages / assignments / opt_outs) y los teléfonos del CRM
-- iban todos con '+'.
--
-- Al quitar el '+' sólo de crm_contacts se habrían roto dos cosas silenciosamente:
--   - los opt-out: isOptedOut() compara contra whatsapp_opt_outs.client_phone,
--     así que una baja guardada con '+' no habría coincidido y se habría vuelto
--     a escribir a quien pidió no recibir mensajes
--   - las asignaciones: canSendToPhone() compara contra
--     whatsapp_assignments.client_phone, y el asesor habría perdido el permiso
--     de enviar en sus propios chats
-- Además los envíos por campaña habrían insertado mensajes sin '+', partiendo
-- el hilo de la bandeja en dos conversaciones para la misma persona.
--
-- Por eso el cambio va en todas las columnas de la cadena, no sólo en contactos.
-- Acompaña a los cambios de código:
--   - whatsapp-send v18 y whatsapp-webhook v15: normalizan a sólo dígitos
--   - App.jsx: soloDigitos() en alta manual, edición e importación CSV
--   - WhatsAppInbox.jsx: normalizePhone() deja de anteponer '+'
--
-- Fuera de alcance a propósito (no son contactos ni entran en el cruce de
-- WhatsApp): crm_staff_profiles, client_profiles, support_*, newsletter,
-- education_downloads, live_chat_*, risk_profiles, user_profiles.
-- ─────────────────────────────────────────────────────────────────────────────

update public.crm_contacts
set phone = regexp_replace(phone, '\D', '', 'g')
where phone is not null and phone ~ '\D';

update public.campaign_leads
set phone = regexp_replace(phone, '\D', '', 'g')
where phone is not null and phone ~ '\D';

update public.contact_submissions
set mobile = regexp_replace(mobile, '\D', '', 'g')
where mobile is not null and mobile ~ '\D';

update public.whatsapp_messages
set client_phone = regexp_replace(client_phone, '\D', '', 'g')
where client_phone is not null and client_phone ~ '\D';

update public.whatsapp_assignments
set client_phone = regexp_replace(client_phone, '\D', '', 'g')
where client_phone is not null and client_phone ~ '\D';

update public.whatsapp_opt_outs
set client_phone = regexp_replace(client_phone, '\D', '', 'g')
where client_phone is not null and client_phone ~ '\D';
