import { useState, useEffect, useRef } from 'react'
import { useWhatsAppChat } from '../../hooks/useWhatsAppChat.ts'
import { supabase } from '../../lib/supabase.js'
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
  blueDim: 'rgba(9,132,227,0.10)',
  red: '#ff4757',
  redDim: 'rgba(255,71,87,0.12)',
  orange: '#fd9644',
}

// ─── Adjuntos: MIMEs permitidos y límites Meta WhatsApp Cloud API ─────────────
const ALLOWED_MIMES = {
  'image/jpeg':                                                                       { label: 'JPG',  ext: 'jpg',  maxMB: 5,   icon: '🖼️', kind: 'image' },
  'image/png':                                                                        { label: 'PNG',  ext: 'png',  maxMB: 5,   icon: '🖼️', kind: 'image' },
  'application/pdf':                                                                  { label: 'PDF',  ext: 'pdf',  maxMB: 100, icon: '📄', kind: 'document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':          { label: 'DOCX', ext: 'docx', maxMB: 100, icon: '📝', kind: 'document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':                { label: 'XLSX', ext: 'xlsx', maxMB: 100, icon: '📊', kind: 'document' },
}
const ACCEPT_STRING = Object.keys(ALLOWED_MIMES).join(',')

function bytesToMB(n) { return (n / (1024 * 1024)).toFixed(1) }
function mimeInfo(mime) { return ALLOWED_MIMES[mime] || null }

async function getSignedUrl(path, expiresIn = 3600) {
  if (!path) return null
  const clean = path.replace(/^whatsapp-attachments\//, '')
  try {
    const { data } = await supabase.storage.from('whatsapp-attachments').createSignedUrl(clean, expiresIn)
    return data?.signedUrl || null
  } catch {
    return null
  }
}

// ─── Renderizado de media en mensajes ──────────────────────────────────────────
function MediaContent({ msg }) {
  const [signedUrl, setSignedUrl] = useState(null)
  const [errLoad, setErrLoad] = useState(false)
  const meta = mimeInfo(msg.media_mime) || { icon: '📎', label: 'FILE', kind: 'document' }
  const isImage = meta.kind === 'image'
  const name = msg.media_name || 'archivo'
  const sizeMB = msg.media_size ? bytesToMB(msg.media_size) : null
  const caption = msg.content?.caption || ''

  useEffect(() => {
    let cancel = false
    if (msg.media_storage_path) {
      getSignedUrl(msg.media_storage_path).then(url => {
        if (cancel) return
        if (url) setSignedUrl(url)
        else setErrLoad(true)
      })
    }
    return () => { cancel = true }
  }, [msg.media_storage_path])

  if (isImage) {
    return (
      <div>
        {signedUrl ? (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
            <img
              src={signedUrl}
              alt={name}
              style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, display: 'block', cursor: 'zoom-in' }}
              onError={() => setErrLoad(true)}
            />
          </a>
        ) : errLoad ? (
          <div style={{ padding: 10, color: C.muted, fontSize: 12 }}>No se pudo cargar la imagen</div>
        ) : (
          <div style={{ padding: '20px 14px', color: C.muted, fontSize: 12, textAlign: 'center' }}>Cargando imagen…</div>
        )}
        {caption && <p style={{ margin: '6px 0 0', fontSize: 13, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</p>}
      </div>
    )
  }

  return (
    <div>
      <a
        href={signedUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => { if (!signedUrl) e.preventDefault() }}
        style={{
          display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none',
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 12px', color: C.text,
          cursor: signedUrl ? 'pointer' : 'default', minWidth: 220,
        }}
      >
        <div style={{ fontSize: 26, lineHeight: 1 }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{meta.label}{sizeMB ? ` · ${sizeMB} MB` : ''}</div>
        </div>
        <div style={{ fontSize: 11, color: signedUrl ? C.blue : C.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {signedUrl ? 'Abrir ↗' : '…'}
        </div>
      </a>
      {caption && <p style={{ margin: '6px 0 0', fontSize: 13, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</p>}
    </div>
  )
}

function StatusTicks({ status }) {
  if (status === 'read')
    return <span style={{ fontSize: 11, color: C.blue, marginLeft: 4 }} title="Leído">✓✓</span>
  if (status === 'delivered')
    return <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }} title="Entregado">✓✓</span>
  if (status === 'sent')
    return <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }} title="Enviado">✓</span>
  if (status === 'failed')
    return <span style={{ fontSize: 11, color: C.red, marginLeft: 4 }} title="Error">✗</span>
  return null
}

function MessageBubble({ msg }) {
  const out = msg.direction === 'outbound'
  const hasMedia = (msg.message_type === 'image' || msg.message_type === 'document') && !!msg.media_storage_path
  const time = new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

  let body
  if (hasMedia) {
    body = <MediaContent msg={msg} />
  } else {
    const text = msg.content?.text || (msg.message_type === 'template' ? `📋 ${msg.template_name || 'plantilla'}` : `[${msg.message_type}]`)
    body = <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{text}</p>
  }

  return (
    <div style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: hasMedia ? '78%' : '72%',
        background: out ? 'rgba(108,92,231,0.18)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${out ? 'rgba(108,92,231,0.3)' : C.border}`,
        borderRadius: out ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '9px 12px',
      }}>
        {body}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 2 }}>
          <span style={{ fontSize: 10, color: C.muted }}>{time}</span>
          {out && <StatusTicks status={msg.status} />}
        </div>
      </div>
    </div>
  )
}

// ─── Modal de adjuntar archivo ─────────────────────────────────────────────────
function AttachmentModal({ clientPhone, clientName, staffId, staffList, currentUserId, onClose, onSent }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [assignToUserId, setAssignToUserId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState('')
  const inputRef = useRef(null)

  function validateFile(f) {
    const meta = mimeInfo(f.type)
    if (!meta) return `Tipo no permitido: ${f.type || 'desconocido'}. Permitidos: JPG, PNG, PDF, DOCX, XLSX.`
    if (f.size > meta.maxMB * 1024 * 1024) return `${meta.label} excede el límite de ${meta.maxMB} MB (tu archivo: ${bytesToMB(f.size)} MB).`
    return null
  }

  function handleSelect(f) {
    if (!f) return
    const v = validateFile(f)
    if (v) { setErr(v); setFile(null); setPreview(null); return }
    setErr('')
    setFile(f)
    if (f.type.startsWith('image/')) {
      const r = new FileReader()
      r.onload = e => setPreview(e.target?.result || null)
      r.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleSelect(f)
  }

  async function handleSend() {
    if (!file || uploading || !clientPhone) return
    setUploading(true)
    setErr('')
    setProgress('Subiendo archivo…')

    let storagePath = null
    try {
      const meta = mimeInfo(file.type)
      const d = new Date()
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const uid = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      storagePath = `${yyyy}/${mm}/${uid}.${meta.ext}`

      const { error: upErr } = await supabase.storage
        .from('whatsapp-attachments')
        .upload(storagePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (upErr) throw new Error(`Storage: ${upErr.message}`)

      setProgress('Enviando por WhatsApp…')
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No autenticado')

      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'send_media',
          to: clientPhone,
          storage_path: storagePath,
          media_mime: file.type,
          media_name: file.name,
          media_size: file.size,
          caption: caption.trim() || undefined,
          assign_to_user_id: assignToUserId || undefined,
          staff_id: staffId || undefined,
        }),
      })
      const result = await res.json()

      if (!result.success) {
        try { await supabase.storage.from('whatsapp-attachments').remove([storagePath]) } catch {}
        throw new Error(result.error || 'Error al enviar a WhatsApp')
      }

      onSent?.(result)
      onClose()
    } catch (e) {
      setErr(e.message || 'Error inesperado')
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  const meta = file ? mimeInfo(file.type) : null
  const assignableStaff = (staffList || []).filter(s => !currentUserId || s.user_id !== currentUserId)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={() => !uploading && onClose()}
    >
      <div
        style={{ background: '#1a1c2e', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: 22 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>📎 Adjuntar archivo</span>
          <button
            onClick={() => !uploading && onClose()}
            disabled={uploading}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: uploading ? 'not-allowed' : 'pointer', lineHeight: 1, padding: 0 }}
          >
            ✕
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Para: {clientName || clientPhone}</p>

        {!file && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? C.green : C.border}`,
              background: dragOver ? C.greenDim : 'rgba(255,255,255,0.02)',
              borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>📎</div>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: C.text, fontWeight: 600 }}>Arrastra aquí o haz click</p>
            <p style={{ margin: 0, fontSize: 11, color: C.muted }}>JPG / PNG ≤ 5 MB · PDF / DOCX / XLSX ≤ 100 MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          style={{ display: 'none' }}
          onChange={e => handleSelect(e.target.files?.[0])}
        />

        {file && meta && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
            {preview ? (
              <img
                src={preview}
                alt={file.name}
                style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, display: 'block', margin: '0 auto 10px' }}
              />
            ) : (
              <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>{meta.icon}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{meta.label} · {bytesToMB(file.size)} MB</div>
              </div>
              {!uploading && (
                <button
                  onClick={() => { setFile(null); setPreview(null); setErr('') }}
                  style={{ background: 'none', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}
                >
                  Cambiar
                </button>
              )}
            </div>
          </div>
        )}

        {file && (
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Mensaje (opcional)</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Texto que acompaña al archivo…"
              rows={2}
              disabled={uploading}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none',
                fontFamily: 'inherit', resize: 'vertical', minHeight: 50, boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {file && (
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Asignar chat a (opcional)</label>
            <select
              value={assignToUserId}
              onChange={e => setAssignToUserId(e.target.value)}
              disabled={uploading}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            >
              <option value="" style={{ background: C.surface }}>Sin asignar</option>
              {assignableStaff.filter(s => s.user_id).map(s => (
                <option key={s.id} value={s.user_id} style={{ background: C.surface }}>
                  {s.display_name}{s.role ? ` · ${s.role}` : ''}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>El asesor podrá ver y continuar este chat.</p>
          </div>
        )}

        {err && (
          <div style={{ background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 8, padding: '9px 12px' }}>
            <p style={{ color: C.red, fontSize: 12, margin: 0 }}>⚠ {err}</p>
          </div>
        )}

        {uploading && progress && (
          <div style={{ background: C.blueDim, border: `1px solid ${C.blue}30`, borderRadius: 8, padding: '9px 12px' }}>
            <p style={{ color: C.blue, fontSize: 12, margin: 0 }}>⏳ {progress}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={() => !uploading && onClose()}
            disabled={uploading}
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.textSub, borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!file || uploading}
            style={{
              background: !file || uploading ? C.greenDim : `linear-gradient(135deg, #00e096, ${C.green})`,
              color: !file || uploading ? C.green : '#000',
              border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700,
              cursor: !file || uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function ChatWindow({ clientPhone, clientName, staffId, isSuperAdmin, assignments, staffList, onAssign, currentUserId }) {
  const { messages, loading, sendText, sendTemplate } = useWhatsAppChat(clientPhone || '')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
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
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.green, flexShrink: 0 }}>
          {(clientName || clientPhone)[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{clientName || clientPhone}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{clientPhone}</div>
        </div>
        {clientPhone && (() => {
          const assignment = (assignments || []).find(a => a.client_phone === clientPhone)
          const assignedStaff = assignment ? (staffList || []).find(s => s.id === assignment.assigned_to) : null
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {assignedStaff ? (
                <span style={{ fontSize: 11, color: '#00d084', background: 'rgba(0,208,132,0.1)', border: '1px solid rgba(0,208,132,0.3)', borderRadius: 6, padding: '3px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {assignedStaff.display_name}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: '#fd9644', background: 'rgba(253,150,68,0.1)', border: '1px solid rgba(253,150,68,0.3)', borderRadius: 6, padding: '3px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Sin asignar
                </span>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => setShowAssign(true)}
                  style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: C.textSub, border: `1px solid ${C.border}`, fontWeight: 500, whiteSpace: 'nowrap' }}
                >
                  Asignar asesor
                </button>
              )}
            </div>
          )
        })()}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading && <p style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>Cargando historial...</p>}
        {!loading && messages.length === 0 && (
          <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 40 }}>Sin mensajes aún. Envía el primero.</p>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ padding: '6px 20px', background: 'rgba(255,71,87,0.10)', borderTop: '1px solid rgba(255,71,87,0.2)' }}>
          <p style={{ color: '#ff4757', fontSize: 12, margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.surface, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button
          onClick={() => setShowPicker(true)}
          title="Enviar plantilla aprobada"
          style={{ background: C.purpleDim, border: `1px solid rgba(108,92,231,0.3)`, borderRadius: 8, padding: '9px 10px', cursor: 'pointer', fontSize: 14, color: C.purple, flexShrink: 0 }}
        >
          📋
        </button>

        {/* Attachment button — SOLO super_admin */}
        {isSuperAdmin && (
          <button
            onClick={() => setShowAttach(true)}
            title="Adjuntar archivo (JPG, PNG, PDF, DOCX, XLSX)"
            style={{ background: C.blueDim, border: `1px solid ${C.blue}30`, borderRadius: 8, padding: '9px 10px', cursor: 'pointer', fontSize: 14, color: C.blue, flexShrink: 0 }}
          >
            📎
          </button>
        )}

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

      {/* Attachment modal — solo super_admin */}
      {showAttach && isSuperAdmin && (
        <AttachmentModal
          clientPhone={clientPhone}
          clientName={clientName}
          staffId={staffId}
          staffList={staffList}
          currentUserId={currentUserId}
          onClose={() => setShowAttach(false)}
          onSent={() => { /* el mensaje aparece por realtime de useWhatsAppChat */ }}
        />
      )}

      {/* Assignment modal */}
      {showAssign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowAssign(false)}>
          <div style={{ background: '#1a1c2e', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 24, width: 320, maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Asignar asesor</span>
              <button onClick={() => setShowAssign(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{clientName || clientPhone}</p>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320 }}>
              {(staffList || []).map(staff => {
                const isAssigned = (assignments || []).some(a => a.client_phone === clientPhone && a.assigned_to === staff.id)
                return (
                  <button
                    key={staff.id}
                    onClick={async () => { await onAssign?.(clientPhone, staff.id); setShowAssign(false) }}
                    style={{
                      padding: '10px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                      background: isAssigned ? 'rgba(0,208,132,0.10)' : 'rgba(255,255,255,0.03)',
                      color: isAssigned ? C.green : C.text,
                      border: `1px solid ${isAssigned ? 'rgba(0,208,132,0.3)' : C.border}`,
                      fontWeight: isAssigned ? 700 : 400,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <span>{staff.display_name}</span>
                    <span style={{ fontSize: 10, color: C.muted, textTransform: 'capitalize' }}>{staff.role}</span>
                  </button>
                )
              })}
              {!(staffList || []).length && (
                <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', margin: '12px 0' }}>Sin asesores disponibles</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
