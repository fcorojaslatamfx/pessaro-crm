// whatsapp-webhook v16
// Cambios respecto a v15:
//   - AUTOMATIZACIONES: se resuelve la intencion del entrante (boton de
//     respuesta rapida o texto libre) y se ejecutan tres flujos:
//       baja     -> whatsapp_opt_outs + crm_contacts.status='inactivo' + confirmacion
//       alta     -> marca opted_in_at (no borra la fila, conserva auditoria) + confirmacion
//       comenzar -> crm_contacts.status='activo', campaign_leads.etapa=2 + bienvenida
//   - La comparacion es por texto normalizado (sin tildes/mayusculas). El
//     patron anterior no reconocia "Darme de baja", que es el texto exacto del
//     boton aprobado: ninguna baja se estaba registrando.
//   - Se cubre msg.type 'interactive' (button_reply), que antes quedaba fuera.
//   - responder(): las respuestas automaticas van a Graph directamente (no via
//     whatsapp-send, que bloquea a los dados de baja) y se insertan en
//     whatsapp_messages con auto_reply=true para que salgan en las burbujas.
//   - Los botones de tipo URL siguen sin generar evento: Meta no avisa de ese
//     clic. Para automatizar "Comenzar" el boton debe ser de respuesta rapida.
//
// whatsapp-webhook v15
// Cambios respecto a v14:
//   - client_phone se guarda SOLO EN DIGITOS. Antes se anteponia '+' a msg.from,
//     lo que dejaba el sistema en dos formatos incompatibles con el CRM.
//     Ver migracion 20260813_telefonos_solo_digitos.sql.
//
// whatsapp-webhook v14
// Cambios respecto a v13:
//   - Plantillas en tiempo real: se procesan los eventos
//     message_template_status_update y template_category_update. Cuando Meta
//     aprueba (o rechaza/pausa) una plantilla, la fila de whatsapp_templates se
//     actualiza en segundos, sin depender de que alguien pulse "Sincronizar".
//     Antes de esto el catálogo del CRM sólo se movía con el sync manual, así
//     que una plantilla recién aprobada no aparecía nunca en el módulo WA.
//
// Cambios de v13 respecto a v12:
//   - Para mensajes inbound de tipo image/document/video/audio:
//     1) GET /v22.0/{media_id} con WA_PERMANENT_TOKEN → obtiene URL temporal + metadata
//     2) Descarga el binario desde la URL
//     3) Sube a Storage whatsapp-attachments/inbound/YYYY/MM/{uuid}.ext
//     4) INSERT del mensaje con media_storage_path, media_mime, media_size, media_meta_id
//   - Toda la descarga es SINCRONA pero con try/catch aislado.
//     Si falla, el mensaje se inserta sin media_storage_path y se loguea el error.
//   - Mantiene push notifications fan-out + status updates de v12.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WA_TOKEN     = Deno.env.get('WA_PERMANENT_TOKEN') ?? ''
const WA_PHONE_ID  = Deno.env.get('WA_PHONE_NUMBER_ID') ?? ''
const GRAPH_API    = 'https://graph.facebook.com/v22.0'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/gif':  'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'video/mp4':  'mp4',
  'video/3gpp': '3gp',
  'audio/aac':  'aac',
  'audio/amr':  'amr',
  'audio/mpeg': 'mp3',
  'audio/mp4':  'mp4',
  'audio/ogg':  'ogg',
}

function mimeToExt(mime: string): string {
  return MIME_TO_EXT[mime] || 'bin'
}

// ── Descarga media de Meta y la sube a Storage ────────────────────────────
async function downloadAndStoreMedia(
  supabase: any,
  mediaId: string,
  fallbackMime?: string,
): Promise<{ storagePath: string; mimeType: string; size: number; mediaId: string } | null> {
  try {
    if (!WA_TOKEN) {
      console.warn('[media] WA_PERMANENT_TOKEN no configurado, saltando descarga')
      return null
    }
    if (!mediaId) {
      console.warn('[media] media_id vacío')
      return null
    }

    // 1) Obtener URL temporal del media + metadata
    const metaRes = await fetch(`${GRAPH_API}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${WA_TOKEN}` },
    })
    if (!metaRes.ok) {
      const txt = await metaRes.text().catch(() => '')
      console.error(`[media] meta GET ${mediaId} status ${metaRes.status}: ${txt.slice(0, 200)}`)
      return null
    }
    const metaData = await metaRes.json()
    const mediaUrl = metaData.url
    const mimeType = metaData.mime_type || fallbackMime || 'application/octet-stream'
    const fileSize = parseInt(metaData.file_size, 10) || 0

    if (!mediaUrl) {
      console.error(`[media] no URL en respuesta de Meta para ${mediaId}`)
      return null
    }

    // 2) Descargar binario (URL temporal requiere el mismo token)
    const fileRes = await fetch(mediaUrl, {
      headers: { 'Authorization': `Bearer ${WA_TOKEN}` },
    })
    if (!fileRes.ok) {
      console.error(`[media] download fail ${mediaId}: ${fileRes.status}`)
      return null
    }
    const blob = await fileRes.blob()
    const actualSize = fileSize || blob.size

    // 3) Subir a Storage en inbound/YYYY/MM/uuid.ext
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const uid = crypto.randomUUID()
    const ext = mimeToExt(mimeType)
    const storagePath = `inbound/${yyyy}/${mm}/${uid}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('whatsapp-attachments')
      .upload(storagePath, blob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      })
    if (upErr) {
      console.error(`[media] storage upload fail:`, upErr.message)
      return null
    }

    console.log(`[media] OK ${mediaId} → ${storagePath} (${actualSize} bytes)`)
    return {
      storagePath,
      mimeType,
      size: actualSize,
      mediaId,
    }
  } catch (e) {
    console.error(`[media] error processing ${mediaId}:`, e instanceof Error ? e.message : String(e))
    return null
  }
}

// ── Helper: dispara push notification ─────────────────────────────────────
async function sendPushToUser(userId: string, notification: any) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/push_notifications_2026_02_27`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ action: 'send_to_user', userId, notification }),
    })
    if (!res.ok) {
      const t = await res.text()
      console.error(`[push to ${userId}] status ${res.status}: ${t}`)
    } else {
      const j = await res.json()
      console.log(`[push to ${userId}]`, JSON.stringify(j))
    }
  } catch (e) {
    console.error(`[push to ${userId}] error:`, e instanceof Error ? e.message : String(e))
  }
}

// ── Automatizaciones: detección de intención ──────────────────────────────
// Un clic en un botón de respuesta rápida llega como msg.type 'button'
// (plantillas) o 'interactive' → button_reply (mensajes interactivos), según
// el origen. Los botones de tipo URL NO generan ningún evento: abren el enlace
// en el navegador y Meta no avisa, así que no hay nada que disparar con ellos.
//
// La comparación es por texto normalizado (sin tildes ni mayúsculas) en vez de
// por un patrón rígido: el botón aprobado dice "Darme de baja" y el patrón
// anterior sólo aceptaba "dar de baja", así que las bajas no se registraban.
type Intencion = 'comenzar' | 'baja' | 'alta' | null

const normalizar = (s: string) =>
  String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')                       // signos fuera
    .replace(/\s+/g, ' ')
    .trim()

const FRASES: Record<Exclude<Intencion, null>, string[]> = {
  baja: [
    'darme de baja', 'dar de baja', 'baja', 'darse de baja', 'me doy de baja',
    'salir', 'stop', 'unsubscribe', 'no recibir mas mensajes', 'no recibir mensajes',
    'no recibir mas', 'eliminar', 'quitar de la lista',
  ],
  alta: ['alta', 'suscribir', 'suscribirme', 'quiero recibir informacion'],
  comenzar: ['comenzar', 'empezar', 'quiero empezar', 'quiero comenzar'],
}

function resolverIntencion(texto: string): Intencion {
  const t = normalizar(texto)
  if (!t) return null
  for (const [intencion, frases] of Object.entries(FRASES)) {
    if (frases.includes(t)) return intencion as Intencion
  }
  return null
}

// Unifica los dos formatos de botón + el texto libre en una sola cadena
function textoAccionable(msgType: string, content: any): { texto: string; source: string } | null {
  if (msgType === 'text')   return { texto: String(content.text || ''), source: 'text' }
  if (msgType === 'button') return { texto: String(content.text || content.payload || ''), source: 'button' }
  if (msgType === 'interactive') return { texto: String(content.title || ''), source: 'interactive' }
  return null
}

// ── Textos de las respuestas automáticas ──────────────────────────────────
const TEXTO_BIENVENIDA =
  'Gracias por dar el primer paso 👋\n\n' +
  'Soy parte del equipo de Pessaro Capital. Nuestro programa de *Inteligencia Financiera* ' +
  'existe para que entiendas dónde está tu dinero y por qué, antes de mover un peso.\n\n' +
  'Así avanzamos:\n\n' +
  '1️⃣ *Diagnóstico* — conversamos 20 minutos sobre tu situación y tus objetivos. Sin costo y sin compromiso.\n' +
  '2️⃣ *Formación* — accedes a nuestra sección educativa: 9 módulos y 67 lecciones sobre mercados, ' +
  'gestión de riesgo y análisis, a tu ritmo.\n' +
  '3️⃣ *Acompañamiento* — un asesor te guía en la práctica y resuelve tus dudas cuando aparecen.\n\n' +
  'Puedes empezar por la sección educativa ahora mismo:\n' +
  'https://pessarocapital.com/educacion\n\n' +
  'Un asesor te escribirá en breve para coordinar el diagnóstico. ' +
  'Si prefieres, respóndeme aquí y avanzamos por este medio.\n\n' +
  '_Pessaro Capital SpA · 17 años de experiencia en mercados financieros_'

const TEXTO_BAJA =
  'Entendido. Hemos desactivado las notificaciones para este número y ya no recibirás ' +
  'nuestras campañas. 🙌\n\n' +
  'Si más adelante quieres volver a recibir información, escribe *ALTA* en cualquier momento.\n\n' +
  'Gracias por tu tiempo. ¡Que tengas un excelente día!'

const TEXTO_ALTA =
  '¡Bienvenido de vuelta! ✅\n\n' +
  'Hemos reactivado las notificaciones para este número. Volverás a recibir nuestras ' +
  'novedades y contenidos de educación financiera.\n\n' +
  'Si en algún momento quieres dejar de recibirlos, escribe *BAJA*.'

// ── Respuesta automática ──────────────────────────────────────────────────
// Se envía a Graph directamente y NO vía whatsapp-send, a propósito: esa
// función bloquea cualquier envío a un número dado de baja, y aquí justamente
// hay que confirmarle la baja a quien la acaba de pedir.
// El clic en un botón abre la ventana de 24 h, así que es un mensaje de sesión
// (texto libre, sin plantilla).
async function responder(supabase: any, phone: string, texto: string): Promise<void> {
  if (!WA_PHONE_ID || !WA_TOKEN) {
    console.error('[auto] faltan WA_PHONE_NUMBER_ID / WA_PERMANENT_TOKEN, no se responde')
    return
  }
  try {
    const res = await fetch(`${GRAPH_API}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: texto, preview_url: true },
      }),
    })
    const r = await res.json()
    if (!r.messages?.[0]?.id) {
      console.error('[auto] Meta rechazó la respuesta:', JSON.stringify(r).slice(0, 300))
      return
    }
    // Se registra igual que cualquier saliente para que salga en las burbujas
    // del CRM; auto_reply lo diferencia de lo que escribe un asesor.
    await supabase.from('whatsapp_messages').insert({
      meta_message_id: r.messages[0].id,
      client_phone:    phone,
      direction:       'outbound',
      message_type:    'text',
      content:         { text: texto },
      status:          'sent',
      auto_reply:      true,
    })
  } catch (e) {
    console.error('[auto] error respondiendo:', e instanceof Error ? e.message : String(e))
  }
}

// ── Acciones de cada intención ────────────────────────────────────────────
async function accionBaja(supabase: any, phone: string, raw: string, source: string) {
  // 1) El bloqueo REAL de campañas es esta tabla: isOptedOut() la consulta en
  //    cada envío. Cambiar sólo crm_contacts.status NO excluye de las campañas,
  //    porque runCampaign() no filtra por estado al armar los destinatarios.
  const { error: ooErr } = await supabase.from('whatsapp_opt_outs').upsert({
    client_phone: phone,
    opted_out_at: new Date().toISOString(),
    opted_in_at:  null,          // por si se había reactivado antes
    source,
    raw_text:     raw,
  }, { onConflict: 'client_phone' })
  if (ooErr) console.error('[baja] no se pudo registrar:', ooErr.message)

  // 2) Estado visible para el asesor en Contactos
  await supabase.from('crm_contacts').update({ status: 'inactivo' }).eq('phone', phone)

  await responder(supabase, phone, TEXTO_BAJA)
  console.log(`[baja] ${phone} dado de baja (${source})`)
}

async function accionAlta(supabase: any, phone: string) {
  // No se borra la fila: marcarla conserva la auditoría de la baja original
  const { data: fila } = await supabase
    .from('whatsapp_opt_outs').select('client_phone').eq('client_phone', phone).maybeSingle()
  if (!fila) {
    // Nunca estuvo de baja: no hay nada que reactivar, no se responde para no
    // contestar un "alta" suelto en mitad de una conversación normal
    return
  }
  await supabase.from('whatsapp_opt_outs')
    .update({ opted_in_at: new Date().toISOString() }).eq('client_phone', phone)
  await supabase.from('crm_contacts').update({ status: 'activo' }).eq('phone', phone)
  await responder(supabase, phone, TEXTO_ALTA)
  console.log(`[alta] ${phone} reactivado`)
}

async function accionComenzar(supabase: any, phone: string) {
  await supabase.from('crm_contacts').update({ status: 'activo' }).eq('phone', phone)
  // etapa 2 = Contactado en el pipeline de campaign_leads
  await supabase.from('campaign_leads').update({ etapa: 2 }).eq('phone', phone).lt('etapa', 2)

  // Pulsar "Comenzar" es una petición explícita, así que se responde aunque el
  // contacto esté de baja. Lo que NO se hace es reactivarlo: salir de la lista
  // de campañas sólo se revierte con un ALTA explícito, como exige Meta.
  await responder(supabase, phone, TEXTO_BIENVENIDA)
  console.log(`[comenzar] ${phone} → bienvenida enviada`)
}

function makePreview(msgType: string, content: any): string {
  if (msgType === 'text') return (content.text || '').slice(0, 60)
  if (msgType === 'button') return content.text || 'Botón'
  if (msgType === 'interactive') return content.title || 'Respuesta interactiva'
  if (msgType === 'image') return '🖼 Imagen'
  if (msgType === 'document') return '📄 ' + (content.filename || 'Documento')
  if (msgType === 'video') return '🎬 Video'
  if (msgType === 'audio') return '🎵 Audio'
  if (msgType === 'location') return '📍 Ubicación'
  return 'Nuevo mensaje'
}

// ── Eventos de plantillas ─────────────────────────────────────────────────
// Meta manda message_template_status_update / template_category_update en su
// propio "change", separado de los mensajes. El payload trae sólo nombre,
// idioma, id y estado: NO trae el cuerpo ni las variables. Por eso, además de
// registrar el estado, se relee la plantilla completa desde Meta; sin ese paso
// una plantilla recién aprobada quedaría con body_text vacío y
// variables_count = 0, y el envío fallaría por parámetros faltantes.

// Espejo de las mismas helpers en whatsapp-send/index.ts (fuente de verdad del
// formato de la tabla). Si cambia el aplanado, cambiar en ambos lados.
function countVariables(bodyText: string): number {
  if (!bodyText) return 0
  const found = new Set<string>()
  for (const m of bodyText.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)) found.add(m[1])
  return found.size
}

function flattenTemplate(t: any) {
  const components: any[] = Array.isArray(t.components) ? t.components : []
  const header = components.find((c) => c.type === 'HEADER')
  const body   = components.find((c) => c.type === 'BODY')
  const footer = components.find((c) => c.type === 'FOOTER')
  const btns   = components.find((c) => c.type === 'BUTTONS')
  const bodyText = body?.text || ''

  return {
    template_name:    t.name,
    language:         t.language,
    category:         t.category || null,
    status:           t.status || null,
    header_type:      header ? (header.format || 'TEXT') : null,
    body_text:        bodyText,
    footer_text:      footer?.text || null,
    buttons:          btns?.buttons ? btns.buttons : null,
    variables_count:  countVariables(bodyText),
    parameter_format: t.parameter_format || 'POSITIONAL',
    meta_template_id: t.id ? String(t.id) : null,
    synced_at:        new Date().toISOString(),
  }
}

// El evento usa PENDING_DELETION donde la tabla usa DELETED; el resto de los
// estados de Meta se guardan tal cual.
function eventToStatus(event: string): string {
  return event === 'PENDING_DELETION' ? 'DELETED' : event
}

async function handleTemplateEvent(supabase: any, change: any): Promise<void> {
  const v = change?.value || {}
  const name     = v.message_template_name
  const language = v.message_template_language
  const metaId   = v.message_template_id ? String(v.message_template_id) : null
  if (!name || !language) {
    console.warn('[tpl-event] payload sin nombre/idioma:', JSON.stringify(v))
    return
  }

  // 1) Relectura de la plantilla completa desde Meta (trae components)
  let full: any = null
  if (metaId && WA_TOKEN) {
    try {
      const fields = 'id,name,language,status,category,parameter_format,components'
      const res = await fetch(`${GRAPH_API}/${metaId}?fields=${fields}`, {
        headers: { 'Authorization': `Bearer ${WA_TOKEN}` },
      })
      const data = await res.json()
      if (res.ok && data?.name) full = data
      else console.warn('[tpl-event] no se pudo releer la plantilla:', JSON.stringify(data))
    } catch (e) {
      console.warn('[tpl-event] error releyendo plantilla:', e instanceof Error ? e.message : String(e))
    }
  }

  if (full) {
    const row = flattenTemplate(full)
    // El estado del evento manda: la relectura puede llegar antes de que Meta
    // propague el nuevo estado a la API de lectura.
    if (v.event) row.status = eventToStatus(v.event)
    const { error } = await supabase
      .from('whatsapp_templates')
      .upsert(row, { onConflict: 'template_name,language' })
    if (error) console.error('[tpl-event] upsert error:', error.message)
    else console.log(`[tpl-event] ${change.field}: ${name} (${language}) → ${row.status}`)
    return
  }

  // 2) Fallback sin components: se actualiza sólo lo que trae el evento, y
  //    nunca se inventa una fila nueva vacía (rompería el envío). El sync
  //    manual completará el resto.
  const patch: Record<string, unknown> = { synced_at: new Date().toISOString() }
  if (v.event)        patch.status   = eventToStatus(v.event)
  if (v.new_category) patch.category = v.new_category
  if (metaId)         patch.meta_template_id = metaId

  const { data: updated, error } = await supabase
    .from('whatsapp_templates')
    .update(patch)
    .eq('template_name', name)
    .eq('language', language)
    .select('id')
  if (error) console.error('[tpl-event] update error:', error.message)
  else if (!updated?.length) {
    console.warn(`[tpl-event] ${name} (${language}) no está en el catálogo y Meta no devolvió el detalle: hace falta un sync manual`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)

  // ── Verificación del webhook (Meta) ────────────────────
  if (req.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const VERIFY_TOKEN = Deno.env.get('WA_VERIFY_TOKEN') || ''
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado por Meta')
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // ── Recepción de eventos ────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
      const entry = body.entry?.[0]

      // ── Plantillas ────────────────────────────────────────────
      // Van en su propio change y no traen messages/statuses, así que se
      // atienden antes y se corta acá.
      const tplChange = (entry?.changes || []).find((c: any) =>
        c?.field === 'message_template_status_update' || c?.field === 'template_category_update',
      )
      if (tplChange) {
        await handleTemplateEvent(supabase, tplChange)
        return new Response('OK', { status: 200 })
      }

      const changes = entry?.changes?.[0]?.value
      if (!changes) return new Response('OK', { status: 200 })

      // ── Status updates (delivered, read, failed, etc.) ───────────────────────────
      if (changes.statuses?.length) {
        for (const s of changes.statuses) {
          const update: Record<string, string> = { status: s.status }
          if (s.errors?.[0]) {
            update.error_code    = String(s.errors[0].code)
            update.error_message = s.errors[0].title || s.errors[0].message || ''
          }
          await supabase.from('whatsapp_messages').update(update).eq('meta_message_id', s.id)
        }
      }

      // ── Mensajes inbound ──────────────────────────────────────
      if (changes.messages?.length) {
        for (const msg of changes.messages) {
          const fromPhone = msg.from
          // Meta ya manda sólo dígitos. Antes se le anteponía '+' y ese era el
          // formato guardado en todo el sistema; ahora el formato único del CRM
          // es sólo dígitos, así que se guarda tal cual llega.
          const clientPhone = String(fromPhone).replace(/\D/g, '')
          const contactName = changes.contacts?.[0]?.profile?.name || ''

          let contentData: Record<string, unknown> = {}
          let mediaInfo: any = null // se popula si es image/document/video/audio
          let mediaName: string | null = null

          switch (msg.type) {
            case 'text':
              contentData = { text: msg.text.body }
              break
            case 'button':
              contentData = { text: msg.button?.text, payload: msg.button?.payload }
              break
            case 'interactive':
              contentData = {
                type:  msg.interactive?.type,
                title: msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title,
              }
              break
            case 'image':
            case 'document':
            case 'video':
            case 'audio': {
              const mediaPayload = msg[msg.type]
              const mediaId = mediaPayload?.id
              const mimeType = mediaPayload?.mime_type
              const caption = mediaPayload?.caption || ''
              mediaName = mediaPayload?.filename || null

              contentData = {
                media_id:  mediaId,
                mime_type: mimeType,
                caption,
                filename:  mediaName,
              }

              // NUEVO v13: descargar el archivo y subirlo a Storage
              if (mediaId) {
                mediaInfo = await downloadAndStoreMedia(supabase, mediaId, mimeType)
              }
              break
            }
            case 'location':
              contentData = { lat: msg.location?.latitude, lng: msg.location?.longitude }
              break
            default:
              contentData = { raw_type: msg.type }
          }

          // INSERT del mensaje (con campos media_* si la descarga fue exitosa)
          const insertRow: Record<string, unknown> = {
            meta_message_id: msg.id,
            client_phone:    clientPhone,
            client_name:     contactName,
            direction:       'inbound',
            message_type:    msg.type,
            content:         contentData,
            status:          'delivered',
          }
          if (mediaInfo) {
            insertRow.media_storage_path = mediaInfo.storagePath
            insertRow.media_mime         = mediaInfo.mimeType
            insertRow.media_size         = mediaInfo.size
            insertRow.media_meta_id      = mediaInfo.mediaId
            insertRow.media_name         = mediaName // se obtuvo del payload (solo para documents)
          }

          const { error: insertErr } = await supabase.from('whatsapp_messages').insert(insertRow)
          if (insertErr) {
            console.error('Insert error:', insertErr.message)
            continue
          }

          // ── Automatizaciones ──────────────────────────────────────────
          // Van antes que nada: si el cliente pidió la baja, es lo más
          // importante que ocurre en este mensaje.
          const accionable = textoAccionable(msg.type, contentData)
          const intencion  = accionable ? resolverIntencion(accionable.texto) : null
          if (intencion === 'baja') {
            await accionBaja(supabase, clientPhone, accionable!.texto, accionable!.source)
          } else if (intencion === 'alta') {
            await accionAlta(supabase, clientPhone)
          } else if (intencion === 'comenzar') {
            await accionComenzar(supabase, clientPhone)
          }

          // Asociar con lead si existe
          const { data: lead } = await supabase
            .from('campaign_leads')
            .select('id')
            .eq('phone', clientPhone)
            .maybeSingle()
          if (lead) {
            await supabase
              .from('whatsapp_messages')
              .update({ lead_id: lead.id })
              .eq('meta_message_id', msg.id)
          }

          // ── PUSH NOTIFICATION FAN-OUT ─────────────────────────────────
          try {
            const preview = makePreview(msg.type, contentData)
            const displayName = contactName || clientPhone
            const notification = {
              title: `💬 ${displayName}`,
              body:  preview,
              tag:   `wa-${clientPhone}`,
              phone: clientPhone,
              url:   '/',
            }

            const { data: assignment } = await supabase
              .from('whatsapp_assignments')
              .select('assigned_to')
              .eq('client_phone', clientPhone)
              .maybeSingle()

            const targets: string[] = []
            if (assignment?.assigned_to) {
              // El assigned_to apunta a crm_staff_profiles.id, hay que resolver a user_id
              const { data: staffRow } = await supabase
                .from('crm_staff_profiles')
                .select('user_id')
                .eq('id', assignment.assigned_to)
                .maybeSingle()
              if (staffRow?.user_id) targets.push(staffRow.user_id)
            } else {
              const { data: superAdmins } = await supabase
                .from('user_roles_2026_02_08_22_02')
                .select('user_id')
                .eq('role', 'super_admin')
              if (superAdmins) targets.push(...superAdmins.map((r: any) => r.user_id))
            }

            if (targets.length > 0) {
              console.log(`[wa-push] mensaje de ${clientPhone} → ${targets.length} targets`)
              await Promise.all(targets.map(uid => sendPushToUser(uid, notification)))
            } else {
              console.warn(`[wa-push] sin targets para ${clientPhone}`)
            }
          } catch (pushErr) {
            console.error('[wa-push] fan-out error (msg ya insertado):', pushErr instanceof Error ? pushErr.message : String(pushErr))
          }
        }
      }

      return new Response('OK', { status: 200 })
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method Not Allowed', { status: 405 })
})
