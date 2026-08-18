import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

const C = {
  bg: '#0d0f17',
  surface: '#13151f',
  card: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border: 'rgba(255,255,255,0.07)',
  text: '#f1f2f6',
  textSub: '#a4b0be',
  muted: '#636e72',
  green: '#00d084',
  greenDim: 'rgba(0,208,132,0.12)',
  purple: '#6c5ce7',
  purpleDim: 'rgba(108,92,231,0.15)',
  blue: '#0984e3',
  blueDim: 'rgba(9,132,227,0.15)',
  orange: '#ffa502',
  orangeDim: 'rgba(255,165,2,0.10)',
  red: '#ff4757',
  redDim: 'rgba(255,71,87,0.12)',
}

const STATUS_COLOR = {
  draft: C.muted,
  scheduled: C.blue,
  sending: C.orange,
  completed: C.green,
  paused: C.orange,
  failed: C.red,
}

const STATUS_LABEL = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando…',
  completed: 'Completada',
  paused: 'Pausada',
  failed: 'Fallida',
}

// El <input type="datetime-local"> entrega una hora SIN zona ('2026-08-13T09:25').
// Si se guardaba tal cual, Postgres la interpretaba como UTC y la campaña quedaba
// programada 4 h antes de lo que el usuario había elegido (Chile es UTC-4/-3).
// new Date(local).toISOString() la convierte al instante correcto.
function localAISO(valor) {
  if (!valor) return null
  const d = new Date(valor)
  return isNaN(d) ? null : d.toISOString()
}

const fmtFechaHora = v => v
  ? new Date(v).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const ETAPA_LABEL = { 1: 'Lead', 2: 'Contactado', 3: 'Propuesta', 4: 'Negociación', 5: 'Cerrado' }

function Lbl({ children }) {
  return <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{children}</label>
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }}
    />
  )
}

function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit' }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ background: C.surface }}>{o.label}</option>)}
    </select>
  )
}

function MetricBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function CampaignSender({ user }) {
  const [tab, setTab] = useState('crear')
  const [templates, setTemplates] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [waCampaigns, setWaCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [sendingId, setSendingId] = useState(null)   // campaña que se está disparando
  const [confirmSend, setConfirmSend] = useState(null) // confirmación en dos pasos
  const [rowMsg, setRowMsg] = useState(null)         // {id, type, text}

  const [contactGroups, setContactGroups] = useState([])

  const [form, setForm] = useState({
    name: '',
    template_id: '',
    campaign_id: '',
    variant_key: '',
    etapas: [],
    scheduled_at: '',
    header_image_url: '',
    contact_group_id: '',   // vacío = campaign_leads; con valor = grupo de contactos
    body_variable: '',      // vacío = primer nombre de cada destinatario
    // Por defecto no se le escribe a quien ya recibió CUALQUIER campaña en los
    // últimos 30 días. Es la regla de la casa; se puede aflojar por campaña.
    dedupe_scope: 'global',
    dedupe_days: '30',
  })

  // Previsualización: cuántos recibirían realmente el mensaje
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  const tplSeleccionada = templates.find(t => t.id === form.template_id)
  const imagenCampanaValida = /^https:\/\/.+/i.test((form.header_image_url || '').trim())

  useEffect(() => {
    Promise.all([
      supabase.from('whatsapp_templates').select('*').eq('status', 'APPROVED'),
      supabase.from('campaigns').select('id,name').order('name'),
      supabase.from('whatsapp_campaigns').select('*,whatsapp_templates(template_name)').order('created_at', { ascending: false }),
      supabase.from('crm_contact_groups').select('id,name,color').order('name'),
      supabase.from('crm_contact_group_members').select('group_id'),
    ]).then(([t, c, wc, g, gm]) => {
      setTemplates(t.data || [])
      setCampaigns(c.data || [])
      setWaCampaigns(wc.data || [])
      // El conteo va acá y no en la base para no agregar una vista sólo por esto
      const counts = {}
      for (const m of gm.data || []) counts[m.group_id] = (counts[m.group_id] || 0) + 1
      setContactGroups((g.data || []).map(x => ({ ...x, count: counts[x.id] || 0 })))
      if ((t.data || []).length > 0) setForm(f => ({ ...f, template_id: t.data[0].id }))
      setLoading(false)
    })
  }, [])

  // Cuenta los destinatarios reales antes de enviar, con las mismas reglas que
  // aplica runCampaign: dedup por teléfono, bajas y ya contactados. Sin esto la
  // exclusión es invisible y una campaña que no sale parece rota.
  useEffect(() => {
    if (tab !== 'crear') return
    let vivo = true
    const t = setTimeout(async () => {
      setPreviewing(true)
      try {
        const dig = v => String(v || '').replace(/\D/g, '')
        let filas = []
        if (form.contact_group_id) {
          const { data } = await supabase.from('crm_contact_group_members')
            .select('crm_contacts(phone)').eq('group_id', form.contact_group_id)
          filas = (data || []).map(r => r.crm_contacts).filter(c => c && c.phone)
        } else {
          let q = supabase.from('campaign_leads').select('phone').not('phone', 'is', null)
          if (form.variant_key) q = q.eq('variant', form.variant_key)
          if (form.etapas.length) q = q.in('etapa', form.etapas)
          if (form.campaign_id) q = q.eq('campaign_id', form.campaign_id)
          const { data } = await q
          filas = data || []
        }
        const unicos = [...new Set(filas.map(f => dig(f.phone)).filter(p => p.length >= 8))]

        const { data: bajas } = await supabase.from('whatsapp_opt_outs')
          .select('client_phone').is('opted_in_at', null)
        const bloqueados = new Set((bajas || []).map(b => dig(b.client_phone)))

        // Con 'campaign' no hay nada previo que mirar: la campaña aún no existe
        let ya = new Set()
        if (form.dedupe_scope !== 'campaign') {
          let q = supabase.from('whatsapp_campaign_recipients').select('phone').eq('outcome', 'sent')
          const tplName = templates.find(t => t.id === form.template_id)?.template_name
          if (form.dedupe_scope === 'template' && tplName) q = q.eq('template_name', tplName)
          const dias = Number(form.dedupe_days)
          if (dias > 0) q = q.gte('created_at', new Date(Date.now() - dias * 86400000).toISOString())
          const { data } = await q
          ya = new Set((data || []).map(r => r.phone))
        }
        const conBaja = unicos.filter(p => bloqueados.has(p)).length
        const yaCont = unicos.filter(p => !bloqueados.has(p) && ya.has(p)).length
        if (vivo) setPreview({ total: unicos.length, conBaja, yaCont, envia: unicos.length - conBaja - yaCont })
      } catch (e) {
        if (vivo) setPreview({ error: e.message || 'No se pudo calcular' })
      } finally {
        if (vivo) setPreviewing(false)
      }
    }, 400)
    return () => { vivo = false; clearTimeout(t) }
  }, [tab, form.contact_group_id, form.variant_key, form.etapas, form.campaign_id,
      form.dedupe_scope, form.dedupe_days, form.template_id, templates])

  function toggleEtapa(n) {
    setForm(f => ({
      ...f,
      etapas: f.etapas.includes(n) ? f.etapas.filter(e => e !== n) : [...f.etapas, n],
    }))
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.template_id) {
      setError('Nombre y plantilla son obligatorios.')
      return
    }
    if (tplSeleccionada?.header_type === 'IMAGE' && !imagenCampanaValida) {
      setError(`La plantilla ${tplSeleccionada.template_name} tiene encabezado de imagen: indica una URL https válida.`)
      return
    }
    setError('')
    setSending(true)
    setResult(null)

    // Un grupo de contactos y los filtros de lead son excluyentes: el grupo
    // apunta a crm_contacts y variant/etapa sólo existen en campaign_leads.
    const targetFilter = {}
    if (form.contact_group_id) {
      targetFilter.contact_group_id = form.contact_group_id
    } else {
      if (form.variant_key) targetFilter.variant = form.variant_key
      if (form.etapas.length) targetFilter.etapa = form.etapas
    }

    const { data: wc, error: wcErr } = await supabase.from('whatsapp_campaigns').insert({
      name: form.name,
      template_id: form.template_id,
      campaign_id: form.campaign_id || null,
      variant_key: form.variant_key || null,
      target_filter: Object.keys(targetFilter).length ? targetFilter : null,
      header_image_url: form.header_image_url.trim() || null,
      body_variable: form.body_variable.trim() || null,
      dedupe_scope: form.dedupe_scope,
      // Los días sólo tienen sentido cuando se mira hacia atrás
      dedupe_days: form.dedupe_scope === 'campaign' ? null : (Number(form.dedupe_days) || null),
      scheduled_at: localAISO(form.scheduled_at),
      status: form.scheduled_at ? 'scheduled' : 'draft',
      created_by: user?.id || null,
    }).select().single()

    if (wcErr) { setError(wcErr.message); setSending(false); return }

    // If no scheduled date, send immediately
    if (!form.scheduled_at) {
      const r = await dispararCampana(wc.id)
      setSending(false)
      if (r.success) {
        setResult(r)
        setForm({ name: '', template_id: templates[0]?.id || '', campaign_id: '', variant_key: '', etapas: [], scheduled_at: '', header_image_url: '', contact_group_id: '', body_variable: '', dedupe_scope: 'global', dedupe_days: '30' })
        await recargarCampanas()
        setTab('historial')
      } else {
        setError(r.error || 'Error al enviar campaña')
      }
    } else {
      setSending(false)
      setResult({ scheduled: true, at: localAISO(form.scheduled_at) })
      await recargarCampanas()
      setTab('historial')
    }
  }

  // Relee el catálogo completo desde Meta. Hace falta cada vez que se edita una
  // plantilla allí: el CRM sólo se entera por el evento del webhook, y si ese
  // evento no llega (o la edición aún no está aprobada) el catálogo queda viejo.
  async function sincronizarPlantillas() {
    setSyncing(true); setSyncMsg('')
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'sync_templates' }),
      })
      const r = await res.json()
      if (r.success) {
        const { data: t } = await supabase.from('whatsapp_templates').select('*').eq('status', 'APPROVED')
        setTemplates(t || [])
        if ((t || []).length > 0 && !form.template_id) setForm(f => ({ ...f, template_id: t[0].id }))
        setSyncMsg(`✓ ${r.synced} plantilla${r.synced !== 1 ? 's' : ''} en Meta · ${r.approved} aprobada${r.approved !== 1 ? 's' : ''}`)
      } else {
        setSyncMsg(`✕ ${r.error || 'Error sincronizando'}`)
      }
    } catch (e) {
      setSyncMsg(`✕ ${e.message}`)
    }
    setSyncing(false)
  }

  async function recargarCampanas() {
    const { data: wcs } = await supabase.from('whatsapp_campaigns').select('*,whatsapp_templates(template_name)').order('created_at', { ascending: false })
    setWaCampaigns(wcs || [])
  }

  // Llama a la edge function con el JWT del usuario (send_campaign es super_admin)
  async function dispararCampana(waCampaignId) {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: 'send_campaign', wa_campaign_id: waCampaignId }),
      })
      return await res.json()
    } catch (e) {
      return { success: false, error: e.message || 'Error de red al llamar a whatsapp-send' }
    }
  }

  // Reutilizar una campaña: copia la configuración ya probada a un borrador
  // nuevo, en vez de rellenar el formulario otra vez. No copia contadores ni
  // fechas: nace limpia y se envía cuando quieras.
  async function duplicar(wc) {
    setRowMsg(null)
    try {
      const { data, error } = await supabase.from('whatsapp_campaigns').insert({
        name: `${wc.name} (copia)`,
        template_id: wc.template_id,
        campaign_id: wc.campaign_id,
        variant_key: wc.variant_key,
        target_filter: wc.target_filter,
        header_image_url: wc.header_image_url,
        body_variable: wc.body_variable,
        dedupe_scope: wc.dedupe_scope || 'global',
        dedupe_days: wc.dedupe_days,
        status: 'draft',
        created_by: user?.id || null,
      }).select().single()
      if (error) throw error
      await recargarCampanas()
      setRowMsg({ id: data.id, type: 'ok', text: 'Copia creada como borrador. Revisa y pulsa «Enviar ahora».' })
    } catch (e) {
      setRowMsg({ id: wc.id, type: 'err', text: e.message || 'No se pudo duplicar' })
    }
  }

  // Envío manual desde el historial: sirve para las que quedaron en borrador y
  // para adelantar una programada sin esperar al planificador.
  async function enviarAhora(wc) {
    if (confirmSend !== wc.id) { setConfirmSend(wc.id); return }
    setConfirmSend(null)
    setSendingId(wc.id)
    setRowMsg(null)
    const r = await dispararCampana(wc.id)
    setSendingId(null)
    setRowMsg(r.success
      ? { id: wc.id, type: 'ok', text: `Enviada: ${r.sent} de ${r.total}${r.failed ? ` · ${r.failed} fallidos` : ''}${r.skipped_opt_out ? ` · ${r.skipped_opt_out} con baja` : ''}${r.skipped_already_sent ? ` · ${r.skipped_already_sent} ya contactados` : ''}` }
      : { id: wc.id, type: 'err', text: r.error || 'No se pudo enviar' })
    await recargarCampanas()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.green}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[['crear', 'Nueva campaña'], ['historial', `Historial (${waCampaigns.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: tab === id ? 700 : 400,
              background: tab === id ? C.greenDim : 'rgba(255,255,255,0.03)',
              color: tab === id ? C.green : C.muted,
              border: tab === id ? `1px solid ${C.green}40` : `1px solid ${C.border}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Crear ── */}
      {tab === 'crear' && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Lbl>Nombre de campaña</Lbl>
              <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="ej: Campaña Minimalist Junio 2026" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Lbl>Plantilla WhatsApp</Lbl>
                <button onClick={sincronizarPlantillas} disabled={syncing}
                  title="Relee el catálogo desde Meta. Úsalo tras editar o crear una plantilla allí."
                  style={{
                    padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                    marginBottom: 5, cursor: syncing ? 'wait' : 'pointer',
                    background: 'rgba(255,255,255,0.05)', color: C.textSub, border: `1px solid ${C.border}`,
                  }}>
                  {syncing ? 'Sincronizando…' : '⟳ Sincronizar desde Meta'}
                </button>
              </div>
              {templates.length === 0
                ? <p style={{ color: C.muted, fontSize: 12 }}>No hay plantillas aprobadas en whatsapp_templates.</p>
                : <Sel value={form.template_id} onChange={v => setForm(f => ({ ...f, template_id: v }))}
                    options={templates.map(t => ({ value: t.id, label: `${t.template_name} (${t.category || 'UTILITY'})` }))} />}
              {syncMsg && (
                <p style={{ fontSize: 11, margin: '6px 0 0', color: syncMsg.startsWith('✓') ? C.green : C.red }}>{syncMsg}</p>
              )}
            </div>

            {tplSeleccionada?.header_type === 'IMAGE' && (
              <div>
                <Lbl>Imagen del encabezado</Lbl>
                <Input value={form.header_image_url} onChange={v => setForm(f => ({ ...f, header_image_url: v }))} placeholder="https://..." />
                <p style={{ color: C.muted, fontSize: 11, margin: '6px 0 0', lineHeight: 1.5 }}>
                  <strong style={{ color: C.orange }}>{tplSeleccionada.template_name}</strong> lleva encabezado de imagen: WhatsApp la exige en cada envío, así que es obligatoria. URL pública HTTPS.
                </p>
                {imagenCampanaValida && (
                  <img src={form.header_image_url.trim()} alt="" style={{ marginTop: 10, maxWidth: '100%', maxHeight: 140, borderRadius: 8, display: 'block' }} />
                )}
              </div>
            )}

            {/* Qué se escribe en {{1}}. Sin esto el saludo sale con la primera
                palabra del nombre del contacto, que no siempre es un nombre. */}
            {tplSeleccionada?.variables_count > 0 && (
              <div>
                <Lbl>Saludo de la plantilla · variable {'{{1}}'}</Lbl>
                <Sel value={form.body_variable ? 'fijo' : 'auto'}
                  onChange={v => setForm(f => ({ ...f, body_variable: v === 'auto' ? '' : (f.body_variable || 'Hola') }))}
                  options={[
                    { value: 'auto', label: 'Primer nombre de cada destinatario' },
                    { value: 'fijo', label: 'Un mismo texto para todos' },
                  ]} />
                {form.body_variable !== '' && (
                  <div style={{ marginTop: 8 }}>
                    <Input value={form.body_variable} onChange={v => setForm(f => ({ ...f, body_variable: v }))} placeholder="Ej: Hola" />
                  </div>
                )}
                <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
                  {form.body_variable
                    ? <>Todos recibirán: <span style={{ color: C.textSub }}>«{(tplSeleccionada.body_text || '').replace(/\{\{1\}\}/, form.body_variable).slice(0, 70)}…»</span></>
                    : 'Se usa el primer nombre del contacto. Si no tiene nombre registrado, se saluda sin él.'}
                </p>
              </div>
            )}

            <div>
              <Lbl>Destinatarios</Lbl>
              <Sel value={form.contact_group_id} onChange={v => setForm(f => ({ ...f, contact_group_id: v }))}
                options={[
                  { value: '', label: 'Leads de campaña (filtrados abajo)' },
                  ...contactGroups.map(g => ({ value: g.id, label: `Grupo: ${g.name} (${g.count} contacto${g.count !== 1 ? 's' : ''})` })),
                ]} />
              <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>
                {form.contact_group_id
                  ? 'Se enviará a los contactos del grupo. Los filtros de lead no aplican.'
                  : contactGroups.length === 0
                    ? 'Aún no hay grupos de contactos. Créalos en el módulo Contactos.'
                    : 'También puedes enviar a un grupo de contactos del CRM.'}
              </p>
            </div>

            {/* Evitar repetir: la exclusión la aplica whatsapp-send, no el navegador */}
            <div>
              <Lbl>No volver a escribirle a…</Lbl>
              <Sel value={form.dedupe_scope} onChange={v => setForm(f => ({ ...f, dedupe_scope: v }))}
                options={[
                  { value: 'campaign', label: 'Quien ya recibió esta misma campaña' },
                  { value: 'template', label: 'Quien ya recibió esta plantilla hace poco' },
                  { value: 'global', label: 'Quien recibió cualquier campaña hace poco' },
                ]} />
              {form.dedupe_scope !== 'campaign' && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.textSub }}>Ventana:</span>
                  <div style={{ width: 90 }}>
                    <Input type="number" value={form.dedupe_days} onChange={v => setForm(f => ({ ...f, dedupe_days: v }))} placeholder="30" />
                  </div>
                  <span style={{ fontSize: 12, color: C.textSub }}>días hacia atrás</span>
                </div>
              )}
              <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
                {form.dedupe_scope === 'campaign'
                  ? 'Cada contacto recibe esta campaña una sola vez, aunque se dispare dos veces o el planificador la reintente.'
                  : form.dedupe_scope === 'template'
                    ? 'Además de lo anterior, quedan fuera los que ya recibieron esta misma plantilla dentro de la ventana.'
                    : 'Además de lo anterior, quedan fuera los que recibieron cualquier otra campaña dentro de la ventana.'}
              </p>
            </div>

            {/* Cuántos reciben de verdad, antes de pulsar enviar */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, margin: '0 0 8px' }}>
                Destinatarios reales {previewing && <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· calculando…</span>}
              </p>
              {preview?.error
                ? <p style={{ fontSize: 12, color: C.red, margin: 0 }}>No se pudo calcular: {preview.error}</p>
                : preview
                  ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: preview.envia > 0 ? C.green : C.orange, fontFamily: 'monospace' }}>{preview.envia}</span>
                      <span style={{ fontSize: 12, color: C.textSub }}>
                        recibirán el mensaje, de {preview.total} en el filtro
                        {preview.conBaja > 0 && <> · <span style={{ color: C.red }}>{preview.conBaja} con baja</span></>}
                        {preview.yaCont > 0 && <> · <span style={{ color: C.orange }}>{preview.yaCont} ya contactados</span></>}
                      </span>
                    </div>
                  : <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Elige los destinatarios para ver el conteo.</p>}
            </div>

            <div>
              <Lbl>Campaña CRM (opcional)</Lbl>
              <Sel value={form.campaign_id} onChange={v => setForm(f => ({ ...f, campaign_id: v }))}
                options={[{ value: '', label: 'Sin campaña específica' }, ...campaigns.map(c => ({ value: c.id, label: c.name }))]} />
            </div>

            {!form.contact_group_id && <div>
              <Lbl>Variante (opcional)</Lbl>
              <Input value={form.variant_key} onChange={v => setForm(f => ({ ...f, variant_key: v }))} placeholder="ej: minimalist, navy…" />
            </div>}

            {!form.contact_group_id && <div>
              <Lbl>Filtrar por etapa de lead</Lbl>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map(n => {
                  const active = form.etapas.includes(n)
                  return (
                    <button key={n} onClick={() => toggleEtapa(n)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        background: active ? C.purpleDim : 'rgba(255,255,255,0.03)',
                        color: active ? C.purple : C.muted,
                        border: active ? `1px solid rgba(108,92,231,0.4)` : `1px solid ${C.border}`,
                        fontWeight: active ? 700 : 400,
                      }}>
                      {ETAPA_LABEL[n]}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>Sin selección = todos los leads</p>
            </div>}

            <div>
              <Lbl>Programar envío (opcional)</Lbl>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>
                Vacío = enviar ahora. La hora es la tuya ({Intl.DateTimeFormat().resolvedOptions().timeZone}); el planificador la despacha con hasta 5 minutos de margen.
              </p>
            </div>

            {error && (
              <div style={{ background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ color: C.red, fontSize: 12, margin: 0 }}>⚠ {error}</p>
              </div>
            )}

            {result && result.success && (
              <div style={{ background: C.greenDim, border: `1px solid ${C.green}30`, borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ color: C.green, fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>✓ Campaña enviada</p>
                <p style={{ color: C.textSub, fontSize: 12, margin: 0 }}>
                  {result.sent} enviados · {result.failed} fallidos · {result.total} total
                  {result.skipped_opt_out ? ` · ${result.skipped_opt_out} con baja` : ''}
                  {result.skipped_already_sent ? ` · ${result.skipped_already_sent} ya contactados` : ''}
                </p>
              </div>
            )}
            {result?.scheduled && (
              <div style={{ background: C.blueDim, border: `1px solid ${C.blue}30`, borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ color: C.blue, fontSize: 13, margin: 0 }}>✓ Campaña programada para {fmtFechaHora(result.at)}</p>
                <p style={{ color: C.textSub, fontSize: 11, margin: '4px 0 0' }}>
                  El planificador revisa cada 5 minutos. También puedes adelantarla con «Enviar ahora» en el historial.
                </p>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={sending || !form.name.trim()}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: sending || !form.name.trim() ? C.greenDim : `linear-gradient(135deg, #00e096, ${C.green})`,
                color: sending || !form.name.trim() ? C.green : '#000',
                border: 'none', cursor: sending || !form.name.trim() ? 'not-allowed' : 'pointer',
              }}>
              {sending ? 'Procesando...' : form.scheduled_at ? '📅 Programar campaña' : '🚀 Crear y enviar ahora'}
            </button>
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      {tab === 'historial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {waCampaigns.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🚀</div>
              Sin campañas aún
            </div>
          )}
          {waCampaigns.map(wc => {
            const sc = STATUS_COLOR[wc.status] || C.muted
            // Borrador y programada todavía se pueden disparar a mano
            const disparable = wc.status === 'draft' || wc.status === 'scheduled'
            const vencida = wc.status === 'scheduled' && wc.scheduled_at && new Date(wc.scheduled_at) <= new Date()
            const msg = rowMsg?.id === wc.id ? rowMsg : null
            return (
              <div key={wc.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{wc.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                      {wc.whatsapp_templates?.template_name || '—'} · {new Date(wc.created_at).toLocaleDateString('es-CL')}
                      {' · saludo: '}{wc.body_variable ? `«${wc.body_variable}»` : 'nombre del contacto'}
                    </p>
                    {wc.scheduled_at && (
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: vencida ? C.orange : C.blue }}>
                        📅 Programada para {fmtFechaHora(wc.scheduled_at)}
                        {vencida ? ' · se despachará en el próximo ciclo (cada 5 min)' : ''}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {disparable && (
                      <button onClick={() => enviarAhora(wc)} disabled={sendingId === wc.id}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                          cursor: sendingId === wc.id ? 'not-allowed' : 'pointer',
                          background: confirmSend === wc.id ? C.orangeDim : C.greenDim,
                          color: confirmSend === wc.id ? C.orange : C.green,
                          border: `1px solid ${confirmSend === wc.id ? C.orange : C.green}45`,
                        }}>
                        {sendingId === wc.id ? 'Enviando…' : confirmSend === wc.id ? '¿Enviar ahora?' : '🚀 Enviar ahora'}
                      </button>
                    )}
                    {confirmSend === wc.id && (
                      <button onClick={() => setConfirmSend(null)}
                        style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancelar
                      </button>
                    )}
                    <button onClick={() => duplicar(wc)} title="Crear un borrador nuevo con la misma configuración"
                      style={{ padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: C.textSub, border: `1px solid ${C.border}` }}>
                      ⧉ Reutilizar
                    </button>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sc, background: sc + '20', border: `1px solid ${sc}35`, borderRadius: 4, padding: '3px 8px', textTransform: 'uppercase' }}>
                      {STATUS_LABEL[wc.status] || wc.status}
                    </span>
                  </div>
                </div>

                {msg && (
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: msg.type === 'ok' ? C.green : C.red, background: msg.type === 'ok' ? C.greenDim : C.redDim, borderRadius: 8, padding: '9px 12px' }}>
                    {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
                  </p>
                )}

                {wc.total_recipients > 0 && (
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 8px' }}>
                    <MetricBadge label="Total" value={wc.total_recipients} color={C.textSub} />
                    <MetricBadge label="Enviados" value={wc.sent_count} color={C.blue} />
                    <MetricBadge label="Entregados" value={wc.delivered_count} color={C.purple} />
                    <MetricBadge label="Leídos" value={wc.read_count} color={C.green} />
                    <MetricBadge label="Fallidos" value={wc.failed_count} color={C.red} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
