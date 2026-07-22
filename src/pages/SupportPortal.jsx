import { useState } from 'react'

const NAVY   = '#0a1628'
const ACCENT = '#6c5ce7'
const GOLD   = '#f0a500'
const ERROR_C = '#ef4444'

const SESSION_KEY = 'support_session'

const CATEGORIES = [
  { value: 'general',  label: 'Consulta general' },
  { value: 'cuenta',   label: 'Mi cuenta' },
  { value: 'trading',  label: 'Trading' },
  { value: 'deposito', label: 'Depósitos' },
  { value: 'retiro',   label: 'Retiros' },
  { value: 'tecnico',  label: 'Problema técnico' },
]

export default function SupportPortal() {
  const OTP_URL     = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support_otp`
  const TICKETS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support_tickets`

  const [step, setStep] = useState('form') // form -> otp -> done
  const [form, setForm] = useState({ name: '', email: '', phone: '', category: 'general', subject: '', message: '' })
  const [otpId, setOtpId] = useState('')
  const [otp, setOtp] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submitForm(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError('Completa nombre, email, asunto y mensaje')
      return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch(OTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          client_email: form.email.trim(),
          client_name: form.name.trim(),
          client_phone: form.phone.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.otp_id) throw new Error(data.error || 'Error al enviar el código')
      setOtpId(data.otp_id)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyAndCreate(e) {
    e.preventDefault()
    if (otp.length !== 6) { setError('Ingresa el código de 6 dígitos'); return }
    setLoading(true); setError('')
    try {
      const verifyRes = await fetch(OTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', otp_id: otpId, code: otp }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok || !verifyData.session_token) throw new Error(verifyData.error || 'Código incorrecto')

      const ticketRes = await fetch(TICKETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_ticket',
          session_token: verifyData.session_token,
          client_name: form.name.trim(),
          client_phone: form.phone.trim(),
          category: form.category,
          subject: form.subject.trim(),
          message: form.message.trim(),
        }),
      })
      const ticketData = await ticketRes.json()
      if (!ticketRes.ok || !ticketData.ticket_number) throw new Error(ticketData.error || 'Error al crear el ticket')

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        token: verifyData.session_token,
        email: form.email.trim(),
        name: form.name.trim(),
      }))
      setTicketNumber(ticketData.ticket_number)
      setStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: NAVY, overflowY: 'auto', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg,${ACCENT},${GOLD})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 12 }}>
            🎫
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Soporte Pessaro Capital</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: 0 }}>Cuéntanos tu consulta, verificamos tu email y creamos tu ticket</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28 }}>

          {step === 'form' && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 18px' }}>Nuevo ticket</h2>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nombre completo</label>
                  <input type="text" id="sp-name" name="name" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Juan García" required style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Correo electrónico</label>
                  <input type="email" id="sp-email" name="email" value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="juan@email.com" required style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Teléfono (opcional)</label>
                  <input type="tel" id="sp-phone" name="phone" value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+56 9 1234 5678" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Categoría</label>
                <select id="sp-category" name="category" value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  style={{ ...inputStyle, appearance: 'auto' }}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Asunto</label>
                <input type="text" id="sp-subject" name="subject" value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Resumen breve de tu consulta" required style={inputStyle} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Mensaje</label>
                <textarea id="sp-message" name="message" value={form.message} rows={4}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Describe tu consulta con el mayor detalle posible" required
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }} />
              </div>

              {error && <ErrorBox msg={error} />}

              <button type="button" onClick={submitForm} disabled={loading} style={btnPrimary(loading)}>
                {loading ? 'Enviando...' : 'Recibir código →'}
              </button>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: '12px 0 0' }}>
                Te enviaremos un código de verificación por email antes de crear el ticket
              </p>
            </div>
          )}

          {step === 'otp' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📧</div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Verifica tu email</h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                  Código enviado a <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{form.email}</strong>
                </p>
              </div>
              <input type="text" id="sp-otp" name="otp" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" maxLength={6} autoFocus
                style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: '0.5em', fontFamily: 'monospace', borderColor: otp.length === 6 ? ACCENT : 'rgba(255,255,255,0.12)', marginBottom: 14 }}
              />
              {error && <ErrorBox msg={error} />}
              <button type="button" onClick={verifyAndCreate} disabled={loading || otp.length !== 6} style={btnPrimary(loading || otp.length !== 6)}>
                {loading ? 'Creando ticket...' : 'Verificar y crear ticket →'}
              </button>
              <button type="button" onClick={() => { setStep('form'); setOtp(''); setError('') }}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>
                ← Volver
              </button>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Ticket creado</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 18px', lineHeight: 1.5 }}>
                Tu número de ticket es
              </p>
              <div style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: `1px solid ${GOLD}40`, marginBottom: 20 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: GOLD, letterSpacing: '0.05em' }}>{ticketNumber}</span>
              </div>
              <button type="button" onClick={() => { window.location.href = `/soporte/ticket/${ticketNumber}` }} style={btnPrimary(false)}>
                Ver mi ticket →
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
          Pessaro Capital © 2026 · Soporte seguro
        </p>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em',
}

function ErrorBox({ msg }) {
  return (
    <p style={{ fontSize: 12, color: ERROR_C, margin: '0 0 12px', background: `${ERROR_C}18`, border: `1px solid ${ERROR_C}30`, borderRadius: 8, padding: '8px 12px' }}>{msg}</p>
  )
}
