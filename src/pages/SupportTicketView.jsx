import { useState, useEffect, useRef, useCallback } from 'react'

const NAVY   = '#0a1628'
const ACCENT = '#6c5ce7'
const GOLD   = '#f0a500'
const SUCCESS = '#10b981'
const ERROR_C = '#ef4444'
const MUTED  = 'rgba(255,255,255,0.5)'

const SESSION_KEY = 'support_session'
const POLL_MS = 5000

const STATUS_LABEL = { abierto: 'Abierto', en_proceso: 'En proceso', cerrado: 'Cerrado' }
const STATUS_COLOR = { abierto: GOLD, en_proceso: ACCENT, cerrado: SUCCESS }

export default function SupportTicketView() {
  const ticketNumber = window.location.pathname.split('/')[3] || ''
  const OTP_URL     = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support_otp`
  const TICKETS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support_tickets`

  const [session, setSession] = useState(null) // { token, email, name }
  const [reauthStep, setReauthStep] = useState('email') // email -> otp
  const [reauthEmail, setReauthEmail] = useState('')
  const [otpId, setOtpId] = useState('')
  const [otp, setOtp] = useState('')

  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const bottomRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      try { setSession(JSON.parse(saved)) } catch (_) { /* ignore */ }
    }
  }, [])

  const fetchTicket = useCallback(async (token, { silent } = {}) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(TICKETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_ticket', session_token: token, ticket_number: ticketNumber }),
      })
      const data = await res.json()
      if (res.status === 401) { setSession(null); sessionStorage.removeItem(SESSION_KEY); return }
      if (!res.ok || !data.ticket) { setNotFound(true); return }
      setTicket(data.ticket)
      setMessages(data.messages || [])
      setNotFound(false)
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketNumber])

  useEffect(() => {
    if (!session?.token) return
    fetchTicket(session.token)
    pollRef.current = setInterval(() => fetchTicket(session.token, { silent: true }), POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [session, fetchTicket])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function requestReauth(e) {
    e.preventDefault()
    if (!reauthEmail.trim()) { setError('Ingresa tu email'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(OTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', client_email: reauthEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.otp_id) throw new Error(data.error || 'Error al enviar el código')
      setOtpId(data.otp_id)
      setReauthStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyReauth(e) {
    e.preventDefault()
    if (otp.length !== 6) { setError('Ingresa el código de 6 dígitos'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(OTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', otp_id: otpId, code: otp }),
      })
      const data = await res.json()
      if (!res.ok || !data.session_token) throw new Error(data.error || 'Código incorrecto')
      const newSession = { token: data.session_token, email: reauthEmail.trim(), name: session?.name || '' }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession))
      setSession(newSession)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMsg.trim() || !session?.token) return
    const content = newMsg.trim()
    setNewMsg('')
    try {
      const res = await fetch(TICKETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_message', session_token: session.token, ticket_number: ticketNumber, content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar el mensaje')
      fetchTicket(session.token, { silent: true })
    } catch (err) {
      setError(err.message)
      setNewMsg(content)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }
  const btnPrimary = (disabled) => ({
    width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
    background: `linear-gradient(135deg,${ACCENT},${GOLD})`,
    color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, fontFamily: 'inherit',
  })

  // ── Sin sesión: pedir re-verificación por email ──────────────────────────
  if (!session?.token) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Verifica tu identidad</h2>
          <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.5 }}>
            Tu sesión expiró o no la tenemos guardada en este dispositivo. Ingresa el email con el que creaste el ticket <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{ticketNumber}</strong>.
          </p>
        </div>

        {reauthStep === 'email' && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Correo electrónico</label>
            <input type="email" id="stv-email" name="email" value={reauthEmail}
              onChange={e => setReauthEmail(e.target.value)}
              placeholder="juan@email.com" style={{ ...inputStyle, marginBottom: 14 }} />
            {error && <ErrorBox msg={error} />}
            <button type="button" onClick={requestReauth} disabled={loading} style={btnPrimary(loading)}>
              {loading ? 'Enviando...' : 'Recibir código →'}
            </button>
          </div>
        )}

        {reauthStep === 'otp' && (
          <div>
            <input type="text" id="stv-otp" name="otp" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" maxLength={6} autoFocus
              style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: '0.5em', fontFamily: 'monospace', marginBottom: 14 }}
            />
            {error && <ErrorBox msg={error} />}
            <button type="button" onClick={verifyReauth} disabled={loading || otp.length !== 6} style={btnPrimary(loading || otp.length !== 6)}>
              {loading ? 'Verificando...' : 'Verificar →'}
            </button>
          </div>
        )}
      </Shell>
    )
  }

  if (notFound) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>❓</div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Ticket no encontrado</h2>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Verifica el número de ticket o que estés usando el email correcto.</p>
        </div>
      </Shell>
    )
  }

  if (loading && !ticket) {
    return <Shell><p style={{ textAlign: 'center', color: MUTED, fontSize: 13 }}>Cargando ticket...</p></Shell>
  }

  return (
    <Shell wide>
      {/* Session bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: GOLD, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🎫 {ticketNumber}</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: '2px 0 0' }}>{ticket?.subject}</p>
        </div>
        {ticket && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: `${STATUS_COLOR[ticket.status]}20`, color: STATUS_COLOR[ticket.status] }}>
            {STATUS_LABEL[ticket.status] || ticket.status}
          </span>
        )}
      </div>

      <div style={{ minHeight: 280, maxHeight: 420, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
            Un asesor responderá en breve...
          </div>
        )}
        {messages.map(m => {
          const isClient = m.sender_type === 'client'
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', lineHeight: 1.55, fontSize: 13, color: '#fff',
                borderRadius: isClient ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isClient ? `linear-gradient(135deg,${ACCENT},${GOLD})` : 'rgba(255,255,255,0.1)',
              }}>
                {!isClient && (
                  <p style={{ fontSize: 10, fontWeight: 700, color: GOLD, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {m.sender_type === 'system' ? 'Sistema' : 'Asesor'}
                  </p>
                )}
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <ErrorBox msg={error} />}

      <div style={{ display: 'flex', gap: 8 }}>
        <input type="text" id="stv-message" name="message" value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
          placeholder="Escribe un mensaje..."
          style={{ flex: 1, padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        />
        <button type="button" onClick={sendMessage} disabled={!newMsg.trim()} style={{ padding: '11px 18px', borderRadius: 12, background: `linear-gradient(135deg,${ACCENT},${GOLD})`, border: 'none', color: '#fff', fontSize: 18, cursor: newMsg.trim() ? 'pointer' : 'not-allowed', opacity: newMsg.trim() ? 1 : 0.5 }}>
          ➤
        </button>
      </div>
    </Shell>
  )
}

function Shell({ children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: NAVY, overflowY: 'auto', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: wide ? 560 : 460, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28 }}>
          {children}
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
          Pessaro Capital © 2026 · Soporte seguro
        </p>
      </div>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <p style={{ fontSize: 12, color: ERROR_C, margin: '0 0 12px', background: `${ERROR_C}18`, border: `1px solid ${ERROR_C}30`, borderRadius: 8, padding: '8px 12px' }}>{msg}</p>
  )
}
