import { useState, useEffect, useRef } from 'react'
import { useWhatsAppChat } from '../../hooks/useWhatsAppChat.ts'
import TemplatePicker from './TemplatePicker.jsx'

const C = {
  bg: '#0d0f17',
  surface: '#13151f',
  card: 'rgba(255,255,255,0.03)',
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

function StatusTicks({ status }) {
  if (status === 'read')
    return <span style={{ fontSize: 11, color: C.blue, marginLeft: 4 }} title="Leído">✓✓</span>
  if (status === 'delivered')
    return <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }} title="Entregado">✓✓</span>
  if (status === 'sent')
    return <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }} title="Enviado">✓</span>
  if (status === 'failed')
    return <span style={{ fontSize: 11, color: '#ff4757', marginLeft: 4 }} title="Error">✗</span>
  return null
}

function MessageBubble({ msg }) {
  const out = msg.direction === 'outbound'
  const text = msg.content?.text || (msg.message_type === 'template' ? `📋 ${msg.template_name || 'plantilla'}` : `[${msg.message_type}]`)
  const time = new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '72%',
        background: out ? 'rgba(108,92,231,0.18)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${out ? 'rgba(108,92,231,0.3)' : C.border}`,
        borderRadius: out ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '9px 12px',
      }}>
        <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{text}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 2 }}>
          <span style={{ fontSize: 10, color: C.muted }}>{time}</span>
          {out && <StatusTicks status={msg.status} />}
        </div>
      </div>
    </div>
  )
}

export default function ChatWindow({ clientPhone, clientName, staffId }) {
  const { messages, loading, sendText, sendTemplate } = useWhatsAppChat(clientPhone || '')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!text.trim() || !clientPhone) return
    setSending(true)
    setError('')
    const result = await sendText(text.trim(), staffId)
    setSending(false)
    if (result?.success) {
      setText('')
    } else {
      setError(result?.error || 'Error al enviar')
    }
  }

  async function handleSendTemplate(templateName, language, components) {
    if (!clientPhone) return
    setSending(true)
    setError('')
    const result = await sendTemplate(templateName, language, components, staffId)
    setSending(false)
    if (!result?.success) setError(result?.error || 'Error al enviar plantilla')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!clientPhone) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>💬</div>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Selecciona una conversación</p>
        <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>o espera un mensaje entrante</p>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, height: '100%' }}>
      {/* Chat header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.green }}>
          {(clientName || clientPhone)[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{clientName || clientPhone}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{clientPhone}</div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading && <p style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>Cargando historial...</p>}
        {!loading && messages.length === 0 && (
          <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 40 }}>Sin mensajes aún. Envía el primero.</p>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '6px 20px', background: 'rgba(255,71,87,0.10)', borderTop: '1px solid rgba(255,71,87,0.2)' }}>
          <p style={{ color: '#ff4757', fontSize: 12, margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.surface, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {/* Template button */}
        <button
          onClick={() => setShowPicker(true)}
          title="Enviar plantilla aprobada"
          style={{ background: C.purpleDim, border: `1px solid rgba(108,92,231,0.3)`, borderRadius: 8, padding: '9px 10px', cursor: 'pointer', fontSize: 14, color: C.purple, flexShrink: 0 }}
        >
          📋
        </button>

        {/* Text input */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe un mensaje... (Enter para enviar)"
          rows={1}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none',
            fontFamily: 'inherit', resize: 'none', lineHeight: 1.4, maxHeight: 120, overflowY: 'auto',
          }}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          style={{
            background: sending || !text.trim() ? 'rgba(0,208,132,0.12)' : `linear-gradient(135deg, #00e096, ${C.green})`,
            color: sending || !text.trim() ? C.green : '#000',
            border: 'none', borderRadius: 8, padding: '9px 14px', cursor: sending || !text.trim() ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}
        >
          {sending ? '...' : '↑'}
        </button>
      </div>

      {showPicker && (
        <TemplatePicker
          onSend={handleSendTemplate}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
