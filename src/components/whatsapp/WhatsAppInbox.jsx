import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'

const C = {
  surface: '#13151f',
  border: 'rgba(255,255,255,0.07)',
  text: '#f1f2f6',
  textSub: '#a4b0be',
  muted: '#636e72',
  green: '#00d084',
  greenDim: 'rgba(0,208,132,0.12)',
  purple: '#6c5ce7',
  purpleDim: 'rgba(108,92,231,0.15)',
  blue: '#0984e3',
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

function previewText(msg) {
  if (!msg) return ''
  const c = msg.content
  if (c?.text) return c.text
  if (msg.message_type === 'template') return `📋 ${msg.template_name || 'plantilla'}`
  if (msg.message_type === 'image') return '🖼 Imagen'
  if (msg.message_type === 'document') return '📄 Documento'
  if (msg.message_type === 'audio') return '🎵 Audio'
  if (msg.message_type === 'location') return '📍 Ubicación'
  return msg.message_type
}

// Build conversations map from a flat list of messages
function buildConversations(messages) {
  const map = new Map()
  for (const msg of messages) {
    if (!map.has(msg.client_phone)) {
      map.set(msg.client_phone, {
        phone: msg.client_phone,
        name: msg.client_name || msg.client_phone,
        lastMsg: msg,
        unread: 0,
      })
    }
    const conv = map.get(msg.client_phone)
    if (msg.direction === 'inbound' && msg.status !== 'read') conv.unread++
  }
  return [...map.values()]
}

export default function WhatsAppInbox({ selectedPhone, onSelect }) {
  const [allMessages, setAllMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Carga inicial — UNA sola vez
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('created_at', { ascending: false })
      if (mounted) {
        setAllMessages(data || [])
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Realtime: NO recarga todo, solo actualiza en memoria
  useEffect(() => {
    const ch = supabase
      .channel('wa-inbox-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        setAllMessages(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        setAllMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const conversations = buildConversations(allMessages)
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)
  const filtered = conversations.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.surface, borderRight: `1px solid ${C.border}` }}>
      {/* Header */}
      <div style={{ padding: '16px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>WhatsApp</span>
          {totalUnread > 0 && (
            <span style={{ background: C.green, color: '#000', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 7px', marginLeft: 'auto' }}>
              {totalUnread}
            </span>
          )}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar conversación..."
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 12 }}>Cargando...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: C.muted, fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            Sin conversaciones aún
          </div>
        )}
        {filtered.map(conv => {
          const active = conv.phone === selectedPhone
          return (
            <button
              key={conv.phone}
              onClick={() => onSelect(conv.phone, conv.name)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px',
                background: active ? 'rgba(0,208,132,0.07)' : 'transparent',
                border: 'none',
                borderBottom: `1px solid ${C.border}`,
                borderLeft: active ? `3px solid ${C.green}` : '3px solid transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: active ? C.greenDim : C.purpleDim,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                color: active ? C.green : C.purple,
              }}>
                {(conv.name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: conv.unread ? 700 : 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                    {conv.name}
                  </span>
                  <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>
                    {fmtTime(conv.lastMsg?.created_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 145 }}>
                    {conv.lastMsg?.direction === 'outbound' && <span style={{ color: C.blue }}>Tú: </span>}
                    {previewText(conv.lastMsg)}
                  </span>
                  {conv.unread > 0 && (
                    <span style={{ background: C.green, color: '#000', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 6px', flexShrink: 0 }}>
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
