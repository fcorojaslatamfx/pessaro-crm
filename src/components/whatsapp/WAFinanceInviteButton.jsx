import { useState } from 'react'

const ACCENT = '#6c5ce7'
const GOLD   = '#f0a500'
const WA     = '#25D366'
const BORDER = 'rgba(255,255,255,0.1)'

export default function WAFinanceInviteButton({ advisorCode, advisorName, leadName, leadPhone, compact }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')

  if (!advisorCode) return null

  const chatLink = `https://crm.pessaro.cl/chat/${advisorCode}`

  const defaultMsg = `Hola${leadName ? ` ${leadName}` : ''}! 👋

Te invito a conectarte con un asesor especializado de Pessaro Capital a través de nuestro chat seguro.

🔗 ${chatLink}

${advisorName ? `Tu asesor: ${advisorName}\n` : ''}Es rápido, gratuito y sin compromiso. ¡Hablamos pronto!`

  const finalMsg = custom.trim() ? `${defaultMsg}\n\n${custom.trim()}` : defaultMsg

  function openWhatsApp() {
    const phone = (leadPhone || '').replace(/\D/g, '')
    const encoded = encodeURIComponent(finalMsg)
    const url = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
    setCustom('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Invitar a WAFinance"
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
        {compact ? '💹' : <><span>📲</span><span>Invitar WAFinance</span></>}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setCustom('') } }}>
          <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 28, maxWidth: 440, width: '100%', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Invitar por WhatsApp</h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>
                  Chat WAFinance para {leadName || 'el cliente'}
                </p>
              </div>
              <button onClick={() => { setOpen(false); setCustom('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>
                ✕
              </button>
            </div>

            {/* Link preview */}
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Link del chat</p>
              <p style={{ fontSize: 12, color: ACCENT, margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>{chatLink}</p>
            </div>

            {/* Message preview */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                Mensaje predeterminado
              </p>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 160, overflowY: 'auto' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{defaultMsg}</p>
              </div>
            </div>

            {/* Custom addition */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                Agregar mensaje personalizado (opcional)
              </p>
              <textarea
                value={custom}
                onChange={e => setCustom(e.target.value)}
                placeholder="Escribe algo adicional..."
                rows={2}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10, resize: 'vertical',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit', minHeight: 60,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setOpen(false); setCustom('') }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={openWhatsApp}
                style={{ flex: 2, padding: '11px 0', borderRadius: 12, background: WA, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                <span style={{ fontSize: 16 }}>💬</span>
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
