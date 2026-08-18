// documento_acceso v1
//
// Salas de documentos para invitados a una reunión. El enlace público
// (/documento/<token>) no da acceso a nada: identifica la sala y ya. Para
// descargar hay que demostrar que se controla un correo que está en la lista
// de invitados, con el mismo OTP de 6 dígitos que usa el portal de soporte.
//
// Actions públicas (sin JWT, como support_otp):
//   sala     → datos de portada de la sala. No revela invitados ni archivos.
//   request  → manda el código al correo SI está invitado. La respuesta es
//              siempre la misma: si dijera "no estás invitado", el formulario
//              se convertiría en una forma de averiguar quién va a la reunión.
//   verify   → canjea el código por un session_token de 1 h y lista archivos.
//   download → entrega el archivo. Devuelve BINARIO, no una URL: un enlace
//              firmado, aunque dure 60 s, es reenviable; esto no.
//
// Action de staff (valida el JWT a mano, porque la función es pública):
//   send_invites → manda el enlace a los invitados de la sala.
//
// Marca de agua: si la sala la pide y el archivo es PDF, cada página se estampa
// con el correo de quien descarga y un ID de descarga único, que queda también
// en crm_doc_accesos. Si una copia se filtra, ese ID dice de qué descarga salió.
// Si el estampado falla (PDF cifrado, por ejemplo) se devuelve error en vez del
// original: entregar sin marca cuando se pidió marca es incumplir en silencio.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1"

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
  // Sin esto el navegador no deja leer el ID de descarga de la respuesta
  'Access-Control-Expose-Headers': 'X-Download-Code',
}

const BUCKET = 'crm-documentos'
const CRM_URL = 'https://crm.pessaro.cl'
const OTP_TTL_MIN = 10
const SESSION_TTL_MIN = 60
const MAX_ATTEMPTS = 5
const MAX_REQUESTS_PER_WINDOW = 3
const RATE_WINDOW_MIN = 10

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function genCode(): string {
  const b = new Uint32Array(1)
  crypto.getRandomValues(b)
  return String(b[0] % 1000000).padStart(6, '0')
}

function genToken(): string {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
}

// ID de descarga legible: se estampa en el PDF y se dicta por teléfono si hace
// falta rastrear una filtración. Sin vocales para no formar palabras.
function genDownloadCode(): string {
  const abc = '0123456789BCDFGHJKLMNPQRSTVWXZ'
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  const s = Array.from(b).map(x => abc[x % abc.length]).join('')
  return `PSR-${s.slice(0, 4)}-${s.slice(4, 8)}`
}

async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const normEmail = (v: string) => String(v || '').trim().toLowerCase()

async function sendEmail(to: string, subject: string, html: string) {
  const KEY = Deno.env.get('RESEND_API_KEY')
  if (!KEY) throw new Error('RESEND_API_KEY no configurado')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Pessaro Capital <send@pessaro.cl>', to: [to], subject, html }),
  })
  if (!res.ok) throw new Error(`Resend: ${await res.text()}`)
}

function envoltorio(titulo: string, cuerpo: string) {
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a1628;color:#fff;border-radius:16px">
      <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#f0a500;font-weight:700;margin:0 0 14px">Pessaro Capital</p>
      <h2 style="font-size:18px;margin:0 0 10px">${titulo}</h2>
      ${cuerpo}
    </div>`
}

// ── Marca de agua ───────────────────────────────────────────────────────────
// Diagonal con el correo en cada página, y un pie con el ID de descarga y la
// fecha. Va por encima del contenido, translúcida, para que estorbe poco al
// leer pero no se pueda recortar sin que se note.
const MARCA = 'Pessaro Capital'

async function estampar(bytes: Uint8Array, email: string, code: string): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await PDFDocument.load(bytes)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontMarca = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fecha = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })
  // La diagonal dice de quién es el documento; el pie, a quién se le entregó.
  // Separarlos deja la marca legible y conserva la trazabilidad de la copia.
  const pie = `Descargado por ${email} · ${fecha} · ID ${code} · Uso exclusivo del destinatario`

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize()

    // Ocupa ~62 % de la diagonal, así queda igual de proporcionada en vertical
    // y en apaisado en vez de salirse en una y perderse en la otra.
    const objetivo = Math.hypot(width, height) * 0.62
    // Se mide con la MISMA fuente con la que se dibuja: la negrita es más
    // ancha que la normal y el tamaño saldría corto.
    const size = objetivo / fontMarca.widthOfTextAtSize(MARCA, 100) * 100
    const ancho = fontMarca.widthOfTextAtSize(MARCA, size)
    // El texto sale desde su origen hacia arriba a 45°: se retrocede media
    // diagonal para que quede centrado en la página.
    page.drawText(MARCA, {
      x: width / 2 - (ancho / 2) * Math.SQRT1_2,
      y: height / 2 - (ancho / 2) * Math.SQRT1_2,
      size, font: fontMarca, color: rgb(0.45, 0.45, 0.5), opacity: 0.12, rotate: degrees(45),
    })

    const piePx = 6.5
    page.drawText(pie, {
      x: Math.max(8, (width - font.widthOfTextAtSize(pie, piePx)) / 2),
      y: 10, size: piePx, font, color: rgb(0.35, 0.35, 0.4), opacity: 0.75,
    })
  }
  // La copia no es cosmética: pdf.save() devuelve un Uint8Array cuyo búfer
  // TypeScript tipa como ArrayBufferLike, y Response sólo acepta ArrayBuffer.
  return new Uint8Array(await pdf.save())
}

// Sala vigente: activa y sin caducar. Es la única puerta de entrada.
async function salaVigente(supabase: any, token: string) {
  const { data } = await supabase
    .from('crm_doc_salas').select('*').eq('public_token', token).maybeSingle()
  if (!data || !data.is_active) return null
  if (new Date(data.expires_at) < new Date()) return { ...data, caducada: true }
  return data
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { action, ...p } = await req.json()

    // ── sala ────────────────────────────────────────────────────────────────
    if (action === 'sala') {
      const s = await salaVigente(supabase, p.token || '')
      if (!s) return json({ error: 'Esta sala no existe o fue desactivada.' }, 404)
      if (s.caducada) {
        const f = new Date(s.expires_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        return json({ caducada: true, error: `El acceso a «${s.titulo}» venció el ${f}.` }, 410)
      }
      const { count } = await supabase
        .from('crm_doc_archivos').select('id', { count: 'exact', head: true }).eq('sala_id', s.id)
      return json({
        titulo: s.titulo, descripcion: s.descripcion,
        meeting_at: s.meeting_at, expires_at: s.expires_at, archivos: count || 0,
      })
    }

    // ── request ─────────────────────────────────────────────────────────────
    if (action === 'request') {
      const email = normEmail(p.email)
      const s = await salaVigente(supabase, p.token || '')
      if (!s || s.caducada) return json({ error: 'Esta sala ya no está disponible.' }, 410)
      if (!email.includes('@')) return json({ error: 'Indica un correo válido.' }, 400)

      // Respuesta uniforme pase lo que pase: no se filtra quién está invitado
      const ok = { success: true, message: 'Si el correo está en la lista de invitados, recibirás un código en un minuto.' }

      const { data: inv } = await supabase
        .from('crm_doc_invitados').select('id, full_name')
        .eq('sala_id', s.id).eq('email', email).maybeSingle()
      if (!inv) return json(ok)

      // Tope de códigos por ventana, igual que en soporte
      const desde = new Date(Date.now() - RATE_WINDOW_MIN * 60000).toISOString()
      const { count } = await supabase
        .from('crm_doc_sesiones').select('id', { count: 'exact', head: true })
        .eq('sala_id', s.id).eq('email', email).gte('created_at', desde)
      if ((count || 0) >= MAX_REQUESTS_PER_WINDOW) {
        return json({ error: `Demasiados intentos. Espera ${RATE_WINDOW_MIN} minutos.` }, 429)
      }

      const code = genCode()
      const { error: insErr } = await supabase.from('crm_doc_sesiones').insert({
        sala_id: s.id, email, code_hash: await sha256Hex(code),
        expires_at: new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString(),
      })
      if (insErr) return json({ error: insErr.message }, 500)

      await sendEmail(email, `Tu código para «${s.titulo}»`, envoltorio(
        `Hola${inv.full_name ? ` ${inv.full_name}` : ''}, este es tu código`,
        `<p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;margin:0 0 22px">
           Ingrésalo para ver los documentos de <strong style="color:#fff">${s.titulo}</strong>. Expira en ${OTP_TTL_MIN} minutos.
         </p>
         <div style="text-align:center;padding:18px 0;background:rgba(255,255,255,0.06);border-radius:12px;margin-bottom:20px">
           <span style="font-size:34px;font-weight:800;letter-spacing:0.4em;color:#fff;font-family:monospace">${code}</span>
         </div>
         <p style="font-size:11px;color:rgba(255,255,255,0.35);margin:0">Si no solicitaste este código, ignora este correo.</p>`,
      ))
      return json(ok)
    }

    // ── verify ──────────────────────────────────────────────────────────────
    if (action === 'verify') {
      const email = normEmail(p.email)
      const s = await salaVigente(supabase, p.token || '')
      if (!s || s.caducada) return json({ error: 'Esta sala ya no está disponible.' }, 410)

      const { data: ses } = await supabase
        .from('crm_doc_sesiones').select('*')
        .eq('sala_id', s.id).eq('email', email).is('verified_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!ses) return json({ error: 'Pide un código nuevo.' }, 400)
      if (new Date(ses.expires_at) < new Date()) return json({ error: 'El código expiró. Pide uno nuevo.' }, 400)
      if (ses.attempts >= MAX_ATTEMPTS) return json({ error: 'Demasiados intentos fallidos. Pide un código nuevo.' }, 429)

      if (await sha256Hex(String(p.code || '')) !== ses.code_hash) {
        await supabase.from('crm_doc_sesiones').update({ attempts: ses.attempts + 1 }).eq('id', ses.id)
        return json({ error: `Código incorrecto. Te quedan ${MAX_ATTEMPTS - ses.attempts - 1} intentos.` }, 400)
      }

      const token = genToken()
      await supabase.from('crm_doc_sesiones').update({
        verified_at: new Date().toISOString(), session_token: token,
      }).eq('id', ses.id)

      // Marca del primer acceso, para que el CRM sepa quién ya entró
      await supabase.from('crm_doc_invitados')
        .update({ first_access_at: new Date().toISOString() })
        .eq('sala_id', s.id).eq('email', email).is('first_access_at', null)

      const { data: archivos } = await supabase
        .from('crm_doc_archivos').select('id, original_name, mime_type, file_size')
        .eq('sala_id', s.id).order('created_at')

      return json({
        success: true, session_token: token,
        expires_in_min: SESSION_TTL_MIN,
        titulo: s.titulo, descripcion: s.descripcion,
        archivos: archivos || [],
      })
    }

    // ── download ────────────────────────────────────────────────────────────
    if (action === 'download') {
      const { data: ses } = await supabase
        .from('crm_doc_sesiones').select('*')
        .eq('session_token', String(p.session_token || '')).maybeSingle()
      if (!ses || !ses.verified_at) return json({ error: 'Sesión no válida. Verifica tu correo otra vez.' }, 401)
      // La sesión dura 1 h desde que se verificó, no desde que se pidió el código
      if (new Date(ses.verified_at).getTime() + SESSION_TTL_MIN * 60000 < Date.now()) {
        return json({ error: 'Tu sesión expiró. Verifica tu correo otra vez.' }, 401)
      }

      const { data: sala } = await supabase.from('crm_doc_salas').select('*').eq('id', ses.sala_id).maybeSingle()
      if (!sala || !sala.is_active || new Date(sala.expires_at) < new Date()) {
        return json({ error: 'Esta sala ya no está disponible.' }, 410)
      }

      const { data: arch } = await supabase
        .from('crm_doc_archivos').select('*')
        .eq('id', String(p.archivo_id || '')).eq('sala_id', sala.id).maybeSingle()
      if (!arch) return json({ error: 'Archivo no encontrado en esta sala.' }, 404)

      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(arch.file_path)
      if (dlErr || !blob) return json({ error: 'No se pudo leer el archivo.' }, 500)

      let bytes = new Uint8Array(await blob.arrayBuffer())
      const code = genDownloadCode()
      const esPdf = (arch.mime_type || '').includes('pdf')

      if (sala.watermark && esPdf) {
        try {
          bytes = await estampar(bytes, ses.email, code)
        } catch (e) {
          console.error('[documento_acceso] watermark:', e)
          return json({ error: 'No se pudo preparar el documento para la descarga. Avisa a quien te invitó.' }, 500)
        }
      }

      const { data: inv } = await supabase
        .from('crm_doc_invitados').select('id').eq('sala_id', sala.id).eq('email', ses.email).maybeSingle()

      await supabase.from('crm_doc_accesos').insert({
        sala_id: sala.id, archivo_id: arch.id, invitado_id: inv?.id || null,
        email: ses.email, download_code: code,
        user_agent: req.headers.get('user-agent'),
      })

      // Binario directo: no se emite ninguna URL que pueda reenviarse
      return new Response(bytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': arch.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${arch.original_name.replace(/"/g, '')}"`,
          'X-Download-Code': code,
        },
      })
    }

    // ── send_invites (staff) ────────────────────────────────────────────────
    // La función es pública, así que el JWT se valida aquí a mano.
    if (action === 'send_invites') {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
      const { data: { user } } = await supabase.auth.getUser(jwt)
      if (!user) return json({ error: 'No autenticado' }, 401)
      const rol = (user.user_metadata as any)?.role || 'asesor'
      if (!['super_admin', 'admin', 'asesor'].includes(rol)) {
        const { data: staff } = await supabase.from('crm_staff_profiles').select('id').eq('user_id', user.id).maybeSingle()
        if (!staff) return json({ error: 'Solo el staff puede enviar invitaciones' }, 403)
      }

      const { data: sala } = await supabase.from('crm_doc_salas').select('*').eq('id', String(p.sala_id || '')).maybeSingle()
      if (!sala) return json({ error: 'Sala no encontrada' }, 404)

      let q = supabase.from('crm_doc_invitados').select('*').eq('sala_id', sala.id)
      // Por defecto sólo a quien no se le ha mandado: reenviar a todos cada vez
      // que se agrega un invitado sería spam para los demás.
      if (!p.reenviar) q = q.is('invite_sent_at', null)
      const { data: invitados } = await q
      if (!invitados?.length) return json({ success: true, enviados: 0, message: 'No hay invitados pendientes de aviso.' })

      const enlace = `${CRM_URL}/documento/${sala.public_token}`
      const vence = new Date(sala.expires_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
      let enviados = 0
      const errores: any[] = []

      for (const inv of invitados) {
        try {
          await sendEmail(inv.email, `Documentos de «${sala.titulo}»`, envoltorio(
            `Hola${inv.full_name ? ` ${inv.full_name}` : ''}, aquí están los documentos`,
            `<p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;margin:0 0 20px">
               ${sala.descripcion ? `${sala.descripcion}<br><br>` : ''}
               Para verlos se te pedirá <strong style="color:#fff">este mismo correo</strong> y un código de un solo uso que enviaremos ahí.
               El acceso está disponible hasta el <strong style="color:#fff">${vence}</strong>.
             </p>
             <div style="text-align:center;margin-bottom:20px">
               <a href="${enlace}" style="display:inline-block;background:#6c5ce7;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-size:14px;font-weight:700">Ver los documentos</a>
             </div>
             <p style="font-size:11px;color:rgba(255,255,255,0.35);margin:0;word-break:break-all">O copia este enlace: ${enlace}</p>`,
          ))
          await supabase.from('crm_doc_invitados')
            .update({ invite_sent_at: new Date().toISOString() }).eq('id', inv.id)
          enviados++
        } catch (e) {
          errores.push({ email: inv.email, error: e instanceof Error ? e.message : String(e) })
        }
      }
      return json({ success: true, enviados, fallidos: errores.length, errores: errores.slice(0, 10) })
    }

    return json({ error: 'action no reconocida' }, 400)
  } catch (err) {
    console.error('[documento_acceso] uncaught:', err)
    return json({ error: (err as Error).message }, 500)
  }
})
