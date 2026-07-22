import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
}

const SESSION_TTL_HOURS = 24

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function resolveSession(supabase: any, session_token: string) {
  if (!session_token) return null
  const { data, error } = await supabase
    .from('support_otp_sessions')
    .select('client_email, client_phone, verified_at')
    .eq('session_token', session_token)
    .maybeSingle()
  if (error || !data || !data.verified_at) return null
  const ageMs = Date.now() - new Date(data.verified_at).getTime()
  if (ageMs > SESSION_TTL_HOURS * 3600000) return null
  return { client_email: data.client_email as string, client_phone: data.client_phone as string | null }
}

// Resuelve la identidad del cliente en dos modos (§10.1 SPEC):
//  (a) session_token OTP — flujo anónimo de crm.pessaro.cl/soporte
//  (b) Authorization: Bearer <JWT> — cliente autenticado del portal (pessaro_CL),
//      validado contra el auth server con supabase.auth.getUser(jwt)
// deno-lint-ignore no-explicit-any
async function resolveIdentity(req: Request, supabase: any, payload: any) {
  if (payload.session_token) {
    const session = await resolveSession(supabase, payload.session_token)
    if (session) return session
  }

  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (jwt) {
    const { data, error } = await supabase.auth.getUser(jwt)
    if (!error && data?.user?.email) {
      return { client_email: data.user.email as string, client_phone: null as string | null }
    }
  }

  return null
}

// Fire-and-forget: notifica al asesor asignado. No debe bloquear la respuesta al cliente.
async function notifyAdvisor(ticket_id: string, event: string) {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/support_notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ ticket_id, event }),
    })
  } catch (e) {
    console.error('[support_tickets] notifyAdvisor failed:', (e as Error).message)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { action, ...payload } = await req.json()

    if (action === 'create_ticket') {
      const session = await resolveIdentity(req, supabase, payload)
      if (!session) return json({ error: 'Sesión inválida o expirada' }, 401)

      const subject = String(payload.subject || '').trim()
      const message = String(payload.message || '').trim()
      const category = payload.category || 'general'
      const client_name = String(payload.client_name || '').trim() || null
      const client_phone = String(payload.client_phone || session.client_phone || '').trim() || null
      if (!subject || !message) return json({ error: 'subject y message requeridos' }, 400)

      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id, user_id')
        .eq('email', session.client_email)
        .maybeSingle()

      let assigned_to: string | null = null
      let team_id: string | null = null
      let contact_id: string | null = null

      if (contact) {
        contact_id = contact.id
        const { data: advisorStaff } = await supabase
          .from('crm_staff_profiles')
          .select('id, team_id')
          .eq('user_id', contact.user_id)
          .maybeSingle()
        if (advisorStaff) {
          assigned_to = advisorStaff.id
          team_id = advisorStaff.team_id
        }
      }

      if (!assigned_to) {
        const { data: superAdmin } = await supabase
          .from('crm_staff_profiles')
          .select('id, team_id')
          .eq('role', 'super_admin')
          .limit(1)
          .maybeSingle()
        if (superAdmin) {
          assigned_to = superAdmin.id
          team_id = team_id || superAdmin.team_id
        }
      }

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          contact_id, client_email: session.client_email, client_phone, client_name,
          subject, category, assigned_to, team_id, otp_verified: true,
        })
        .select('*')
        .single()
      if (error) return json({ error: error.message }, 500)

      await supabase.from('support_ticket_messages').insert({
        ticket_id: ticket.id, sender_type: 'client', content: message,
      })

      if (contact_id) {
        await supabase.from('contact_activity_log').insert({
          contact_id, activity_type: 'support_ticket',
          description: `Ticket de soporte creado: ${ticket.ticket_number}`,
          metadata: { ticket_number: ticket.ticket_number, category },
        })
      }

      await notifyAdvisor(ticket.id, 'new_ticket')

      return json({ success: true, ticket_number: ticket.ticket_number, ticket_id: ticket.id })
    }

    if (action === 'list_my_tickets') {
      const session = await resolveIdentity(req, supabase, payload)
      if (!session) return json({ error: 'Sesión inválida o expirada' }, 401)
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, ticket_number, subject, category, priority, status, created_at, updated_at, closed_at')
        .eq('client_email', session.client_email)
        .order('created_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      return json({ tickets: data || [] })
    }

    if (action === 'get_ticket') {
      const session = await resolveIdentity(req, supabase, payload)
      if (!session) return json({ error: 'Sesión inválida o expirada' }, 401)
      const ticket_number = payload.ticket_number
      if (!ticket_number) return json({ error: 'ticket_number requerido' }, 400)

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('ticket_number', ticket_number)
        .maybeSingle()
      if (error || !ticket || ticket.client_email !== session.client_email) {
        return json({ error: 'Ticket no encontrado' }, 404)
      }

      const { data: messages } = await supabase
        .from('support_ticket_messages')
        .select('id, sender_type, content, created_at')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })

      return json({ ticket, messages: messages || [] })
    }

    if (action === 'add_message') {
      const session = await resolveIdentity(req, supabase, payload)
      if (!session) return json({ error: 'Sesión inválida o expirada' }, 401)
      const ticket_number = payload.ticket_number
      const content = String(payload.content || '').trim()
      if (!ticket_number || !content) return json({ error: 'ticket_number y content requeridos' }, 400)

      const { data: ticket } = await supabase
        .from('support_tickets')
        .select('id, client_email, status')
        .eq('ticket_number', ticket_number)
        .maybeSingle()
      if (!ticket || ticket.client_email !== session.client_email) {
        return json({ error: 'Ticket no encontrado' }, 404)
      }

      const { error } = await supabase.from('support_ticket_messages').insert({
        ticket_id: ticket.id, sender_type: 'client', content,
      })
      if (error) return json({ error: error.message }, 500)

      // Reabre el ticket si el cliente escribe después de un cierre; también
      // sirve para que el trigger toque updated_at y el inbox del asesor
      // reordene la conversación como reciente.
      await supabase.from('support_tickets')
        .update({ status: ticket.status === 'cerrado' ? 'abierto' : ticket.status })
        .eq('id', ticket.id)

      await notifyAdvisor(ticket.id, 'new_message')

      return json({ success: true })
    }

    return json({ error: 'action no reconocida' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
