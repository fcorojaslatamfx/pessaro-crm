// ─── Página pública · Sala de documentos de una reunión ──────────────────────
// Ruta: /documento/<public_token>
//
// El enlace por sí solo no muestra ningún archivo: pide el correo, y sólo si
// está en la lista de invitados llega un código de 6 dígitos. Todo el control
// vive en la edge function documento_acceso; aquí no hay ninguna decisión de
// seguridad, sólo la pantalla.
import { useState, useEffect, useCallback } from 'react'

const C = {
  bg: '#0d0f17', surface: '#13151f',
  card: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border: 'rgba(255,255,255,0.08)', text: '#f1f2f6', textSub: '#a4b0be', muted: '#636e72',
  purple: '#6c5ce7', purpleDim: 'rgba(108,92,231,0.15)',
  green: '#00d084', greenDim: 'rgba(0,208,132,0.12)',
  red: '#ff4757', redDim: 'rgba(255,71,87,0.12)',
  orange: '#ffa502',
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/documento_acceso`

const fmtSize = n => !n ? '' : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
const fmtFecha = v => v ? new Date(v).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : ''
const iconoDe = mime =>
  (mime || '').includes('pdf') ? '📕'
    : (mime || '').startsWith('image/') ? '🖼'
      : (mime || '').includes('sheet') || (mime || '').includes('excel') || (mime || '').includes('csv') ? '📊'
        : (mime || '').includes('presentation') || (mime || '').includes('powerpoint') ? '📽'
          : (mime || '').includes('zip') ? '🗜' : '📄'

async function llamar(payload) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación')
  return data
}

function Campo({ value, onChange, placeholder, type = 'text', onEnter, autoFocus, mono }) {
  return (
    <input
      type={type} value={value} autoFocus={autoFocus} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }}
      style={{
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10,
        padding: '12px 14px', color: C.text, fontSize: mono ? 22 : 14, outline: 'none', width: '100%',
        fontFamily: mono ? 'monospace' : 'inherit', boxSizing: 'border-box',
        letterSpacing: mono ? '0.35em' : 'normal', textAlign: mono ? 'center' : 'left',
      }}
    />
  )
}

function Boton({ children, onClick, disabled, variant = 'primary' }) {
  const fondo = variant === 'primary' ? C.purple : 'rgba(255,255,255,0.05)'
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        background: disabled ? 'rgba(255,255,255,0.06)' : fondo,
        color: disabled ? C.muted : variant === 'primary' ? '#fff' : C.textSub,
        border: variant === 'primary' ? 'none' : `1px solid ${C.border}`,
        borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', width: '100%',
      }}>
      {children}
    </button>
  )
}

export default function DocumentoSala() {
  const token = window.location.pathname.split('/').filter(Boolean)[1] || ''

  const [cargando, setCargando] = useState(true)
  const [sala, setSala] = useState(null)
  const [fatal, setFatal] = useState('')          // sala inexistente o caducada
  const [paso, setPaso] = useState('email')       // email | code | archivos
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(null)        // {tipo,texto}
  const [sesion, setSesion] = useState('')
  const [archivos, setArchivos] = useState([])
  const [bajando, setBajando] = useState(null)
  const [ultimoId, setUltimoId] = useState(null)  // ID de la última descarga

  const cargarSala = useCallback(async () => {
    setCargando(true)
    try {
      const d = await llamar({ action: 'sala', token })
      setSala(d)
    } catch (e) { setFatal(e.message) }
    finally { setCargando(false) }
  }, [token])

  useEffect(() => { if (token) cargarSala(); else { setFatal('Enlace incompleto.'); setCargando(false) } }, [token, cargarSala])

  async function pedirCodigo() {
    if (!email.includes('@')) { setAviso({ tipo: 'err', texto: 'Indica un correo válido.' }); return }
    setOcupado(true); setAviso(null)
    try {
      const d = await llamar({ action: 'request', token, email })
      setPaso('code')
      setAviso({ tipo: 'ok', texto: d.message })
    } catch (e) { setAviso({ tipo: 'err', texto: e.message }) }
    finally { setOcupado(false) }
  }

  async function verificar() {
    if (code.trim().length !== 6) { setAviso({ tipo: 'err', texto: 'El código tiene 6 dígitos.' }); return }
    setOcupado(true); setAviso(null)
    try {
      const d = await llamar({ action: 'verify', token, email, code: code.trim() })
      setSesion(d.session_token)
      setArchivos(d.archivos || [])
      setPaso('archivos')
      setAviso(null)
    } catch (e) { setAviso({ tipo: 'err', texto: e.message }) }
    finally { setOcupado(false) }
  }

  // La respuesta es el archivo en binario, no una URL: no hay nada que reenviar
  async function descargar(a) {
    setBajando(a.id); setAviso(null)
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', session_token: sesion, archivo_id: a.id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo descargar')
      }
      const blob = await res.blob()
      const idDescarga = res.headers.get('X-Download-Code')
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = a.original_name; link.click()
      window.URL.revokeObjectURL(url)
      if (idDescarga) setUltimoId(idDescarga)
    } catch (e) { setAviso({ tipo: 'err', texto: e.message }) }
    finally { setBajando(null) }
  }

  const marco = hijos => (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ width: 'min(520px,100%)' }}>{hijos}</div>
    </div>
  )

  if (cargando) return marco(<p style={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>Cargando…</p>)

  if (fatal) return marco(
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
      <p style={{ fontSize: 34, margin: '0 0 12px' }}>🔒</p>
      <h1 style={{ fontSize: 17, color: C.text, margin: '0 0 8px' }}>Este enlace ya no está disponible</h1>
      <p style={{ fontSize: 13, color: C.textSub, margin: 0, lineHeight: 1.6 }}>{fatal}</p>
      <p style={{ fontSize: 12, color: C.muted, margin: '16px 0 0' }}>Si crees que es un error, responde al correo de la invitación.</p>
    </div>
  )

  return marco(
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.purple, fontWeight: 700, margin: '0 0 10px' }}>Pessaro Capital</p>
      <h1 style={{ fontSize: 20, color: C.text, margin: '0 0 6px', lineHeight: 1.3 }}>{sala?.titulo}</h1>
      {sala?.descripcion && <p style={{ fontSize: 13, color: C.textSub, margin: '0 0 6px', lineHeight: 1.6 }}>{sala.descripcion}</p>}
      <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 22px' }}>
        {sala?.archivos} documento{sala?.archivos !== 1 ? 's' : ''} · disponible hasta el {fmtFecha(sala?.expires_at)}
      </p>

      {paso === 'email' && (
        <>
          <p style={{ fontSize: 13, color: C.textSub, margin: '0 0 12px', lineHeight: 1.6 }}>
            Escribe el correo con el que te invitaron. Te enviaremos un código de un solo uso.
          </p>
          <div style={{ marginBottom: 12 }}>
            <Campo value={email} onChange={setEmail} placeholder="tu@correo.com" type="email" onEnter={pedirCodigo} autoFocus />
          </div>
          <Boton onClick={pedirCodigo} disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviarme el código'}</Boton>
        </>
      )}

      {paso === 'code' && (
        <>
          <p style={{ fontSize: 13, color: C.textSub, margin: '0 0 12px', lineHeight: 1.6 }}>
            Introduce el código de 6 dígitos que enviamos a <strong style={{ color: C.text }}>{email}</strong>.
          </p>
          <div style={{ marginBottom: 12 }}>
            <Campo value={code} onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="000000" onEnter={verificar} autoFocus mono />
          </div>
          <Boton onClick={verificar} disabled={ocupado}>{ocupado ? 'Verificando…' : 'Ver los documentos'}</Boton>
          <div style={{ marginTop: 10 }}>
            <Boton variant="ghost" onClick={() => { setPaso('email'); setCode(''); setAviso(null) }} disabled={ocupado}>← Usar otro correo</Boton>
          </div>
        </>
      )}

      {paso === 'archivos' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 12px', background: C.greenDim, border: `1px solid ${C.green}30`, borderRadius: 10 }}>
            <span style={{ fontSize: 12, color: C.green }}>✓ Verificado como {email}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archivos.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>{iconoDe(a.mime_type)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.original_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>{fmtSize(a.file_size)}</p>
                </div>
                <button onClick={() => descargar(a)} disabled={bajando === a.id}
                  style={{ background: bajando === a.id ? 'rgba(255,255,255,0.06)' : C.purpleDim, color: bajando === a.id ? C.muted : C.purple, border: `1px solid rgba(108,92,231,0.35)`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: bajando === a.id ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {bajando === a.id ? 'Preparando…' : '⬇ Descargar'}
                </button>
              </div>
            ))}
            {archivos.length === 0 && <p style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', margin: 0 }}>Todavía no hay documentos en esta sala.</p>}
          </div>
          {ultimoId && (
            <p style={{ fontSize: 11, color: C.muted, margin: '14px 0 0', lineHeight: 1.6 }}>
              Tu copia lleva marcado tu correo y el identificador <strong style={{ color: C.orange, fontFamily: 'monospace' }}>{ultimoId}</strong>. Es de uso personal: no la reenvíes.
            </p>
          )}
        </>
      )}

      {aviso && (
        <p style={{ fontSize: 12, margin: '14px 0 0', lineHeight: 1.6, color: aviso.tipo === 'ok' ? C.green : C.red }}>{aviso.texto}</p>
      )}
    </div>
  )
}
