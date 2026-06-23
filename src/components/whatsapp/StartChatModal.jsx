import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

const C = {
  surface: '#13151f',
  card: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.07)',
  text: '#f1f2f6',
  textSub: '#a4b0be',
  muted: '#636e72',
  green: '#00d084',
  greenDim: 'rgba(0,208,132,0.12)',
  purple: '#6c5ce7',
  purpleDim: 'rgba(108,92,231,0.15)',
  orange: '#ffa502',
  orangeDim: 'rgba(255,165,2,0.10)',
  red: '#ff4757',
  redDim: 'rgba(255,71,87,0.12)',
}

function fillVars(body, values) {
  if (!body) return ''
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => values[n - 1] || `{{${n}}}`)
}

// ─── Iniciar chat con un contacto vía plantilla aprobada ──────────────────────
// Llama a whatsapp-send action 'start_chat' (backend valida que el teléfono
// está en los crm_contacts del caller y auto-asigna el chat).
export default function StartChatModal({ contact, onClose, onStarted }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [varValues, setVarValues] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('status', 'APPROVED')
      .order('template_name')
      .then(({ data }) => {
        setTemplates(data || [])
        setLoading(false)
      })
  }, [])

  function selectTemplate(t) {
    setSelected(t)
    // Auto-llenar primera variable con el nombre del contacto (común en plantillas de bienvenida)
    const auto = Array(t.variables_count || 0).fill('')
    if ((t.variables_count || 0) > 0 && contact?.full_name) {
      auto[0] = contact.full_name.split(' ')[0]
    }
    setVarValues(auto)
  }

  async function handleSend() {
    if (!selected || sending) return
    setSending(true)
    setError('')
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No autenticado')
      const components = varValues.length
        ? [{ type: 'body', parameters: varValues.map(v => ({ type: 'text', text: v })) }]
        : []
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'start_chat',
          to: contact.phone,
          template_name: selected.template_name,
          language: selected.language || 'es',
          components,
          contact_id: contact.id,
        }),
      })
      const result = await res.json()
      if (!result.success) {
        setError(result.error || 'No se pudo iniciar el chat')
        return
      }
      onStarted?.(contact, result)
      onClose()
    } catch (e) {
      setError(e.message || 'Error inesperado')
    } finally {
      setSending(false)
    }
  }

  const preview = selected ? fillVars(selected.body_text, varValues) : ''

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={() => !sending && onClose()}>
      <div style={{ background: '#1a1c2e', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 22, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>🚀 Iniciar chat</span>
          <button onClick={() => !sending && onClose()} disabled={sending}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: sending ? 'not-allowed' : 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {/* Destinatario */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Para:</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: C.text, fontWeight: 600 }}>{contact?.full_name || contact?.phone}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{contact?.phone}</p>
        </div>

        {/* Aviso si no hay plantillas aprobadas */}
        {!loading && templates.length === 0 && (
          <div style={{ background: C.orangeDim, border: `1px solid ${C.orange}30`, borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: C.orange, fontWeight: 700 }}>⏳ Sin plantillas aprobadas aún</p>
            <p style={{ margin: 0, fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>
              WhatsApp solo permite iniciar conversaciones con clientes mediante plantillas previamente aprobadas por Meta.
              Cuando se verifique la cuenta de WhatsApp Business y se aprueben las plantillas, podrás iniciar chats desde aquí.
            </p>
          </div>
        )}

        {loading && <p style={{ color: C.muted, fontSize: 13 }}>Cargando plantillas...</p>}

        {/* Lista de plantillas */}
        {!loading && templates.length > 0 && !selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Elige una plantilla
            </p>
            {templates.map(t => (
              <button key={t.id} onClick={() => selectTemplate(t)}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.green + '60'}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.template_name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.category === 'MARKETING' ? C.orange : C.green, background: t.category === 'MARKETING' ? C.orangeDim : C.greenDim, borderRadius: 4, padding: '2px 7px' }}>
                    {t.category || 'UTILITY'}
                  </span>
                </div>
                {t.body_text && (
                  <p style={{ fontSize: 12, color: C.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.body_text}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {t.language && <span style={{ fontSize: 10, color: C.muted }}>🌐 {t.language}</span>}
                  {t.variables_count > 0 && <span style={{ fontSize: 10, color: C.purple }}>{t.variables_count} variable{t.variables_count !== 1 ? 's' : ''}</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Llenar variables + preview */}
        {selected && (
          <div>
            <button onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Volver a plantillas
            </button>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{selected.template_name}</p>
              {selected.body_text && <p style={{ fontSize: 13, color: C.textSub, margin: 0, lineHeight: 1.5 }}>{selected.body_text}</p>}
            </div>

            {selected.variables_count > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Rellenar variables</p>
                {varValues.map((v, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Variable {`{{${i + 1}}}`}</label>
                    <input value={v}
                      onChange={e => { const next = [...varValues]; next[i] = e.target.value; setVarValues(next) }}
                      placeholder={`Valor para {{${i + 1}}}`}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            )}

            {preview && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Vista previa</p>
                <div style={{ background: 'rgba(0,208,132,0.06)', border: `1px solid ${C.green}30`, borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{preview}</p>
                  {selected.footer_text && <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0' }}>{selected.footer_text}</p>}
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 8, padding: '9px 12px', marginBottom: 10 }}>
                <p style={{ color: C.red, fontSize: 12, margin: 0 }}>⚠ {error}</p>
              </div>
            )}

            <button onClick={handleSend} disabled={sending}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: sending ? C.greenDim : `linear-gradient(135deg, #00e096, ${C.green})`,
                color: sending ? C.green : '#000', border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
              }}>
              {sending ? 'Enviando...' : '✓ Iniciar chat (se auto-asigna a ti)'}
            </button>

            <p style={{ margin: '10px 0 0', fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 1.5 }}>
              Al enviar la plantilla, este chat queda asignado a ti automáticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
