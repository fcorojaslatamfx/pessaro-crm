// whatsapp-send v15
// Actions: send_text, send_template, send_media, start_chat, sync_templates, send_campaign
//
// CAMBIOS v15:
//  - OPT-OUT: ninguna action envía a un número presente en whatsapp_opt_outs.
//      El bloqueo va en el backend a propósito: es la única capa por la que
//      pasan todos los caminos de envío (asesor, campaña, start_chat).
//  - Encabezado de imagen: send_template y send_campaign arman el componente
//      'header' cuando la plantilla tiene header_type = IMAGE. Sin esto Meta
//      rechaza el envío por parámetros faltantes (caso campana_minimalist).
//  - send_campaign (NUEVO): envío masivo a campaign_leads según target_filter,
//      con deduplicación por teléfono, exclusión de bajas y registro por
//      mensaje en whatsapp_messages.wa_campaign_id (los contadores los
//      recalcula el trigger trg_wa_campaign_counters).
//
// CAMBIOS v14:
//  - sync_templates (NUEVO): super_admin sincroniza el catálogo de plantillas
//      desde Meta (GET /{WABA_ID}/message_templates, con paginación) hacia la
//      tabla whatsapp_templates. Las plantillas que ya no existen en Meta se
//      marcan status='DELETED' (no se borran, por la FK de whatsapp_campaigns).
//
// CAMBIOS v13:
//  - send_text: requiere staff CRM autenticado + ownership del chat
//      Ownership: caller es super_admin O tiene asignación en whatsapp_assignments
//  - send_template: igual validación de ownership
//  - send_media: continúa restringido a super_admin (sin cambios)
//  - start_chat: asesor inicia chat con su contacto vía plantilla
//      Valida: el teléfono está en crm_contacts del caller
//      Verifica: no hay asignación a OTRO asesor
//      Envía plantilla + auto-asigna chat al caller (si no estaba asignado)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
}
const GRAPH_API = 'https://graph.facebook.com/v22.0'

const MEDIA_LIMITS: Record<string, number> = {
  'image/jpeg':                                                                       5 * 1024 * 1024,
  'image/png':                                                                        5 * 1024 * 1024,
  'application/pdf':                                                                  100 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':          100 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':                100 * 1024 * 1024,
}
const IMAGE_MIMES = ['image/jpeg', 'image/png']

function mimeToWhatsappType(mime: string): 'image' | 'document' | null {
  if (IMAGE_MIMES.includes(mime)) return 'image'
  if (mime in MEDIA_LIMITS)       return 'document'
  return null
}

function normalizePhone(phone: string): string {
  // Normaliza '+56 9 7331 2927' -> '+56973312927' para comparación
  return phone.replace(/[^\d+]/g, '')
}

async function authenticate(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  const accessToken = authHeader.replace(/^Bearer\s+/i, '')
  if (!accessToken) return { caller: null, role: null, staffId: null }
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  if (error || !user) return { caller: null, role: null, staffId: null }
  const role = (user.user_metadata as any)?.role || 'asesor'
  let staffId: string | null = null
  if (role !== 'super_admin') {
    const { data: staff } = await supabase
      .from('crm_staff_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    staffId = staff?.id || null
    if (!staffId) return { caller: null, role: null, staffId: null }
  }
  return { caller: user, role, staffId }
}

async function canSendToPhone(supabase: any, role: string, staffId: string | null, phone: string): Promise<boolean> {
  if (role === 'super_admin') return true
  if (!staffId) return false
  // Asesor/admin: verifica que tenga asignación del chat
  const { data } = await supabase
    .from('whatsapp_assignments')
    .select('id')
    .eq('client_phone', phone)
    .eq('assigned_to', staffId)
    .maybeSingle()
  return !!data
}

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Número tal como lo espera Meta: solo dígitos
function toWaNumber(phone: string): string {
  return normalizePhone(phone).replace(/\+/g, '')
}

// ── Opt-out ────────────────────────────────────────────────────────────────
// Se compara normalizado porque los teléfonos entran con formatos distintos
// según su origen (crm_contacts a mano, campaign_leads desde landing, webhook).
async function isOptedOut(supabase: any, phone: string): Promise<boolean> {
  const { data } = await supabase
    .from('whatsapp_opt_outs')
    .select('client_phone')
    .eq('client_phone', normalizePhone(phone))
    .maybeSingle()
  return !!data
}

const OPT_OUT_MSG = 'Este contacto pidió no recibir más mensajes. No se puede enviar.'

// ── Componentes de plantilla ───────────────────────────────────────────────
// Meta exige el componente 'header' en CADA envío cuando la plantilla tiene
// encabezado de imagen: la imagen que se sube al crear la plantilla es solo
// el ejemplo para el revisor, no viaja con el mensaje.
function buildComponents(
  headerType: string | null,
  bodyValues: string[],
  headerImageUrl?: string | null,
): any[] {
  const components: any[] = []
  if (headerType === 'IMAGE' && headerImageUrl) {
    components.push({ type: 'header', parameters: [{ type: 'image', image: { link: headerImageUrl } }] })
  }
  if (bodyValues.length) {
    components.push({ type: 'body', parameters: bodyValues.map((v) => ({ type: 'text', text: v })) })
  }
  return components
}

// ── Helpers de sync_templates ──────────────────────────────────────────────

// Cuenta placeholders distintos del body: soporta posicionales {{1}} y nombrados {{nombre}}
function countVariables(bodyText: string): number {
  if (!bodyText) return 0
  const found = new Set<string>()
  for (const m of bodyText.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)) found.add(m[1])
  return found.size
}

// Aplana los components de Meta al formato plano de la tabla whatsapp_templates
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const PHONE_ID = Deno.env.get('WA_PHONE_NUMBER_ID')
    const TOKEN = Deno.env.get('WA_PERMANENT_TOKEN')
    if (!PHONE_ID || !TOKEN) return json({ error: 'WA credentials not configured' }, 500)

    const { action, ...payload } = await req.json()

    // Autenticación común a todas las actions
    const { caller, role, staffId } = await authenticate(supabase, req)
    if (!caller) return json({ error: 'No autenticado' }, 401)

    // ── sync_templates (NUEVO) ───────────────────────────────────────
    // Trae el catálogo completo de plantillas desde Meta y lo refleja en
    // whatsapp_templates. Solo super_admin.
    if (action === 'sync_templates') {
      if (role !== 'super_admin') {
        return json({ error: 'Solo super_admin puede sincronizar plantillas' }, 403)
      }

      const WABA_ID = Deno.env.get('WA_WABA_ID')
      if (!WABA_ID) {
        return json({ error: 'WA_WABA_ID no configurado en los secrets de Supabase' }, 500)
      }

      // 1) Traer todas las plantillas (paginando por paging.next)
      const fields = 'id,name,language,status,category,parameter_format,components'
      let nextUrl: string | null = `${GRAPH_API}/${WABA_ID}/message_templates?limit=100&fields=${fields}`
      const metaTemplates: any[] = []

      while (nextUrl) {
        const res: Response = await fetch(nextUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } })
        const page = await res.json()
        if (!res.ok) {
          console.error('[sync_templates] Meta error:', JSON.stringify(page))
          return json({
            success: false,
            error: page.error?.message || `Meta respondió ${res.status}`,
            meta_response: page,
          }, 400)
        }
        if (Array.isArray(page.data)) metaTemplates.push(...page.data)
        nextUrl = page.paging?.next || null
      }

      // 2) Upsert de cada plantilla (clave: template_name + language)
      const rows = metaTemplates.map(flattenTemplate).filter((r) => r.template_name && r.language)
      let upserted = 0
      if (rows.length) {
        const { error: upErr } = await supabase
          .from('whatsapp_templates')
          .upsert(rows, { onConflict: 'template_name,language' })
        if (upErr) {
          console.error('[sync_templates] upsert error:', upErr.message)
          return json({ success: false, error: `Error guardando plantillas: ${upErr.message}` }, 500)
        }
        upserted = rows.length
      }

      // 3) Marcar como DELETED las que ya no existen en Meta.
      //    No se borran para no romper la FK de whatsapp_campaigns.template_id.
      let marked_deleted = 0
      const { data: local } = await supabase
        .from('whatsapp_templates')
        .select('id, template_name, language, status')
      const liveKeys = new Set(rows.map((r) => `${r.template_name}|${r.language}`))
      const stale = (local || []).filter(
        (l: any) => l.status !== 'DELETED' && !liveKeys.has(`${l.template_name}|${l.language}`),
      )
      if (stale.length) {
        const { error: delErr } = await supabase
          .from('whatsapp_templates')
          .update({ status: 'DELETED', synced_at: new Date().toISOString() })
          .in('id', stale.map((s: any) => s.id))
        if (delErr) console.error('[sync_templates] mark deleted error:', delErr.message)
        else marked_deleted = stale.length
      }

      const approved = rows.filter((r) => r.status === 'APPROVED')
      return json({
        success: true,
        synced: upserted,
        approved: approved.length,
        marked_deleted,
        templates: rows.map((r) => ({
          name: r.template_name,
          language: r.language,
          status: r.status,
          category: r.category,
          variables: r.variables_count,
        })),
      })
    }

    // ── send_text ────────────────────────────────────────────────────
    if (action === 'send_text') {
      const { to, text, staff_id, lead_id, campaign_id } = payload
      if (!to || !text) return json({ error: 'to y text requeridos' }, 400)

      const allowed = await canSendToPhone(supabase, role, staffId, to)
      if (!allowed) {
        return json({ error: 'No tienes acceso a este chat. Pide al super admin que te lo asigne.' }, 403)
      }
      if (await isOptedOut(supabase, to)) return json({ error: OPT_OUT_MSG }, 403)

      const res = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\+/g, ''), type: 'text', text: { preview_url: true, body: text } }),
      })
      const result = await res.json()
      if (result.messages?.[0]?.id) {
        await supabase.from('whatsapp_messages').insert({ meta_message_id: result.messages[0].id, client_phone: to, direction: 'outbound', message_type: 'text', content: { text }, status: 'sent', staff_id: staff_id || staffId || null, lead_id: lead_id || null, campaign_id: campaign_id || null })
        return json({ success: true, message_id: result.messages[0].id })
      }
      return json({ success: false, error: result.error?.message || 'Unknown Meta error', meta_response: result }, 400)
    }

    // ── send_template ────────────────────────────────────────────────
    if (action === 'send_template') {
      const { to, template_name, language, components, header_image_url, staff_id, lead_id, campaign_id } = payload
      if (!to || !template_name) return json({ error: 'to y template_name requeridos' }, 400)

      const allowed = await canSendToPhone(supabase, role, staffId, to)
      if (!allowed) {
        return json({ error: 'No tienes acceso a este chat. Pide al super admin que te lo asigne.' }, 403)
      }
      if (await isOptedOut(supabase, to)) return json({ error: OPT_OUT_MSG }, 403)

      // Si la plantilla lleva encabezado de imagen, se antepone su componente.
      // Se consulta el catálogo en vez de confiar en el frontend: así un cliente
      // desactualizado no puede provocar un envío inválido.
      let finalComponents: any[] = components || []
      const { data: tpl } = await supabase
        .from('whatsapp_templates')
        .select('header_type')
        .eq('template_name', template_name)
        .eq('language', language || 'es')
        .maybeSingle()

      if (tpl?.header_type === 'IMAGE') {
        if (!header_image_url) {
          return json({ error: `La plantilla "${template_name}" tiene encabezado de imagen y requiere header_image_url.` }, 400)
        }
        if (!finalComponents.some((c: any) => c.type === 'header')) {
          finalComponents = [
            { type: 'header', parameters: [{ type: 'image', image: { link: header_image_url } }] },
            ...finalComponents,
          ]
        }
      }

      const res = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\+/g, ''), type: 'template', template: { name: template_name, language: { code: language || 'es' }, components: finalComponents } }),
      })
      const result = await res.json()
      if (result.messages?.[0]?.id) {
        await supabase.from('whatsapp_messages').insert({ meta_message_id: result.messages[0].id, client_phone: to, direction: 'outbound', message_type: 'template', template_name, content: { template_name, components: finalComponents }, status: 'sent', staff_id: staff_id || staffId || null, lead_id: lead_id || null, campaign_id: campaign_id || null })
        return json({ success: true, message_id: result.messages[0].id })
      }
      return json({ success: false, error: result.error?.message || 'Meta error', meta_response: result }, 400)
    }

    // ── start_chat ───────────────────────────────────────────────────
    // Asesor/admin inicia chat con su contacto vía plantilla aprobada.
    // Valida que el teléfono esté en sus crm_contacts y que no haya asignación a otro.
    if (action === 'start_chat') {
      const { to, template_name, language, components, contact_id } = payload
      if (!to || !template_name) return json({ error: 'to y template_name requeridos' }, 400)
      if (await isOptedOut(supabase, to)) return json({ error: OPT_OUT_MSG }, 403)

      const normalizedTo = normalizePhone(to)

      // Verificar que el teléfono pertenezca al usuario en crm_contacts
      // Comparamos normalizando (sin espacios) para evitar mismatches '+56 9 X' vs '+569X'
      if (role !== 'super_admin') {
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, phone')
          .eq('user_id', caller.id)
        const owned = (contacts || []).some((c: any) => normalizePhone(c.phone || '') === normalizedTo)
        if (!owned) {
          return json({ error: 'Este teléfono no está en tus contactos. Agrégalo primero a Mis Contactos.' }, 403)
        }
      }

      // Verificar asignación existente (no debe ser de otro asesor)
      const { data: existing } = await supabase
        .from('whatsapp_assignments')
        .select('assigned_to')
        .eq('client_phone', to)
        .maybeSingle()

      if (existing && existing.assigned_to !== staffId && role !== 'super_admin') {
        // Ya está asignado a otro asesor
        const { data: otherStaff } = await supabase
          .from('crm_staff_profiles')
          .select('display_name')
          .eq('id', existing.assigned_to)
          .maybeSingle()
        return json({
          error: `Este chat ya está asignado a ${otherStaff?.display_name || 'otro asesor'}. Pide al super admin que lo reasigne si necesitas tomarlo.`,
        }, 403)
      }

      // Enviar plantilla
      const sendRes = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace(/\+/g, ''),
          type: 'template',
          template: { name: template_name, language: { code: language || 'es' }, components: components || [] },
        }),
      })
      const sendResult = await sendRes.json()
      if (!sendResult.messages?.[0]?.id) {
        return json({ success: false, error: sendResult.error?.message || 'Meta send failed', meta_response: sendResult }, 400)
      }

      // Registrar mensaje
      await supabase.from('whatsapp_messages').insert({
        meta_message_id: sendResult.messages[0].id,
        client_phone:    to,
        direction:       'outbound',
        message_type:    'template',
        template_name,
        content:         { template_name, components },
        status:          'sent',
        staff_id:        staffId || null,
        lead_id:         null,
        campaign_id:     null,
      })

      // Auto-asignar el chat al caller si no estaba asignado (y caller no es super_admin)
      let assignment = null
      if (!existing && staffId && role !== 'super_admin') {
        const { data: assigned } = await supabase
          .from('whatsapp_assignments')
          .insert({
            client_phone: to,
            assigned_to:  staffId,
            assigned_by:  staffId, // se auto-asigna
            assigned_at:  new Date().toISOString(),
          })
          .select()
          .maybeSingle()
        assignment = assigned
      }

      return json({
        success: true,
        message_id: sendResult.messages[0].id,
        assignment,
      })
    }

    // ── send_media (super_admin only) ────────────────────────────────
    if (action === 'send_media') {
      if (role !== 'super_admin') {
        return json({ error: 'Solo super_admin puede enviar adjuntos' }, 403)
      }

      const { to, storage_path, media_mime, media_name, media_size, caption, assign_to_user_id, staff_id, lead_id, campaign_id } = payload
      if (!to || !storage_path || !media_mime) return json({ error: 'to, storage_path y media_mime requeridos' }, 400)
      if (await isOptedOut(supabase, to)) return json({ error: OPT_OUT_MSG }, 403)

      const waType = mimeToWhatsappType(media_mime)
      if (!waType) return json({ error: `Tipo no soportado: ${media_mime}` }, 400)

      const sizeLimit = MEDIA_LIMITS[media_mime]
      if (media_size && media_size > sizeLimit) {
        return json({ error: `Archivo excede límite Meta para ${media_mime}: ${Math.round(sizeLimit/1024/1024)}MB` }, 400)
      }

      const cleanPath = storage_path.replace(/^whatsapp-attachments\//, '')
      const { data: fileBlob, error: dlError } = await supabase.storage.from('whatsapp-attachments').download(cleanPath)
      if (dlError || !fileBlob) {
        console.error('[send_media] storage download error:', dlError)
        return json({ error: 'No se pudo leer el archivo del Storage', detail: dlError?.message }, 500)
      }

      const fd = new FormData()
      fd.append('messaging_product', 'whatsapp')
      fd.append('type', media_mime)
      fd.append('file', fileBlob, media_name || 'file')

      const uploadRes = await fetch(`${GRAPH_API}/${PHONE_ID}/media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` },
        body: fd,
      })
      const uploadResult = await uploadRes.json()
      if (!uploadResult.id) {
        console.error('[send_media] meta upload fail:', uploadResult)
        return json({ success: false, error: uploadResult.error?.message || 'Meta media upload failed', meta_response: uploadResult }, 400)
      }
      const metaMediaId = uploadResult.id

      const mediaObj: any = { id: metaMediaId }
      if (caption && caption.trim()) mediaObj.caption = caption.trim()
      if (waType === 'document' && media_name) mediaObj.filename = media_name

      const sendRes = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\+/g, ''), type: waType, [waType]: mediaObj }),
      })
      const sendResult = await sendRes.json()
      if (!sendResult.messages?.[0]?.id) {
        return json({ success: false, error: sendResult.error?.message || 'Meta send failed', meta_response: sendResult }, 400)
      }

      await supabase.from('whatsapp_messages').insert({
        meta_message_id: sendResult.messages[0].id,
        client_phone: to,
        direction: 'outbound',
        message_type: waType,
        content: { caption: caption || '', filename: media_name || null },
        status: 'sent',
        staff_id: staff_id || null,
        lead_id: lead_id || null,
        campaign_id: campaign_id || null,
        media_storage_path: cleanPath,
        media_mime,
        media_name: media_name || null,
        media_size: media_size || null,
        media_meta_id: metaMediaId,
      })

      let assignmentResult: any = null
      if (assign_to_user_id) {
        const { data: staff } = await supabase
          .from('crm_staff_profiles')
          .select('id')
          .eq('user_id', assign_to_user_id)
          .maybeSingle()
        if (staff?.id) {
          const { data: assignment } = await supabase
            .from('whatsapp_assignments')
            .upsert({
              client_phone: to,
              assigned_to: staff.id,
              assigned_by: caller.id,
              assigned_at: new Date().toISOString(),
            }, { onConflict: 'client_phone' })
            .select()
            .maybeSingle()
          assignmentResult = assignment
        }
      }

      return json({ success: true, message_id: sendResult.messages[0].id, media_meta_id: metaMediaId, assignment: assignmentResult })
    }

    // ── send_campaign (NUEVO) ────────────────────────────────────────
    // Envío masivo a campaign_leads según el target_filter de la campaña.
    // Solo super_admin. Los contadores los mantiene el trigger de la base.
    if (action === 'send_campaign') {
      if (role !== 'super_admin') {
        return json({ error: 'Solo super_admin puede lanzar campañas' }, 403)
      }
      const { wa_campaign_id } = payload
      if (!wa_campaign_id) return json({ error: 'wa_campaign_id requerido' }, 400)

      // 1) Campaña + plantilla
      const { data: wc, error: wcErr } = await supabase
        .from('whatsapp_campaigns')
        .select('*, whatsapp_templates(template_name, language, header_type, variables_count, status)')
        .eq('id', wa_campaign_id)
        .maybeSingle()
      if (wcErr || !wc) return json({ error: 'Campaña no encontrada' }, 404)

      // Evita el doble disparo: sin esto un doble clic manda la campaña dos veces
      if (wc.status === 'sending' || wc.status === 'completed') {
        return json({ error: `La campaña ya está en estado "${wc.status}". No se reenvía.` }, 409)
      }

      const tpl = wc.whatsapp_templates
      if (!tpl) return json({ error: 'La campaña no tiene plantilla asociada' }, 400)
      if (tpl.status !== 'APPROVED') {
        return json({ error: `La plantilla "${tpl.template_name}" está en estado ${tpl.status}, no APPROVED.` }, 400)
      }
      if (tpl.header_type === 'IMAGE' && !wc.header_image_url) {
        return json({ error: `La plantilla "${tpl.template_name}" tiene encabezado de imagen: falta header_image_url en la campaña.` }, 400)
      }

      // 2) Destinatarios según target_filter
      let q = supabase.from('campaign_leads').select('id, full_name, phone, variant, etapa').not('phone', 'is', null)
      const tf = wc.target_filter || {}
      if (tf.variant) q = q.eq('variant', tf.variant)
      if (Array.isArray(tf.etapa) && tf.etapa.length) q = q.in('etapa', tf.etapa)
      if (wc.campaign_id) q = q.eq('campaign_id', wc.campaign_id)

      const { data: leads, error: leadsErr } = await q
      if (leadsErr) return json({ error: `Error cargando leads: ${leadsErr.message}` }, 500)

      // 3) Dedup por teléfono normalizado — un mismo número puede estar en
      //    varios leads y no queremos mandarle el mismo mensaje dos veces.
      const seen = new Set<string>()
      const unique = (leads || []).filter((l: any) => {
        const n = normalizePhone(l.phone || '')
        if (!n || n.length < 8 || seen.has(n)) return false
        seen.add(n)
        return true
      })

      // 4) Excluir bajas
      const { data: optOuts } = await supabase.from('whatsapp_opt_outs').select('client_phone')
      const blocked = new Set((optOuts || []).map((o: any) => o.client_phone))
      const recipients = unique.filter((l: any) => !blocked.has(normalizePhone(l.phone)))
      const skipped_opt_out = unique.length - recipients.length

      if (!recipients.length) {
        return json({ success: false, error: 'No hay destinatarios que cumplan el filtro', total: 0, skipped_opt_out }, 400)
      }
      // Tope por invocación: la función tiene límite de tiempo y la cuenta
      // tiene límite diario de conversaciones iniciadas.
      const MAX_RECIPIENTS = 1000
      if (recipients.length > MAX_RECIPIENTS) {
        return json({ error: `${recipients.length} destinatarios supera el tope de ${MAX_RECIPIENTS} por envío. Afina el filtro.` }, 400)
      }

      // 5) Marcar como enviando
      await supabase.from('whatsapp_campaigns').update({
        status: 'sending', started_at: new Date().toISOString(), total_recipients: recipients.length,
      }).eq('id', wa_campaign_id)

      // 6) Enviar en tandas pequeñas
      const errors: any[] = []
      let sent = 0
      const CONCURRENCY = 5

      async function sendOne(lead: any) {
        const phone = normalizePhone(lead.phone)
        const firstName = (lead.full_name || '').trim().split(/\s+/)[0] || 'Hola'
        const bodyValues = (tpl.variables_count || 0) > 0 ? [firstName] : []
        const components = buildComponents(tpl.header_type, bodyValues, wc.header_image_url)
        try {
          const res = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: toWaNumber(phone),
              type: 'template',
              template: { name: tpl.template_name, language: { code: tpl.language }, components },
            }),
          })
          const r = await res.json()
          if (r.messages?.[0]?.id) {
            await supabase.from('whatsapp_messages').insert({
              meta_message_id: r.messages[0].id,
              client_phone:    phone,
              client_name:     lead.full_name || null,
              direction:       'outbound',
              message_type:    'template',
              template_name:   tpl.template_name,
              content:         { template_name: tpl.template_name, components },
              status:          'sent',
              lead_id:         lead.id,
              campaign_id:     wc.campaign_id || null,
              wa_campaign_id:  wa_campaign_id,
            })
            sent++
          } else {
            errors.push({ phone, error: r.error?.message || 'Meta error', code: r.error?.code })
          }
        } catch (e) {
          errors.push({ phone, error: e instanceof Error ? e.message : String(e) })
        }
      }

      for (let i = 0; i < recipients.length; i += CONCURRENCY) {
        await Promise.all(recipients.slice(i, i + CONCURRENCY).map(sendOne))
      }

      await supabase.from('whatsapp_campaigns').update({
        status: 'completed', completed_at: new Date().toISOString(),
      }).eq('id', wa_campaign_id)

      return json({
        success: true,
        total: recipients.length,
        sent,
        failed: errors.length,
        skipped_opt_out,
        errors: errors.slice(0, 20),
      })
    }

    return json({ error: 'action no reconocida' }, 400)
  } catch (err) {
    console.error('[whatsapp-send] uncaught:', err)
    return json({ error: (err as Error).message }, 500)
  }
})
