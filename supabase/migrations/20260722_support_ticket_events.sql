-- ============================================================================
-- Migración: support_ticket_events (auditoría de cierre/reapertura)
-- Origen:    Prompt Claude Code — Cierre/Reapertura de tickets + auditoría con fechas
--            (referencia SPEC_SOPORTE_TICKETS_OTP v1.2)
-- Estado:    NO EJECUTADA — la aplicará Francisco vía apply_migration
-- Reglas:    (1) Cerrar ticket: super_admin Y asesor asignado.
--            (2) Reabrir ticket cerrado: SOLO super_admin.
--            (3) Todo cambio de estado/asignación queda registrado con fecha y autor.
-- ============================================================================

-- Historial auditable de eventos por ticket
CREATE TABLE support_ticket_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  event_type     text NOT NULL CHECK (event_type IN ('creado','estado','asignacion','cerrado','reabierto')),
  old_value      text,
  new_value      text,
  actor_staff_id uuid REFERENCES crm_staff_profiles(id),  -- NULL = cliente o sistema
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_events_ticket ON support_ticket_events(ticket_id, created_at);

-- Trigger: registra automáticamente TODO cambio de estado/asignación (frontend, Edge Functions, SQL)
-- Lookup de actor vía get_my_profile() (patrón existente en 20260721_support_tickets.sql) —
-- NULL cuando la sesión no corresponde a un staff (Edge Function con service role, cliente).
CREATE OR REPLACE FUNCTION log_support_ticket_event() RETURNS trigger AS $fn$
DECLARE v_actor uuid;
BEGIN
  v_actor := ((get_my_profile())->>'id')::uuid;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO support_ticket_events(ticket_id, event_type, new_value, actor_staff_id)
    VALUES (NEW.id, 'creado', NEW.status, v_actor);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO support_ticket_events(ticket_id, event_type, old_value, new_value, actor_staff_id)
      VALUES (NEW.id,
              CASE WHEN NEW.status = 'cerrado' THEN 'cerrado'
                   WHEN OLD.status = 'cerrado' THEN 'reabierto'
                   ELSE 'estado' END,
              OLD.status, NEW.status, v_actor);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO support_ticket_events(ticket_id, event_type, old_value, new_value, actor_staff_id)
      VALUES (NEW.id, 'asignacion', OLD.assigned_to::text, NEW.assigned_to::text, v_actor);
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_support_ticket_events
  AFTER INSERT OR UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION log_support_ticket_event();

-- RLS del historial: staff lee; nadie escribe directo (solo el trigger, vía SECURITY DEFINER)
ALTER TABLE support_ticket_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_read_events ON support_ticket_events;
CREATE POLICY staff_read_events ON support_ticket_events FOR SELECT USING ( is_crm_staff() );

-- Endurecer UPDATE: asesor NO puede tocar tickets cerrados (⇒ no puede reabrir); super_admin sin restricción
DROP POLICY IF EXISTS staff_update_tickets ON support_tickets;
CREATE POLICY staff_update_tickets ON support_tickets FOR UPDATE
  USING (
    is_super_admin()
    OR (is_crm_staff() AND assigned_to = ((get_my_profile())->>'id')::uuid AND status <> 'cerrado')
  );
