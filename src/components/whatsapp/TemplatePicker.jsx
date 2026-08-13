import { useState, useEffect, useRef } from 'react'
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

// Encabezados que el CRM sabe enviar. IMAGE requiere adjuntar la URL en cada
// envío; VIDEO y DOCUMENT todavía no están implementados en whatsapp-send.
const HEADER_SOPORTADO = { null: true, TEXT: true, IMAGE: true }
function esEnviable(t) {
  return HEADER_SOPORTADO[t.header_type ?? 'null'] === true
}

// El webhook de Meta refresca el catálogo al aprobarse una plantilla, pero si
// ese evento se pierde (webhook caído, campo no suscrito) el catálogo se queda
// viejo en silencio. Por eso el super_admin re-sincroniza solo al abrir.
const SYNC_STALE_MS = 30 * 60 * 1000

function edadSync(fecha) {
  if (!fecha) return 'sin sincronizar'
  const min = Math.floor((Date.now() - fecha.getTime()) / 60000)
  if (min < 1)  return 'recién sincronizado'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

export default function TemplatePicker({ onSend, onClose, isSuperAdmin }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [varValues, setVarValues] = useState([])
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [headerImg, setHeaderImg] = useState('')
  const [lastSync, setLastSync] = useState(null)
  const autoSyncHecho = useRef(false)

  async function loadTemplates() {
    // synced_at se lee de todas las filas (no sólo las aprobadas) para saber
    // cuándo corrió el último sync aunque no haya aprobadas.
    const [{ data }, { data: meta }] = await Promise.all([
      supabase.from('whatsapp_templates').select('*').eq('status', 'APPROVED').order('template_name'),
      supabase.from('whatsapp_templates').select('synced_at').order('synced_at', { ascending: false, nullsFirst: false }).limit(1),
    ])
    setTemplates(data || [])
    const ts = meta?.[0]?.synced_at
    setLastSync(ts ? new Date(ts) : null)
    setLoading(false)
    return ts ? new Date(ts) : null
  }

  useEffect(() => {
    loadTemplates().then(ts => {
      // Guard contra el doble efecto de StrictMode: sin esto se dispararían
      // dos syncs contra Meta en desarrollo.
      if (autoSyncHecho.current || !isSuperAdmin) return
      if (ts && Date.now() - ts.getTime() < SYNC_STALE_MS) return
      autoSyncHecho.current = true
      handleSync({ silencioso: true })
    })
  }, [isSuperAdmin])

  // Trae el catálogo de plantillas desde Meta (solo super_admin).
  // La Edge Function refleja nombre/idioma/estado/variables en whatsapp_templates.
  async function handleSync({ silencioso = false } = {}) {
    setSyncing(true)
    setSyncMsg('')
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: 'sync_templates' }),
      })
      const r = await res.json()
      if (r.success) {
        const antes = templates.length
        await loadTemplates()
        // En el sync automático sólo se avisa si el catálogo cambió; si no,
        // sería un cartel en cada apertura del modal sin nada que contar.
        if (!silencioso || r.approved !== antes) {
          setSyncMsg(`✓ ${r.synced} plantilla${r.synced !== 1 ? 's' : ''} en Meta · ${r.approved} aprobada${r.approved !== 1 ? 's' : ''}`)
        }
      } else {
        setSyncMsg(`✕ ${r.error || 'Error sincronizando'}`)
      }
    } catch (e) {
      setSyncMsg(`✕ ${e.message}`)
    }
    setSyncing(false)
  }

  function selectTemplate(t) {
    if (!esEnviable(t)) return
    setSelected(t)
    setVarValues(Array(t.variables_count || 0).fill(''))
    setHeaderImg('')
  }

  const necesitaImagen = selected?.header_type === 'IMAGE'
  const imagenValida = /^https:\/\/.+/i.test(headerImg.trim())
  const puedeEnviar = !sending && (!necesitaImagen || imagenValida)

  async function handleSend() {
    if (!selected || !puedeEnviar) return
    setSending(true)
    const components = varValues.length
      ? [{ type: 'body', parameters: varValues.map(v => ({ type: 'text', text: v })) }]
      : []
    await onSend(
      selected.template_name,
      selected.language || 'es',
      components,
      necesitaImagen ? headerImg.trim() : undefined,
    )
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!selected && (
              <span style={{ fontSize: 10, color: C.muted }} title={lastSync ? lastSync.toLocaleString('es-CL') : ''}>
                {syncing ? 'Sincronizando...' : edadSync(lastSync)}
              </span>
            )}
            {isSuperAdmin && !selected && (
              <button
                onClick={() => handleSync()}
                disabled={syncing}
                title="Traer el catálogo de plantillas desde Meta"
                style={{
                  background: 'rgba(108,92,231,0.15)', border: `1px solid ${C.purpleBorder}`, borderRadius: 8,
                  padding: '5px 10px', color: C.purple, fontSize: 11, fontWeight: 600,
                  cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1,
                }}
              >
                {syncing ? 'Sincronizando...' : '⟳ Sincronizar desde Meta'}
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>
        </div>

        {syncMsg && (
          <div style={{
            padding: '10px 24px', fontSize: 12,
            color: syncMsg.startsWith('✓') ? C.green : '#ff6b6b',
            background: syncMsg.startsWith('✓') ? C.greenDim : 'rgba(255,107,107,0.10)',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {syncMsg}
          </div>
        )}

        {/* El asesor no puede sincronizar: si el catálogo está viejo, al menos
            que sepa a quién pedírselo en vez de creer que la plantilla no existe. */}
        {!isSuperAdmin && !selected && !loading && (!lastSync || Date.now() - lastSync.getTime() > 6 * 60 * 60 * 1000) && (
          <div style={{ padding: '10px 24px', fontSize: 11, color: C.orange, background: C.orangeDim, borderBottom: `1px solid ${C.border}`, lineHeight: 1.5 }}>
            Catálogo sincronizado {edadSync(lastSync)}. Si falta una plantilla recién aprobada en Meta, pídele al super admin que sincronice.
          </div>
        )}

        <div style={{ padding: 24 }}>
          {loading && <p style={{ color: C.muted, fontSize: 13 }}>Cargando plantillas...</p>}

          {!loading && templates.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No hay plantillas aprobadas.</p>
              <p style={{ color: C.muted, fontSize: 11, margin: '4px 0 0' }}>
                {isSuperAdmin
                  ? 'Crea las plantillas en Meta Business Suite y luego sincroniza desde acá.'
                  : 'Pide al super admin que sincronice el catálogo de plantillas desde Meta.'}
              </p>
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
                  disabled={!esEnviable(t)}
                  title={esEnviable(t) ? '' : `Encabezado ${t.header_type} aún no soportado por el CRM`}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', cursor: esEnviable(t) ? 'pointer' : 'not-allowed', opacity: esEnviable(t) ? 1 : 0.45, textAlign: 'left', transition: 'border-color 0.12s' }}
                  onMouseEnter={e => { if (esEnviable(t)) e.currentTarget.style.borderColor = C.green + '60' }}
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {t.language && <span style={{ fontSize: 10, color: C.muted }}>🌐 {t.language}</span>}
                    {t.variables_count > 0 && <span style={{ fontSize: 10, color: C.purple }}>{t.variables_count} variable{t.variables_count !== 1 ? 's' : ''}</span>}
                    {t.header_type === 'IMAGE' && <span style={{ fontSize: 10, color: C.orange }}>🖼 requiere imagen</span>}
                    {!esEnviable(t) && <span style={{ fontSize: 10, color: '#ff6b6b' }}>encabezado {t.header_type} no soportado</span>}
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

              {necesitaImagen && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Imagen del encabezado</p>
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px', lineHeight: 1.5 }}>
                    Esta plantilla lleva encabezado de imagen y WhatsApp la exige en cada envío. Pega una URL pública HTTPS (por ejemplo, un archivo del bucket <code>public-assets</code>).
                  </p>
                  <input
                    value={headerImg}
                    onChange={e => setHeaderImg(e.target.value)}
                    placeholder="https://..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${headerImg && !imagenValida ? '#ff6b6b' : C.border}`, borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                  {headerImg && !imagenValida && (
                    <p style={{ fontSize: 11, color: '#ff6b6b', margin: '6px 0 0' }}>Debe ser una URL que empiece con https://</p>
                  )}
                  {imagenValida && (
                    <img src={headerImg.trim()} alt="" style={{ marginTop: 10, maxWidth: '100%', maxHeight: 140, borderRadius: 8, display: 'block' }} />
                  )}
                </div>
              )}

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
                disabled={!puedeEnviar}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: !puedeEnviar ? 'rgba(0,208,132,0.15)' : `linear-gradient(135deg, #00e096, ${C.green})`,
                  color: !puedeEnviar ? C.green : '#000', border: 'none', cursor: !puedeEnviar ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Enviando...' : necesitaImagen && !imagenValida ? 'Falta la imagen del encabezado' : '✓ Enviar plantilla'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
