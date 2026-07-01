import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import StartChatModal from './StartChatModal.jsx'

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
  blueDim: 'rgba(9,132,227,0.10)',
  orange: '#fd9644',
}

// Normaliza un teléfono para comparar: solo dígitos y +
// "+56 9 7331 2927" → "+56973312927"
// "56973312927"     → "+56973312927"  (agrega + si no existe)
function normalizePhone(p) {
  if (!p) return ''
  let clean = String(p).replace(/[^\d+]/g, '')
  if (!clean.startsWith('+') && clean.length > 0) clean = '+' + clean
  return clean
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

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function WhatsAppInbox({ selectedPhone, onSelect, isSuperAdmin, staffProfile, assignments, staffList, myContacts, currentUserId }) {
  const [allMessages, setAllMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todas') // super_admin only
  const [section, setSection] = useState('chats') // 'chats' | 'contactos'
  const [startChatContact, setStartChatContact] = useState(null)

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

  useEffect(() => {
    const ch = supabase
      .channel('wa-inbox-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, payload => {
        setAllMessages(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, payload => {
        setAllMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const allConversations = buildConversations(allMessages)

  // Visibilidad por rol
  let visibleConvs = isSuperAdmin
    ? allConversations
    : allConversations.filter(c =>
        (assignments || []).some(a => a.client_phone === c.phone && a.assigned_to === staffProfile?.id)
      )

  // Filtro extra para super_admin
  if (isSuperAdmin) {
    if (filter === 'sin_asignar') {
      visibleConvs = visibleConvs.filter(c => !(assignments || []).some(a => a.client_phone === c.phone))
    } else if (filter === 'mis') {
      visibleConvs = visibleConvs.filter(c =>
        (assignments || []).some(a => a.client_phone === c.phone && a.assigned_to === staffProfile?.id)
      )
    }
  }

  const totalUnread = visibleConvs.reduce((s, c) => s + c.unread, 0)
  const filtered = visibleConvs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  // Contactos personales del usuario sin chat activo
  // (su teléfono normalizado no aparece en allConversations)
  const conversationPhones = new Set(allConversations.map(c => normalizePhone(c.phone)))
  const contactsWithoutChat = (myContacts || [])
    .filter(c => c.phone && !conversationPhones.has(normalizePhone(c.phone)))
    .filter(c =>
      !search ||
      (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
    )

  function getAssignment(phone) {
    return (assignments || []).find(a => a.client_phone === phone)
  }
  function getStaff(id) {
    return (staffList || []).find(s => s.id === id)
  }

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
          placeholder="Buscar conversación o contacto..."
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none',
            boxSizing: 'border-box', marginBottom: 8,
          }}
        />
        {/* Section tabs (Chats activos vs Mis contactos sin chat) */}
        <div style={{ display: 'flex', gap: 4, marginBottom: isSuperAdmin && section === 'chats' ? 8 : 0 }}>
          <button onClick={() => setSection('chats')}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              fontWeight: section === 'chats' ? 700 : 500,
              background: section === 'chats' ? C.greenDim : 'rgba(255,255,255,0.03)',
              color: section === 'chats' ? C.green : C.muted,
              border: `1px solid ${section === 'chats' ? C.green + '40' : C.border}`,
            }}>
            💬 Chats {visibleConvs.length > 0 && `(${visibleConvs.length})`}
          </button>
          <button onClick={() => setSection('contactos')}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              fontWeight: section === 'contactos' ? 700 : 500,
              background: section === 'contactos' ? C.purpleDim : 'rgba(255,255,255,0.03)',
              color: section === 'contactos' ? C.purple : C.muted,
              border: `1px solid ${section === 'contactos' ? 'rgba(108,92,231,0.4)' : C.border}`,
            }}>
            🚀 Iniciar {contactsWithoutChat.length > 0 && `(${contactsWithoutChat.length})`}
          </button>
        </div>
        {/* Filter tabs — solo super_admin en sección chats */}
        {isSuperAdmin && section === 'chats' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {[['todas', 'Todas'], ['sin_asignar', 'Sin asignar'], ['mis', 'Mis']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  fontWeight: filter === id ? 700 : 400,
                  background: filter === id
                    ? (id === 'sin_asignar' ? 'rgba(253,150,68,0.15)' : C.greenDim)
                    : 'rgba(255,255,255,0.03)',
                  color: filter === id
                    ? (id === 'sin_asignar' ? C.orange : C.green)
                    : C.muted,
                  border: `1px solid ${filter === id ? (id === 'sin_asignar' ? C.orange + '40' : C.green + '40') : C.border}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 12 }}>Cargando...</div>
        )}

        {/* SECCIÓN CHATS */}
        {!loading && section === 'chats' && (
          <>
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: C.muted, fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                Sin conversaciones aún
              </div>
            )}
            {filtered.map(conv => {
              const active = conv.phone === selectedPhone
              const assignment = getAssignment(conv.phone)
              const assignedStaff = assignment ? getStaff(assignment.assigned_to) : null
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
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: active ? C.greenDim : C.purpleDim,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700,
                      color: active ? C.green : C.purple,
                    }}>
                      {(conv.name || '?')[0].toUpperCase()}
                    </div>
                    {isSuperAdmin && !assignment && (
                      <div style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 10, height: 10, borderRadius: '50%',
                        background: C.orange, border: '2px solid #13151f',
                      }} title="Sin asignar" />
                    )}
                    {isSuperAdmin && assignedStaff && (
                      <div style={{
                        position: 'absolute', bottom: -2, right: -5,
                        background: C.purple, color: '#fff',
                        fontSize: 7, fontWeight: 800, borderRadius: 4,
                        padding: '1px 3px', border: '1.5px solid #13151f',
                        lineHeight: 1.3,
                      }} title={assignedStaff.display_name}>
                        {initials(assignedStaff.display_name)}
                      </div>
                    )}
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
          </>
        )}

        {/* SECCIÓN INICIAR CHAT (mis contactos sin chat) */}
        {!loading && section === 'contactos' && (
          <>
            {contactsWithoutChat.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: C.muted, fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🚀</div>
                {(myContacts || []).length === 0
                  ? <>Aún no tienes contactos personales.<br/><span style={{ fontSize: 11 }}>Agrégalos en la sección Contactos.</span></>
                  : 'Todos tus contactos ya tienen chat iniciado'}
              </div>
            )}
            {contactsWithoutChat.length > 0 && (
              <div style={{ padding: '10px 14px 4px', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Mis contactos sin chat
              </div>
            )}
            {contactsWithoutChat.map(c => (
              <div
                key={c.id}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px',
                  borderBottom: `1px solid ${C.border}`,
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: C.purpleDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: C.purple,
                  flexShrink: 0,
                }}>
                  {(c.full_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.full_name}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.phone}
                  </div>
                </div>
                <button
                  onClick={() => setStartChatContact({ ...c, phone: normalizePhone(c.phone) })}
                  style={{
                    background: C.purple, color: '#fff', border: 'none',
                    borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                  title="Iniciar chat con plantilla"
                >
                  🚀 Iniciar
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modal: iniciar chat */}
      {startChatContact && (
        <StartChatModal
          contact={startChatContact}
          onClose={() => setStartChatContact(null)}
          onStarted={(c) => {
            // Cambiar a sección chats y seleccionar el nuevo
            setSection('chats')
            onSelect(normalizePhone(c.phone), c.full_name || c.phone)
          }}
        />
      )}
    </div>
  )
}
