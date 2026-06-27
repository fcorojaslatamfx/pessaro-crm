import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const NAVY   = '#0a1628'
const ACCENT = '#6c5ce7'
const GOLD   = '#f0a500'
const SUCCESS = '#10b981'
const ERROR_C = '#ef4444'

// Separate Supabase client for public chat - NO auth persistence
// This prevents the CRM auth watchdog from redirecting visitors
const chatSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)

const SESSION_KEY = 'waf_session'

export default function WAFinanceChat() {
  const referralCode = window.location.pathname.split('/')[2] || ''

  const [step, setStep]       = useState('form')
  const [form, setForm]       = useState({ name: '', email: '', phone: '' })
  const [otpId, setOtpId]     = useState('')
  const [otp, setOtp]         = useState('')
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages]   = useState([])
  const [newMsg, setNewMsg]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [advisorName, setAdvisorName] = useState('')
  const [pwaPrompt, setPwaPrompt] = useState(null)
  const [showPwaBanner, setShowPwaBanner] = useState(false)
  const bottomRef = useRef(null)

  const OTP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wafinance_otp`

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const { sid, name, advisorName: savedAdvisor } = JSON.parse(saved)
        if (sid) {
          setSessionId(sid)
          setForm(p => ({ ...p, name: name || '' }))
          if (savedAdvisor) setAdvisorName(savedAdvisor)
          setStep('chat')
        }
      } catch (_) { /* ignore */ }
    }
  }, [])

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setPwaPrompt(e)
      setShowPwaBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function installPWA() {
    if (!pwaPrompt) return
    pwaPrompt.prompt()
    const result = await pwaPrompt.userChoice
    if (result.outcome === 'accepted') setShowPwaBanner(false)
    setPwaPrompt(null)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!sessionId) return
    ;(async () => {
      const { data } = await chatSupabase
        .from('live_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at')
      setMessages(data || [])
    })()

    const channel = chatSupabase
      .channel(`waf:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_chat_messages',
        filter: `session_id=eq.${sessionId}`,
      }, p => setMessages(prev => {
        if (prev.find(m => m.id === p.new.id)) return prev
        return [...prev, p.new]
      }))
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [sessionId])

  async function submitForm(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Completa todos los campos')
      return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch(OTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          advisor_code: referralCode,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.otp_id) throw new Error(data.error || 'Error al enviar OTP')
      setOtpId(data.otp_id)
      if (data.advisor_name) setAdvisorName(data.advisor_name)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(e) {
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
      if (!res.ok || !data.session_id) throw new Error(data.error || 'Código incorrecto')
      setSessionId(data.session_id)
      const verifiedAdvisor = data.advisor_name || advisorName
      if (verifiedAdvisor) setAdvisorName(verifiedAdvisor)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sid: data.session_id, name: form.name, advisorName: verifiedAdvisor }))
      setStep('chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMsg.trim() || !sessionId) return
    const text = newMsg.trim()
    setNewMsg('')
    const { error: insertError } = await chatSupabase.from('live_chat_messages').insert({
      session_id: sessionId,
      direction: 'inbound',
      content: text,
      sender_name: form.name || 'Visitante',
    })
    if (insertError) {
      console.error('Error enviando mensaje:', insertError)
      setNewMsg(text)
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
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '40px 20px' }}>

        {/* PWA Install Banner */}
        {showPwaBanner && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: `${GOLD}22`, border: `1px solid ${GOLD}50`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Instalar WAFinance</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>Accede más rápido desde tu pantalla de inicio</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={installPWA} style={{ padding: '6px 14px', borderRadius: 8, background: GOLD, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Instalar</button>
              <button onClick={() => setShowPwaBanner(false)} style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg,${ACCENT},${GOLD})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 12 }}>
            💹
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>WAFinance</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: 0 }}>Chat seguro con tu asesor Pessaro Capital</p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28 }}>

          {step === 'form' && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 18px' }}>Conectar con un asesor</h2>
              {[
                ['name',  'Nombre completo',       'Juan García',       'text'],
                ['email', 'Correo electrónico',     'juan@email.com',    'email'],
                ['phone', 'Teléfono (WhatsApp)',    '+56 9 1234 5678',   'tel'],
              ].map(([field, label, placeholder, type]) => (
                <div key={field} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {label}
                  </label>
                  <input
                    type={type} id={`waf-${field}`} name={field}
                    value={form[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder} required style={inputStyle}
                  />
                </div>
              ))}
              {error && (
                <p style={{ fontSize: 12, color: ERROR_C, margin: '0 0 12px', background: `${ERROR_C}18`, border: `1px solid ${ERROR_C}30`, borderRadius: 8, padding: '8px 12px' }}>{error}</p>
              )}
              <button type="button" onClick={submitForm} disabled={loading} style={btnPrimary(loading)}>
                {loading ? 'Enviando...' : 'Recibir código →'}
              </button>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: '12px 0 0' }}>
                Te enviaremos un código de verificación por email
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
              <input type="text" id="waf-otp" name="otp" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" maxLength={6} autoFocus
                style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: '0.5em', fontFamily: 'monospace', borderColor: otp.length === 6 ? ACCENT : 'rgba(255,255,255,0.12)', marginBottom: 14 }}
              />
              {error && (
                <p style={{ fontSize: 12, color: ERROR_C, margin: '0 0 12px', background: `${ERROR_C}18`, border: `1px solid ${ERROR_C}30`, borderRadius: 8, padding: '8px 12px' }}>{error}</p>
              )}
              <button type="button" onClick={verifyOtp} disabled={loading || otp.length !== 6} style={btnPrimary(loading || otp.length !== 6)}>
                {loading ? 'Verificando...' : 'Iniciar chat →'}
              </button>
              <button type="button" onClick={() => { setStep('form'); setOtp(''); setError('') }}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>
                ← Volver
              </button>
            </div>
          )}

          {step === 'chat' && (
            <div>
              {/* Session bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: GOLD, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>💹 WAFinance</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: '2px 0 0' }}>
                    {form.name || 'Visitante'} <span style={{ fontSize: 11, color: SUCCESS }}>· ● Conectado</span>
                  </p>
                </div>
                {advisorName && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Tu asesor</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: '2px 0 0' }}>{advisorName}</p>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${SUCCESS}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>Chat en vivo</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: SUCCESS }} />
                    <p style={{ fontSize: 11, color: SUCCESS, margin: 0 }}>Conectado</p>
                  </div>
                </div>
              </div>

              <div style={{ minHeight: 280, maxHeight: 380, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
                    Tu asesor responderá en breve...
                  </div>
                )}
                {messages.map(m => {
                  const isVisitor = m.direction === 'inbound'
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isVisitor ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '10px 14px', lineHeight: 1.55, fontSize: 13, color: '#fff',
                        borderRadius: isVisitor ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isVisitor ? `linear-gradient(135deg,${ACCENT},${GOLD})` : 'rgba(255,255,255,0.1)',
                      }}>
                        {!isVisitor && (
                          <p style={{ fontSize: 10, fontWeight: 700, color: GOLD, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asesor</p>
                        )}
                        {m.content}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" id="waf-message" name="message" value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
                  placeholder="Escribe un mensaje..."
                  style={{ flex: 1, padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
                <button type="button" onClick={sendMessage} disabled={!newMsg.trim()} style={{ padding: '11px 18px', borderRadius: 12, background: `linear-gradient(135deg,${ACCENT},${GOLD})`, border: 'none', color: '#fff', fontSize: 18, cursor: newMsg.trim() ? 'pointer' : 'not-allowed', opacity: newMsg.trim() ? 1 : 0.5 }}>
                  ➤
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
          Pessaro Capital © 2026 · Conversación segura
        </p>
      </div>
    </div>
  )
}
