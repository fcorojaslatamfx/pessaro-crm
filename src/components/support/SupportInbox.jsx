import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'

const P = {
  navy:    '#0a1628',
  dark1:   '#0f1d32',
  dark2:   '#152238',
  dark3:   '#1a2942',
  accent:  '#6c5ce7',
  gold:    '#f0a500',
  border:  'rgba(255,255,255,0.08)',
  borderL: 'rgba(255,255,255,0.12)',
  success: '#10b981',
  error:   '#ef4444',
  text:    '#e2e8f0',
  muted:   '#718096',
  white70: 'rgba(255,255,255,0.7)',
  white50: 'rgba(255,255,255,0.5)',
  white30: 'rgba(255,255,255,0.3)',
}

const FILTERS = [
  { id: 'abiertos',   label: 'Abiertos',    match: (t) => t.status === 'abierto' },
  { id: 'en_proceso', label: 'En proceso',  match: (t) => t.status === 'en_proceso' },
  { id: 'cerrados',   label: 'Cerrados',    match: (t) => t.status === 'cerrado' },
  { id: 'mios',       label: 'Míos',        match: null }, // resuelto con staffProfile
]

const CATEGORY_LABEL = { general: 'General', cuenta: 'Cuenta', trading: 'Trading', deposito: 'Depósito', retiro: 'Retiro', tecnico: 'Técnico' }
const STATUS_COLOR = { abierto: P.gold, en_proceso: P.accent, cerrado: P.success }
const STATUS_LABEL = { abierto: 'Abierto', en_proceso: 'En proceso', cerrado: 'Cerrado' }
const EVENT_LABEL = { creado: 'Creado', estado: 'Cambio de estado', asignacion: 'Asignación', cerrado: 'Cerrado', reabierto: 'Reabierto' }

function fmt(d) {
  if (!d) return ''
  const dt = new Date(d)
  const now = new Date()
  if (dt.toDateString() === now.toDateString()) return dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function fmtFull(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SupportInbox({ user, staffProfile, isSuperAdmin }) {
  const [tickets, setTickets]       = useState([])
  const [lastMsgByTicket, setLastMsgByTicket] = useState({})
  const [filter, setFilter]         = useState('abiertos')
  const [activeId, setActiveId]     = useState(null)
  const [messages, setMessages]     = useState([])
  const [newMsg, setNewMsg]         = useState('')
  const [staffList, setStaffList]   = useState([])
  const [sending, setSending]       = useState(false)
  const [statusNotice, setStatusNotice] = useState('')
  const [showHistory, setShowHistory]   = useState(false)
  const [events, setEvents]             = useState([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const bottomRef = useRef(null)
  const channelRef = useRef(null)

  const activeTicket = tickets.find(t => t.id === activeId)

  const loadTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100)
    setTickets(data || [])
  }, [])

  const loadLastMessages = useCallback(async () => {
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('ticket_id, sender_type, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    const map = {}
    for (const m of data || []) {
      if (!map[m.ticket_id]) map[m.ticket_id] = m
    }
    setLastMsgByTicket(map)
  }, [])

  useEffect(() => {
    loadTickets()
    loadLastMessages()
    if (isSuperAdmin) {
      supabase.from('crm_staff_profiles').select('id,display_name,role').order('display_name')
        .then(({ data }) => setStaffList(data || []))
    }
    const ch = supabase
      .channel('support-tickets-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, p => {
        setTickets(prev => prev.find(t => t.id === p.new.id) ? prev : [p.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, p => {
        setTickets(prev => prev.map(t => t.id === p.new.id ? { ...t, ...p.new } : t))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_ticket_messages' }, () => loadLastMessages())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadTickets, loadLastMessages, isSuperAdmin])

  const loadEvents = useCallback(async (ticketId) => {
    if (!ticketId) return
    setLoadingEvents(true)
    const { data, error } = await supabase
      .from('support_ticket_events')
      .select('*, crm_staff_profiles(display_name)')
      .eq('ticket_id', ticketId)
      .order('created_at')
    if (error) console.error('Error cargando historial:', error)
    setEvents(data || [])
    setLoadingEvents(false)
  }, [])

  useEffect(() => {
    if (!activeId) return
    setMessages([])
    setStatusNotice('')
    setShowHistory(false)
    setEvents([])
    ;(async () => {
      const { data } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', activeId)
        .order('created_at')
      setMessages(data || [])
    })()

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase
      .channel(`support-msgs:${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_ticket_messages',
        filter: `ticket_id=eq.${activeId}`,
      }, p => setMessages(prev => {
        if (prev.find(m => m.id === p.new.id)) return prev
        return [...prev, p.new]
      }))
      .subscribe()
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const visibleTickets = tickets.filter(t => {
    const f = FILTERS.find(f => f.id === filter)
    if (!f) return true
    if (f.id === 'mios') return t.assigned_to === staffProfile?.id
    return f.match(t)
  })

  async function sendReply(e) {
    e.preventDefault()
    if (!newMsg.trim() || !activeId) return
    setSending(true)
    const content = newMsg.trim()
    setNewMsg('')
    const { error } = await supabase.from('support_ticket_messages').insert({
      ticket_id: activeId, sender_type: 'staff', sender_staff_id: staffProfile?.id, content,
    })
    if (error) {
      console.error('Error enviando respuesta:', error)
      setNewMsg(content)
    } else {
      // Toca updated_at para reordenar el ticket como reciente en el inbox
      const { data, error: statusError } = await supabase.from('support_tickets')
        .update({ status: activeTicket?.status === 'abierto' ? 'en_proceso' : activeTicket?.status })
        .eq('id', activeId)
        .select().single()
      if (statusError) console.error('Error actualizando estado tras respuesta:', statusError)
      else setTickets(prev => prev.map(t => (t.id === activeId ? { ...t, ...data } : t)))
    }
    setSending(false)
  }

  async function assignTo(staffId) {
    if (!activeId) return
    setStatusNotice('')
    const { data, error } = await supabase
      .from('support_tickets').update({ assigned_to: staffId || null }).eq('id', activeId)
      .select().single()
    if (error) { console.error('Error asignando asesor:', error); return }
    setTickets(prev => prev.map(t => (t.id === activeId ? { ...t, ...data } : t)))
    if (showHistory) loadEvents(activeId)
  }

  async function setStatus(status) {
    if (!activeId) return
    setStatusNotice('')
    const patch = { status, closed_at: status === 'cerrado' ? new Date().toISOString() : null }
    const { data, error } = await supabase
      .from('support_tickets').update(patch).eq('id', activeId)
      .select().single()
    if (error) {
      console.error('Error actualizando estado:', error)
      setStatusNotice(
        status === 'cerrado' ? 'Solo el asesor asignado puede cerrar este ticket.'
        : status === 'abierto' && activeTicket?.status === 'cerrado' ? 'Solo un super admin puede reabrir un ticket cerrado.'
        : 'No se pudo actualizar el estado.'
      )
      return
    }
    setTickets(prev => prev.map(t => (t.id === activeId ? { ...t, ...data } : t)))
    if (showHistory) loadEvents(activeId)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', borderRadius: 14, overflow: 'hidden', border: `1px solid ${P.border}`, background: P.navy, fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Left: ticket list */}
      <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${P.border}`, display: 'flex', flexDirection: 'column', background: P.dark1 }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${P.border}` }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: P.text, margin: 0 }}>🎫 Tickets de soporte</h3>
          <p style={{ fontSize: 11, color: P.muted, margin: '2px 0 0 0' }}>{visibleTickets.length} tickets</p>
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{
                  padding: '4px 9px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  fontWeight: filter === f.id ? 700 : 500,
                  background: filter === f.id ? `${P.accent}22` : 'rgba(255,255,255,0.03)',
                  color: filter === f.id ? P.accent : P.muted,
                  border: `1px solid ${filter === f.id ? P.accent + '40' : P.border}`,
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleTickets.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: P.muted, fontSize: 13 }}>Sin tickets en este filtro</div>
          )}
          {visibleTickets.map(t => {
            const active = t.id === activeId
            const lastMsg = lastMsgByTicket[t.id]
            const needsReply = lastMsg?.sender_type === 'client' && t.status !== 'cerrado'
            return (
              <button key={t.id} onClick={() => setActiveId(t.id)}
                style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', textAlign: 'left', background: active ? `${P.accent}18` : 'transparent', borderBottom: `1px solid ${P.border}`, border: 'none', borderLeft: active ? `3px solid ${P.accent}` : '3px solid transparent', fontFamily: 'inherit' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: active ? P.accent : `${P.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: active ? '#fff' : P.white70, flexShrink: 0 }}>
                  {(t.client_name || t.client_email || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: P.gold, fontFamily: 'monospace' }}>{t.ticket_number}</span>
                    <span style={{ fontSize: 10, color: P.muted, flexShrink: 0, marginLeft: 4 }}>{fmt(t.updated_at)}</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: needsReply ? 700 : 600, color: P.text, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.subject}
                  </p>
                  <p style={{ fontSize: 11, color: P.muted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.client_name || t.client_email}
                  </p>
                  <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${STATUS_COLOR[t.status]}18`, color: STATUS_COLOR[t.status], fontWeight: 600 }}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                    {t.status === 'cerrado' && t.closed_at && (
                      <span style={{ fontSize: 9, color: P.muted }}>{fmt(t.closed_at)}</span>
                    )}
                    {needsReply && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: P.gold, flexShrink: 0 }} title="Esperando respuesta" />
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: thread */}
      {!activeId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: P.muted, gap: 12 }}>
          <div style={{ fontSize: 48 }}>🎫</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: P.text, margin: 0 }}>Selecciona un ticket</p>
          <p style={{ fontSize: 12, margin: 0 }}>Elige un ticket de la lista para responder</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Header */}
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${P.border}`, background: P.dark2, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: P.gold, margin: 0, fontFamily: 'monospace' }}>{activeTicket?.ticket_number}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: P.text, margin: '2px 0 0' }}>{activeTicket?.subject}</p>
                <p style={{ fontSize: 11, color: P.muted, margin: '2px 0 0' }}>
                  {activeTicket?.client_name || '—'} · {activeTicket?.client_email} {activeTicket?.client_phone ? `· ${activeTicket.client_phone}` : ''}
                </p>
              </div>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: `${P.accent}18`, color: P.accent, fontWeight: 600, flexShrink: 0 }}>
                {CATEGORY_LABEL[activeTicket?.category] || activeTicket?.category}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {activeTicket?.status === 'cerrado' ? (
                isSuperAdmin ? (
                  <button onClick={() => setStatus('abierto')}
                    style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontWeight: 600, background: `${P.gold}22`, color: P.gold, border: `1px solid ${P.gold}50`, fontFamily: 'inherit' }}>
                    🔓 Reabrir ticket
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: P.muted, fontStyle: 'italic' }}>Ticket cerrado — solo lectura</span>
                )
              ) : (
                ['abierto', 'en_proceso', 'cerrado'].map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    style={{
                      padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                      background: activeTicket?.status === s ? `${STATUS_COLOR[s]}22` : 'transparent',
                      color: activeTicket?.status === s ? STATUS_COLOR[s] : P.muted,
                      border: `1px solid ${activeTicket?.status === s ? STATUS_COLOR[s] + '50' : P.borderL}`,
                      fontFamily: 'inherit',
                    }}>
                    {STATUS_LABEL[s]}
                  </button>
                ))
              )}

              {isSuperAdmin && activeTicket?.status !== 'cerrado' && (
                <select value={activeTicket?.assigned_to || ''} onChange={e => assignTo(e.target.value)}
                  style={{ marginLeft: 'auto', padding: '5px 8px', borderRadius: 7, border: `1px solid ${P.borderL}`, background: P.dark1, color: P.text, fontSize: 11, outline: 'none' }}>
                  <option value="">Sin asignar</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
              )}
            </div>

            {statusNotice && (
              <p style={{ fontSize: 11, color: P.error, margin: '8px 0 0' }}>{statusNotice}</p>
            )}

            <button onClick={() => { const next = !showHistory; setShowHistory(next); if (next) loadEvents(activeId) }}
              style={{ marginTop: 10, fontSize: 11, color: P.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
              {showHistory ? '▾' : '▸'} Historial
            </button>

            {showHistory && (
              <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', border: `1px solid ${P.border}`, borderRadius: 8, padding: '8px 10px', background: P.dark1 }}>
                {loadingEvents ? (
                  <p style={{ fontSize: 11, color: P.muted, margin: 0 }}>Cargando…</p>
                ) : events.length === 0 ? (
                  <p style={{ fontSize: 11, color: P.muted, margin: 0 }}>Sin eventos registrados</p>
                ) : (
                  events.map(ev => (
                    <div key={ev.id} style={{ padding: '5px 0', borderBottom: `1px solid ${P.border}`, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: P.text, fontWeight: 600 }}>
                        <span>{EVENT_LABEL[ev.event_type] || ev.event_type}</span>
                        <span style={{ color: P.muted, fontWeight: 400 }}>{fmtFull(ev.created_at)}</span>
                      </div>
                      <p style={{ margin: '2px 0 0', color: P.muted }}>
                        {ev.crm_staff_profiles?.display_name || 'Cliente/Sistema'}
                        {(ev.old_value || ev.new_value) && ` · ${ev.old_value || '—'} → ${ev.new_value || '—'}`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: P.dark3 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: P.muted, fontSize: 13 }}>Sin mensajes aún</div>
              )}
              {messages.map(m => {
                const isStaff = m.sender_type === 'staff'
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isStaff ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%', padding: '10px 14px',
                      borderRadius: isStaff ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isStaff ? P.accent : 'rgba(255,255,255,0.06)',
                      color: '#fff', fontSize: 13, lineHeight: 1.55,
                    }}>
                      {!isStaff && (
                        <p style={{ fontSize: 10, fontWeight: 700, color: P.gold, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {m.sender_type === 'system' ? 'Sistema' : 'Cliente'}
                        </p>
                      )}
                      {m.content}
                      <p style={{ fontSize: 10, margin: '4px 0 0', opacity: 0.45, textAlign: 'right' }}>{fmt(m.created_at)}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {activeTicket?.status === 'cerrado' && !isSuperAdmin ? (
              <div style={{ padding: '12px 18px', borderTop: `1px solid ${P.border}`, background: P.dark2, flexShrink: 0, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: P.muted, margin: 0 }}>Ticket cerrado — solo el super admin puede reabrirlo</p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: `1px solid ${P.border}`, background: P.dark2, flexShrink: 0 }}>
                <input type="text" id="support-reply" name="reply"
                  value={newMsg} onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e) } }}
                  placeholder="Responder al cliente..."
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${P.borderL}`, fontSize: 13, color: P.text, outline: 'none', background: P.dark1, fontFamily: 'inherit' }}
                />
                <button type="button" onClick={sendReply} disabled={!newMsg.trim() || sending}
                  style={{ padding: '9px 16px', borderRadius: 10, background: P.accent, border: 'none', color: '#fff', fontSize: 16, cursor: newMsg.trim() ? 'pointer' : 'not-allowed', opacity: newMsg.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>
                  ➤
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
