import { useState } from 'react'

const ACCENT = '#6c5ce7'
const GOLD   = '#f0a500'
const WA     = '#25D366'

export default function WAFinanceInviteButton({ advisorCode, advisorName, leadName, leadPhone, compact, onSend }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')

  if (!advisorCode) return null

  const chatLink = `https://crm.pessaro.cl/chat/${advisorCode}`
  const firstName = leadName ? leadName.split(' ')[0] : ''
  const ogImageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/public-assets/og-wafinance.jpg`

  const defaultMsg = `Hola${firstName ? ` ${firstName}` : ''}!

Tu perfil ha sido seleccionado para una *asesor\u00eda financiera exclusiva y gratuita* con Pessaro Capital.

\u2713 Forex, Commodities, \u00cdndices y Crypto
\u2713 Asesor profesional + asistente inteligente
\u2713 100% gratuito, sin compromisos
${advisorName ? `\nTu asesor: *${advisorName}*\n` : ''}
*Comienza aqu\u00ed:*
${chatLink}`

  const finalMsg = custom.trim() ? `${defaultMsg}\n\n${custom.trim()}` : defaultMsg

  // Envío directo por wa.me — abre WhatsApp con el nuevo chat, no requiere que el asesor tenga
  // el contacto guardado en su celular. Es el mecanismo correcto para contactar leads en frío.
  function openWhatsApp() {
    const phone = (leadPhone || '').replace(/\D/g, '')
    const encoded = encodeURIComponent(finalMsg)
    const url = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
    setCustom('')
    if (onSend) onSend()
  }

  function copyLink() {
    navigator.clipboard.writeText(chatLink).then(() => {
      const el = document.getElementById('waf-copy-feedback')
      if (el) { el.textContent = '\u2713 Copiado'; setTimeout(() => { el.textContent = 'Copiar link' }, 1500) }
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Invitar a WAFinance"
        style={compact ? {
          background: 'none', border: 'none', cursor: 'pointer',
          color: GOLD, fontSize: 16, padding: '2px 4px',
          display: 'inline-flex', alignItems: 'center', lineHeight: 1,
        } : {
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          background: `${WA}18`, border: `1px solid ${WA}40`,
          color: WA, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
        {compact ? '\ud83d\udcb9' : <><span>{'\ud83d\udcf2'}</span><span>Invitar WAFinance</span></>}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setCustom('') } }}>
          <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', fontFamily: 'system-ui,-apple-system,sans-serif', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Invitar a WAFinance</h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>
                  Sesi{'\u00f3'}n exclusiva para {leadName || 'el cliente'}
                </p>
              </div>
              <button onClick={() => { setOpen(false); setCustom('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>
                {'\u2715'}
              </button>
            </div>

            {/* Link + Copy */}
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Link del chat</p>
                <p style={{ fontSize: 12, color: ACCENT, margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>{chatLink}</p>
              </div>
              <button onClick={copyLink} id="waf-copy-feedback"
                style={{ padding: '5px 12px', borderRadius: 6, background: `${ACCENT}22`, border: `1px solid ${ACCENT}40`, color: ACCENT, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Copiar link
              </button>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 600, border: '1px solid rgba(16,185,129,0.2)' }}>
                100% Gratuito
              </span>
              <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: `${GOLD}15`, color: GOLD, fontWeight: 600, border: `1px solid ${GOLD}30` }}>
                Sin compromisos
              </span>
              <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: `${ACCENT}15`, color: ACCENT, fontWeight: 600, border: `1px solid ${ACCENT}30` }}>
                Chat exclusivo
              </span>
            </div>

            {/* OG Image Preview */}
            <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={ogImageUrl} alt="WAFinance Preview"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                onError={e => { e.target.parentElement.style.display = 'none' }} />
            </div>

            {/* Message preview */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                Vista previa del mensaje
              </p>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 150, overflowY: 'auto' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{defaultMsg}</p>
              </div>
            </div>

            {/* Custom message */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                Mensaje adicional (opcional)
              </p>
              <textarea value={custom} onChange={e => setCustom(e.target.value)}
                placeholder="Ej: Te recomiendo revisar las oportunidades en Forex..."
                rows={2}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10, resize: 'vertical',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit', minHeight: 60,
                }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setOpen(false); setCustom('') }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={openWhatsApp}
                style={{ flex: 2, padding: '11px 0', borderRadius: 12, background: WA, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                Enviar por WhatsApp
              </button>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '10px 0 0', lineHeight: 1.5, textAlign: 'center' }}>
              Abre WhatsApp con el chat listo. No necesitas tener el contacto guardado.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
