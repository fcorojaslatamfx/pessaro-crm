import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
}

const OTP_TTL_MIN = 10
const MAX_ATTEMPTS = 5
const MAX_REQUESTS_PER_WINDOW = 3
const RATE_WINDOW_MIN = 10

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function genCode(): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return String(bytes[0] % 1000000).padStart(6, '0')
}

function genToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sendOtpEmail(email: string, name: string, code: string) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurado')
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a1628;color:#fff;border-radius:16px">
      <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#f0a500;font-weight:700;margin:0 0 14px">Pessaro Capital · Soporte</p>
      <h2 style="font-size:18px;margin:0 0 10px">Hola${name ? ` ${name}` : ''}, este es tu código de verificación</h2>
      <p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;margin:0 0 22px">
        Ingresa este código en el portal de soporte para verificar tu email. Expira en ${OTP_TTL_MIN} minutos.
      </p>
      <div style="text-align:center;padding:18px 0;background:rgba(255,255,255,0.06);border-radius:12px;margin-bottom:20px">
        <span style="font-size:34px;font-weight:800;letter-spacing:0.4em;color:#fff;font-family:monospace">${code}</span>
      </div>
      <p style="font-size:11px;color:rgba(255,255,255,0.35);margin:0">Si no solicitaste este código, puedes ignorar este email.</p>
    </div>
  `
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Pessaro Capital Soporte <send@pessaro.cl>',
      to: [email],
      subject: 'Tu código de verificación — Soporte Pessaro Capital',
      html,
    }),
  })
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { action, ...payload } = await req.json()

    if (action === 'request') {
      const email = String(payload.client_email || '').trim().toLowerCase()
      const name = String(payload.client_name || '').trim()
      const phone = String(payload.client_phone || '').trim() || null
      if (!email) return json({ error: 'client_email requerido' }, 400)

      const windowStart = new Date(Date.now() - RATE_WINDOW_MIN * 60000).toISOString()
      const { count } = await supabase
        .from('support_otp_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('client_email', email)
        .gte('created_at', windowStart)
      if ((count || 0) >= MAX_REQUESTS_PER_WINDOW) {
        return json({ error: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.' }, 429)
      }

      const code = genCode()
      const code_hash = await sha256Hex(code)
      const expires_at = new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString()

      const { data: session, error } = await supabase
        .from('support_otp_sessions')
        .insert({ client_email: email, client_phone: phone, channel: 'email', code_hash, expires_at })
        .select('id')
        .single()
      if (error) return json({ error: error.message }, 500)

      try {
        await sendOtpEmail(email, name, code)
      } catch (sendErr) {
        return json({ error: (sendErr as Error).message }, 502)
      }

      return json({ otp_id: session.id })
    }

    if (action === 'verify') {
      const otp_id = payload.otp_id
      const code = String(payload.code || '').trim()
      if (!otp_id || !code) return json({ error: 'otp_id y code requeridos' }, 400)

      const { data: session, error } = await supabase
        .from('support_otp_sessions')
        .select('*')
        .eq('id', otp_id)
        .single()
      if (error || !session) return json({ error: 'Sesión OTP no encontrada' }, 404)

      if (session.verified_at) return json({ error: 'Este código ya fue verificado' }, 400)
      if (new Date(session.expires_at).getTime() < Date.now()) {
        return json({ error: 'El código expiró, solicita uno nuevo' }, 400)
      }
      if (session.attempts >= MAX_ATTEMPTS) {
        return json({ error: 'Demasiados intentos fallidos, solicita un nuevo código' }, 429)
      }

      const codeHash = await sha256Hex(code)
      if (codeHash !== session.code_hash) {
        await supabase.from('support_otp_sessions').update({ attempts: session.attempts + 1 }).eq('id', otp_id)
        return json({ error: 'Código incorrecto' }, 401)
      }

      const session_token = genToken()
      const { error: updErr } = await supabase
        .from('support_otp_sessions')
        .update({ verified_at: new Date().toISOString(), session_token })
        .eq('id', otp_id)
      if (updErr) return json({ error: updErr.message }, 500)

      return json({ session_token, client_email: session.client_email, verified: true })
    }

    return json({ error: 'action no reconocida' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
