import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
}

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurado')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Pessaro Capital Soporte <send@pessaro.cl>', to: [to], subject, html }),
  })
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { ticket_id, event } = await req.json()
    if (!ticket_id) return json({ error: 'ticket_id requerido' }, 400)

    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, ticket_number, subject, category, client_name, client_email, assigned_to')
      .eq('id', ticket_id)
      .maybeSingle()
    if (!ticket) return json({ error: 'Ticket no encontrado' }, 404)

    if (!ticket.assigned_to) return json({ success: true, skipped: 'sin asesor asignado' })

    const { data: staff } = await supabase
      .from('crm_staff_profiles')
      .select('id, user_id, display_name, pessaro_email')
      .eq('id', ticket.assigned_to)
      .maybeSingle()
    if (!staff) return json({ success: true, skipped: 'asesor asignado no encontrado' })

    const isNewTicket = event !== 'new_message'
    const subjectLine = isNewTicket
      ? `🎫 Nuevo ticket de soporte ${ticket.ticket_number}`
      : `💬 Nuevo mensaje en ticket ${ticket.ticket_number}`
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a1628;color:#fff;border-radius:16px">
        <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#f0a500;font-weight:700;margin:0 0 12px">Pessaro Capital · Soporte</p>
        <h2 style="font-size:17px;margin:0 0 10px">${subjectLine}</h2>
        <p style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 16px">
          Cliente: <strong>${ticket.client_name || ticket.client_email}</strong><br/>
          Asunto: ${ticket.subject}<br/>
          Categoría: ${ticket.category}
        </p>
        <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0">Revisa el ticket en el módulo Soporte del CRM (crm.pessaro.cl).</p>
      </div>
    `

    if (staff.pessaro_email) {
      try {
        await sendEmail(staff.pessaro_email, subjectLine, html)
      } catch (e) {
        console.error('[support_notify] email error:', (e as Error).message)
      }
    }

    // Fan-out opcional vía push_notifications_2026_02_27 (v24 según MD).
    // ⚠️ Contrato de payload asumido ({action:'send_to_user', user_id, title, body}) —
    // no está en el repo local (función solo desplegada); verificar firma real antes
    // del primer deploy y ajustar si difiere.
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push_notifications_2026_02_27`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ action: 'send_to_user', user_id: staff.user_id, title: subjectLine, body: ticket.subject }),
      })
    } catch (e) {
      console.error('[support_notify] push fan-out error:', (e as Error).message)
    }

    return json({ success: true })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
