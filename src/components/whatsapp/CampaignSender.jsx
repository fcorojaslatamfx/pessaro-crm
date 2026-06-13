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
}

const STATUS_LABEL = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando…',
  completed: 'Completada',
  paused: 'Pausada',
}

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

  const [form, setForm] = useState({
    name: '',
    template_id: '',
    campaign_id: '',
    variant_key: '',
    etapas: [],
    scheduled_at: '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('whatsapp_templates').select('*').eq('status', 'APPROVED'),
      supabase.from('campaigns').select('id,name').order('name'),
      supabase.from('whatsapp_campaigns').select('*,whatsapp_templates(template_name)').order('created_at', { ascending: false }),
    ]).then(([t, c, wc]) => {
      setTemplates(t.data || [])
      setCampaigns(c.data || [])
      setWaCampaigns(wc.data || [])
      if ((t.data || []).length > 0) setForm(f => ({ ...f, template_id: t.data[0].id }))
      setLoading(false)
    })
  }, [])

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
    setError('')
    setSending(true)
    setResult(null)

    const targetFilter = {}
    if (form.variant_key) targetFilter.variant = form.variant_key
    if (form.etapas.length) targetFilter.etapa = form.etapas

    const { data: wc, error: wcErr } = await supabase.from('whatsapp_campaigns').insert({
      name: form.name,
      template_id: form.template_id,
      campaign_id: form.campaign_id || null,
      variant_key: form.variant_key || null,
      target_filter: Object.keys(targetFilter).length ? targetFilter : null,
      scheduled_at: form.scheduled_at || null,
      status: form.scheduled_at ? 'scheduled' : 'draft',
      created_by: user?.id || null,
    }).select().single()

    if (wcErr) { setError(wcErr.message); setSending(false); return }

    // If no scheduled date, send immediately
    if (!form.scheduled_at) {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: 'send_campaign', wa_campaign_id: wc.id }),
      })
      const r = await res.json()
      setSending(false)
      if (r.success) {
        setResult(r)
        setForm({ name: '', template_id: templates[0]?.id || '', campaign_id: '', variant_key: '', etapas: [], scheduled_at: '' })
        // Reload
        const { data: wcs } = await supabase.from('whatsapp_campaigns').select('*,whatsapp_templates(template_name)').order('created_at', { ascending: false })
        setWaCampaigns(wcs || [])
        setTab('historial')
      } else {
        setError(r.error || 'Error al enviar campaña')
      }
    } else {
      setSending(false)
      setResult({ scheduled: true })
      const { data: wcs } = await supabase.from('whatsapp_campaigns').select('*,whatsapp_templates(template_name)').order('created_at', { ascending: false })
      setWaCampaigns(wcs || [])
      setTab('historial')
    }
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
              <Lbl>Plantilla WhatsApp</Lbl>
              {templates.length === 0
                ? <p style={{ color: C.muted, fontSize: 12 }}>No hay plantillas aprobadas en whatsapp_templates.</p>
                : <Sel value={form.template_id} onChange={v => setForm(f => ({ ...f, template_id: v }))}
                    options={templates.map(t => ({ value: t.id, label: `${t.template_name} (${t.category || 'UTILITY'})` }))} />}
            </div>

            <div>
              <Lbl>Campaña CRM (opcional)</Lbl>
              <Sel value={form.campaign_id} onChange={v => setForm(f => ({ ...f, campaign_id: v }))}
                options={[{ value: '', label: 'Sin campaña específica' }, ...campaigns.map(c => ({ value: c.id, label: c.name }))]} />
            </div>

            <div>
              <Lbl>Variante (opcional)</Lbl>
              <Input value={form.variant_key} onChange={v => setForm(f => ({ ...f, variant_key: v }))} placeholder="ej: minimalist, navy…" />
            </div>

            <div>
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
            </div>

            <div>
              <Lbl>Programar envío (opcional)</Lbl>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>Vacío = enviar ahora</p>
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
                </p>
              </div>
            )}
            {result?.scheduled && (
              <div style={{ background: C.blueDim, border: `1px solid ${C.blue}30`, borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ color: C.blue, fontSize: 13, margin: 0 }}>✓ Campaña programada correctamente</p>
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
            return (
              <div key={wc.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{wc.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                      {wc.whatsapp_templates?.template_name || '—'} · {new Date(wc.created_at).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: sc, background: sc + '20', border: `1px solid ${sc}35`, borderRadius: 4, padding: '3px 8px', textTransform: 'uppercase' }}>
                    {STATUS_LABEL[wc.status] || wc.status}
                  </span>
                </div>

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
