-- ============================================================================
-- Migración: support_portal_rls_2026_07_21
-- Origen:    SPEC_SOPORTE_TICKETS_OTP_2026_07_19.md §10.1
-- Estado:    Aplicada 2026-07-22 vía apply_migration (aprobación explícita del usuario)
-- Contexto:  Integración Portal Cliente ↔ CRM (aprobado 2026-07-21). El cliente
--            autenticado del portal (pessaro_CL) lee sus propios tickets y
--            mensajes directamente vía Supabase Realtime, identificado por su
--            JWT de Supabase Auth (auth.email()). El INSERT sigue exclusivamente
--            vía Edge Function support_tickets (ya valida ambos modos de auth
--            server-side); estas políticas son de solo lectura.
-- ============================================================================

DROP POLICY IF EXISTS client_read_tickets ON support_tickets;
CREATE POLICY client_read_tickets ON support_tickets FOR SELECT
  USING ( client_email = auth.email() );

-- Subconsulta sobre support_tickets (tabla distinta a la de la política) →
-- sin riesgo de recursión 42P17 (aprendizaje MD).
DROP POLICY IF EXISTS client_read_msgs ON support_ticket_messages;
CREATE POLICY client_read_msgs ON support_ticket_messages FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE client_email = auth.email()
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Sin esto, el canal Supabase Realtime que SoportePage.tsx (pessaro_CL) abre
-- sobre support_ticket_messages nunca recibe los INSERT (gap no cubierto por
-- la migración original support_tickets_2026_07_19, detectado al integrar).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_ticket_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_ticket_messages;
  END IF;
END $$;
