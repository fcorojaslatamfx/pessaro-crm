import { useState } from 'react'

const ACCENT = '#6c5ce7'
const GOLD   = '#f0a500'
const WA     = '#25D366'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const OG_IMAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/public-assets/og-wafinance.jpg`

export default function WAFinanceInviteButton({ advisorCode, advisorName, leadName, leadPhone, compact, onSend }) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState('')

  if (!advisorCode) return null

  const chatLink = `https://crm.pessaro.cl/chat/${advisorCode}`
  const firstName = leadName ? leadName.split(' ')[0] : ''

  const inviteText = [
    `Hola${firstName ? ` ${firstName}` : ''}!`,
    '',
    'Tu perfil ha sido seleccionado para una *asesoria financiera exclusiva y gratuita* con Pessaro Capital.',
    '',
    String.fromCharCode(10003) + ' Forex, Commodities, Indices y Crypto',
    String.fromCharCode(10003) + ' Asesor profesional + asistente inteligente',
    String.fromCharCode(10003) + ' 100% gratuito, sin compromisos',
    '',
    advisorName ? `Tu asesor: *${advisorName}*` : '',
    '',
    '*Comienza aqui:*',
    chatLink,
  ].filter(Boolean).join('\n')

  async function shareWithImage() {
    setSending('image')
    try {
      const res = await fetch(OG_IMAGE_URL)
      const blob = await res.blob()
      const file = new File([blob], 'WAFinance-Pessaro.jpg', { type: 'image/jpeg' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: inviteText })
        if (onSend) onSend()
        setOpen(false)
      } else {
        sendTextOnly()
      }
    } catch (e) {
      if (e.name !== 'AbortError') sendTextOnly()
    } finally {
      setSending('')
    }
  }

  function sendTextOnly() {
    const phone = (leadPhone || '').replace(/\D/g, '')
    const encoded = encodeURIComponent(inviteText)
    window.open(phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`, '_blank')
    if (onSend) onSend()
    setOpen(false)
  }

  function copyAll() {
    navigator.clipboard.writeText(inviteText)
    const el = document.getElementById('waf-cp')
    if (el) { el.textContent = String.fromCharCode(10003) + ' Copiado'; setTimeout(() => { el.textContent = 'Copiar texto' }, 1500) }
  }

  const hasShareAPI = typeof navigator !== 'undefined' && !!navigator.canShare

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
        {compact ? String.fromCharCode(128185) : <>{'📲'} Invitar WAFinance</>}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 24, maxWidth: 420, width: '100%', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>Invitar a WAFinance</h3>
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>
                {String.fromCharCode(10005)}
              </button>
            </div>

            {/* Image preview */}
            <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={OG_IMAGE_URL} alt="WAFinance"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                onError={e => { e.target.parentElement.style.display = 'none' }} />
            </div>

            {/* Message preview */}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 14, maxHeight: 140, overflowY: 'auto' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{inviteText}</p>
            </div>

            {/* CTA Link highlight */}
            <div style={{ padding: '8px 12px', borderRadius: 8, background: `${ACCENT}12`, border: `1px solid ${ACCENT}30`, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 11, color: ACCENT, margin: 0, fontFamily: 'monospace' }}>{chatLink}</p>
              <button onClick={() => navigator.clipboard.writeText(chatLink)}
                style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
                Copiar
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hasShareAPI && (
                <button onClick={shareWithImage} disabled={!!sending}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 12,
                    background: `linear-gradient(135deg, ${WA}, #128C7E)`,
                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit',
                    opacity: sending ? 0.7 : 1,
                  }}>
                  {sending ? 'Preparando...' : 'Enviar imagen + texto'}
                </button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={sendTextOnly}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    background: hasShareAPI ? 'rgba(255,255,255,0.06)' : WA,
                    border: hasShareAPI ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  Solo texto
                </button>
                <button onClick={copyAll} id="waf-cp"
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  Copiar texto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
