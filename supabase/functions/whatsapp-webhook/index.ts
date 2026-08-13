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

// ── Detección de baja (opt-out) ───────────────────────────────────────────
// campana_minimalist promete en su pie 'Responde "Salir"', así que como mínimo
// hay que reconocer esa palabra. Se acepta el texto suelto y también el texto
// o payload de un botón de respuesta rápida.
const OPT_OUT_RE = /^\s*(salir|baja|stop|unsubscribe|dar de baja|no recibir(\s+m[áa]s)?(\s+mensajes)?)\s*[.!]?\s*$/i

function detectOptOut(msgType: string, content: any): { hit: boolean; source: string; raw: string } {
  if (msgType === 'text') {
    const t = String(content.text || '')
    if (OPT_OUT_RE.test(t)) return { hit: true, source: 'text', raw: t }
  }
  if (msgType === 'button') {
    const t = String(content.text || '')
    const p = String(content.payload || '')
    if (OPT_OUT_RE.test(t) || OPT_OUT_RE.test(p)) return { hit: true, source: 'button', raw: t || p }
  }
  return { hit: false, source: '', raw: '' }
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
          const clientPhone = `+${fromPhone}`
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

          // ── Baja (opt-out) ────────────────────────────────────────────
          // Se registra antes que nada: si el cliente pidió la baja, es lo
          // más importante que ocurre en este mensaje.
          const optOut = detectOptOut(msg.type, contentData)
          if (optOut.hit) {
            const { error: ooErr } = await supabase
              .from('whatsapp_opt_outs')
              .upsert({
                client_phone: clientPhone,
                opted_out_at: new Date().toISOString(),
                source:       optOut.source,
                raw_text:     optOut.raw,
              }, { onConflict: 'client_phone' })
            if (ooErr) console.error('[opt-out] no se pudo registrar:', ooErr.message)
            else console.log(`[opt-out] ${clientPhone} dado de baja (${optOut.source})`)
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
