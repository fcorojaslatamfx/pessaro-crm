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
  purpleBorder: 'rgba(108,92,231,0.3)',
  orange: '#ffa502',
  orangeDim: 'rgba(255,165,2,0.10)',
}

function fillVars(body, values) {
  if (!body) return ''
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => values[n - 1] || `{{${n}}}`)
}

export default function TemplatePicker({ onSend, onClose }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [varValues, setVarValues] = useState([])
  const [sending, setSending] = useState(false)

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
    setVarValues(Array(t.variables_count || 0).fill(''))
  }

  async function handleSend() {
    if (!selected) return
    setSending(true)
    const components = varValues.length
      ? [{ type: 'body', parameters: varValues.map(v => ({ type: 'text', text: v })) }]
      : []
    await onSend(selected.template_name, selected.language || 'es', components)
    setSending(false)
    onClose()
  }

  const preview = selected ? fillVars(selected.body_text, varValues) : ''

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Seleccionar Plantilla</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {loading && <p style={{ color: C.muted, fontSize: 13 }}>Cargando plantillas...</p>}

          {!loading && templates.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No hay plantillas aprobadas.</p>
              <p style={{ color: C.muted, fontSize: 11, margin: '4px 0 0' }}>Agrega plantillas en la tabla whatsapp_templates con status APPROVED.</p>
            </div>
          )}

          {/* Template list */}
          {!loading && templates.length > 0 && !selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 11, color: C.muted, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                {templates.length} plantilla{templates.length !== 1 ? 's' : ''} aprobada{templates.length !== 1 ? 's' : ''}
              </p>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.green + '60'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
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

          {/* Variable fill + preview */}
          {selected && (
            <div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: '0 0 14px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ← Volver a plantillas
              </button>

              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{selected.template_name}</p>
                {selected.body_text && <p style={{ fontSize: 13, color: C.textSub, margin: 0, lineHeight: 1.5 }}>{selected.body_text}</p>}
              </div>

              {selected.variables_count > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Rellenar variables</p>
                  {varValues.map((v, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Variable {`{{${i + 1}}}`}</label>
                      <input
                        value={v}
                        onChange={e => { const next = [...varValues]; next[i] = e.target.value; setVarValues(next) }}
                        placeholder={`Valor para {{${i + 1}}}`}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              {preview && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Vista previa</p>
                  <div style={{ background: 'rgba(0,208,132,0.06)', border: `1px solid ${C.green}30`, borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{preview}</p>
                    {selected.footer_text && <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0' }}>{selected.footer_text}</p>}
                  </div>
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: sending ? 'rgba(0,208,132,0.15)' : `linear-gradient(135deg, #00e096, ${C.green})`,
                  color: sending ? C.green : '#000', border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Enviando...' : '✓ Enviar plantilla'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
