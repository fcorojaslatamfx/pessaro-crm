import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const P = {
  navy:   '#0a1628',
  accent: '#6c5ce7',
  gold:   '#f0a500',
  bg:     '#f5f7fa',
  border: '#e0e0e0',
  success:'#10b981',
  error:  '#ef4444',
  text:   '#1a202c',
  muted:  '#718096',
  surface:'#ffffff',
}

const ADVISOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wafinance_advisor`

function fmt(d) {
  if (!d) return ''
  const dt = new Date(d)
  const now = new Date()
  if (dt.toDateString() === now.toDateString()) return dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

export default function WAFinanceChatInbox({ user, staffProfile, isSuperAdmin }) {
  const [sessions, setSessions]       = useState([])
  const [activeId, setActiveId]       = useState(null)
  const [messages, setMessages]       = useState([])
  const [newMsg, setNewMsg]           = useState('')
  const [suggestion, setSuggestion]   = useState('')
  const [loadingSug, setLoadingSug]   = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ investment_profile: '', investment_capital: '', risk_tolerance: '', advisor_notes: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved]   = useState(false)
  const bottomRef = useRef(null)
  const channelRef = useRef(null)
  const sessChannelRef = useRef(null)

  const activeSession = sessions.find(s => s.id === activeId)

  // Load sessions
  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from('live_chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50)
    setSessions(data || [])
  }, [])

  useEffect(() => {
    loadSessions()

    // Realtime: new sessions
    const ch = supabase
      .channel('waf-sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_sessions' },
        () => loadSessions())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_chat_sessions' },
        () => loadSessions())
      .subscribe()

    sessChannelRef.current = ch
    return () => { ch.unsubscribe() }
  }, [loadSessions])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeId) return
    setMessages([])
    setSuggestion('')

    ;(async () => {
      const { data } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('session_id', activeId)
        .order('created_at')
      setMessages(data || [])

      // Load context/profile
      const { data: ctx } = await supabase
        .from('lead_advisor_context')
        .select('*')
        .eq('session_id', activeId)
        .single()
      if (ctx) {
        setProfileForm({
          investment_profile: ctx.investment_profile || '',
          investment_capital: ctx.investment_capital || '',
          risk_tolerance: ctx.risk_tolerance || '',
          advisor_notes: ctx.advisor_notes || '',
        })
      } else {
        setProfileForm({ investment_profile: '', investment_capital: '', risk_tolerance: '', advisor_notes: '' })
      }
    })()

    // Unsubscribe previous channel
    if (channelRef.current) channelRef.current.unsubscribe()

    const channel = supabase
      .channel(`waf-msgs:${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_chat_messages',
        filter: `session_id=eq.${activeId}`,
      }, p => setMessages(prev => {
        if (prev.find(m => m.id === p.new.id)) return prev
        return [...prev, p.new]
      }))
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMsg.trim() || !activeId) return
    const text = newMsg.trim()
    setNewMsg('')
    const { error } = await supabase.from('live_chat_messages').insert({
      session_id: activeId,
      direction: 'outbound',
      content: text,
      sender_name: staffProfile?.display_name || 'Asesor',
    })
    if (error) {
      console.error('Error enviando mensaje:', error)
      setNewMsg(text)
    }
  }

  async function fetchSuggestion() {
    if (!activeId || !user) return
    setLoadingSug(true)
    setSuggestion('')
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const jwt = authSession?.access_token
      if (!jwt) throw new Error('Sin autenticación')

      const lastUserMsg = [...messages].reverse().find(m => m.direction === 'inbound')
      const res = await fetch(ADVISOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          action: 'suggest_response',
          session_id: activeId,
          user_message: lastUserMsg?.content || '(sin mensaje del cliente aún)',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al obtener sugerencia')
      setSuggestion(data.suggested_response || '')
    } catch (err) {
      setSuggestion(`Error: ${err.message}`)
    } finally {
      setLoadingSug(false)
    }
  }

  async function saveProfile() {
    if (!activeId) return
    setSavingProfile(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const jwt = authSession?.access_token
      if (!jwt) throw new Error('Sin autenticación')

      await fetch(ADVISOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          action: 'update_context',
          session_id: activeId,
          ...profileForm,
        }),
      })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (err) {
      console.error('saveProfile error:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  const labelStyle = { fontSize: 11, fontWeight: 600, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, display: 'block' }
  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${P.border}`, background: P.surface, fontSize: 13, color: P.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', borderRadius: 14, overflow: 'hidden', border: `1px solid ${P.border}`, background: P.bg, fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── Left: Session list ── */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${P.border}`, display: 'flex', flexDirection: 'column', background: P.surface }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${P.border}` }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: P.navy, margin: 0 }}>Sesiones WAFinance</h3>
          <p style={{ fontSize: 11, color: P.muted, margin: '2px 0 0' }}>{sessions.length} conversaciones</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessions.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: P.muted, fontSize: 13 }}>
              Sin sesiones activas
            </div>
          )}
          {sessions.map(s => {
            const active = s.id === activeId
            return (
              <button key={s.id} onClick={() => setActiveId(s.id)}
                style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', textAlign: 'left', background: active ? `${P.accent}12` : 'transparent', borderBottom: `1px solid ${P.border}`, border: 'none', borderLeft: active ? `3px solid ${P.accent}` : '3px solid transparent' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: active ? P.accent : `${P.navy}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: active ? '#fff' : P.navy, flexShrink: 0 }}>
                  {(s.visitor_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.visitor_name || 'Visitante'}
                    </span>
                    <span style={{ fontSize: 10, color: P.muted, flexShrink: 0, marginLeft: 4 }}>{fmt(s.updated_at)}</span>
                  </div>
                  <p style={{ fontSize: 11, color: P.muted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.visitor_email || s.visitor_phone || '—'}
                  </p>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: s.status === 'active' ? `${P.success}18` : `${P.muted}18`, color: s.status === 'active' ? P.success : P.muted, fontWeight: 600 }}>
                      {s.status === 'active' ? 'activa' : s.status || 'pendiente'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right: Chat + profile ── */}
      {!activeId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: P.muted, gap: 12 }}>
          <div style={{ fontSize: 48 }}>💬</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: P.navy, margin: 0 }}>Selecciona una sesión</p>
          <p style={{ fontSize: 12, margin: 0 }}>Elige una conversación para responder</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Chat header */}
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: P.surface, flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: P.navy, margin: 0 }}>{activeSession?.visitor_name || 'Visitante'}</p>
              <p style={{ fontSize: 11, color: P.muted, margin: 0 }}>{activeSession?.visitor_email} · {activeSession?.visitor_phone}</p>
            </div>
            <button onClick={() => setShowProfile(p => !p)}
              style={{ padding: '6px 12px', borderRadius: 8, background: showProfile ? `${P.accent}18` : 'transparent', border: `1px solid ${showProfile ? P.accent : P.border}`, color: showProfile ? P.accent : P.muted, fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
              👤 Perfil
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

            {/* Messages */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: P.muted, fontSize: 13 }}>Sin mensajes aún</div>
                )}
                {messages.map(m => {
                  const isOutbound = m.direction === 'outbound'
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '75%', padding: '10px 14px', borderRadius: isOutbound ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isOutbound ? P.accent : `${P.navy}0e`,
                        color: isOutbound ? '#fff' : P.text, fontSize: 13, lineHeight: 1.55,
                      }}>
                        {!isOutbound && (
                          <p style={{ fontSize: 10, fontWeight: 700, color: P.gold, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Cliente
                          </p>
                        )}
                        {m.content}
                        <p style={{ fontSize: 10, margin: '4px 0 0', opacity: 0.55, textAlign: 'right' }}>{fmt(m.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* AI suggestion */}
              {suggestion && (
                <div style={{ margin: '0 18px 10px', padding: '10px 14px', borderRadius: 10, background: `${P.gold}12`, border: `1px solid ${P.gold}40` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: P.gold, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>💡 Sugerencia IA</p>
                  <p style={{ fontSize: 13, color: P.text, margin: '0 0 8px', lineHeight: 1.5 }}>{suggestion}</p>
                  <button onClick={() => { setNewMsg(suggestion); setSuggestion('') }}
                    style={{ padding: '5px 12px', borderRadius: 7, background: P.gold, border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                    Usar →
                  </button>
                </div>
              )}

              {/* Input row */}
              <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: `1px solid ${P.border}`, background: P.surface, flexShrink: 0 }}>
                <button type="button" onClick={fetchSuggestion} disabled={loadingSug}
                  style={{ padding: '9px 12px', borderRadius: 10, background: `${P.gold}15`, border: `1px solid ${P.gold}50`, color: P.gold, fontSize: 16, cursor: loadingSug ? 'wait' : 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
                  title="Obtener sugerencia de IA">
                  {loadingSug ? '⏳' : '💡'}
                </button>
                <input
                  type="text"
                  id="waf-advisor-msg"
                  name="advisor-message"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Responder al cliente..."
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, outline: 'none', background: P.bg, fontFamily: 'inherit' }}
                />
                <button type="submit" disabled={!newMsg.trim()}
                  style={{ padding: '9px 16px', borderRadius: 10, background: P.accent, border: 'none', color: '#fff', fontSize: 16, cursor: newMsg.trim() ? 'pointer' : 'not-allowed', opacity: newMsg.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>
                  ➤
                </button>
              </form>
            </div>

            {/* Client profile panel */}
            {showProfile && (
              <div style={{ width: 260, borderLeft: `1px solid ${P.border}`, background: P.surface, overflowY: 'auto', padding: '14px 16px', flexShrink: 0 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: P.navy, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Perfil del cliente</h4>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Perfil inversor</label>
                  <select value={profileForm.investment_profile} onChange={e => setProfileForm(p => ({ ...p, investment_profile: e.target.value }))}
                    style={{ ...inputStyle }}>
                    <option value="">— Sin definir —</option>
                    <option value="conservador">Conservador</option>
                    <option value="moderado">Moderado</option>
                    <option value="agresivo">Agresivo</option>
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Capital a invertir (USD)</label>
                  <input type="number" value={profileForm.investment_capital} onChange={e => setProfileForm(p => ({ ...p, investment_capital: e.target.value }))}
                    placeholder="Ej: 5000" style={inputStyle} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Tolerancia al riesgo</label>
                  <select value={profileForm.risk_tolerance} onChange={e => setProfileForm(p => ({ ...p, risk_tolerance: e.target.value }))}
                    style={inputStyle}>
                    <option value="">— Sin definir —</option>
                    <option value="baja">Baja (1-3%)</option>
                    <option value="media">Media (3-7%)</option>
                    <option value="alta">Alta (7%+)</option>
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Notas del asesor</label>
                  <textarea value={profileForm.advisor_notes} onChange={e => setProfileForm(p => ({ ...p, advisor_notes: e.target.value }))}
                    placeholder="Notas internas..." rows={3}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} />
                </div>

                <button onClick={saveProfile} disabled={savingProfile}
                  style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: profileSaved ? P.success : P.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: savingProfile ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                  {savingProfile ? 'Guardando...' : profileSaved ? '✓ Guardado' : 'Guardar perfil'}
                </button>

                {activeSession && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${P.border}` }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Datos de sesión</p>
                    {[
                      ['Nombre', activeSession.visitor_name],
                      ['Email', activeSession.visitor_email],
                      ['Teléfono', activeSession.visitor_phone],
                      ['Código asesor', activeSession.advisor_code],
                    ].map(([k, v]) => v ? (
                      <div key={k} style={{ marginBottom: 6 }}>
                        <p style={{ fontSize: 10, color: P.muted, margin: 0 }}>{k}</p>
                        <p style={{ fontSize: 12, color: P.text, margin: 0, fontWeight: 500 }}>{v}</p>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
