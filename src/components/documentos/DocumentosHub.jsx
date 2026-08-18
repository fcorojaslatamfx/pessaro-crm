// ─── DOCUMENTOS · Salas para invitados a reunión ─────────────────────────────
// Tablas: crm_doc_salas / _archivos / _invitados / _accesos · Bucket privado
// crm-documentos. El acceso del invitado lo resuelve la edge function
// documento_acceso; aquí sólo se arma la sala y se mira quién descargó.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'

const C = {
  surface: '#13151f',
  card: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border: 'rgba(255,255,255,0.07)', text: '#f1f2f6', textSub: '#a4b0be', muted: '#636e72',
  purple: '#6c5ce7', purpleLight: '#a29bfe', purpleDim: 'rgba(108,92,231,0.15)',
  green: '#00d084', greenDim: 'rgba(0,208,132,0.12)',
  blue: '#0984e3', blueDim: 'rgba(9,132,227,0.15)',
  orange: '#ffa502', red: '#ff4757', redDim: 'rgba(255,71,87,0.12)',
}

const BUCKET = 'crm-documentos'
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/documento_acceso`
const MAX_SIZE = 25 * 1024 * 1024

const fmtSize = n => !n ? '—' : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
const fmtDia = v => v ? new Date(v).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtHora = v => v ? new Date(v).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
// La sala vence a medianoche del día N; se compara contra ahora
const vencida = s => new Date(s.expires_at) < new Date()

function Lbl({ children }) {
  return <label style={{ fontSize: 10.5, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{children}</label>
}

function Input({ value, onChange, placeholder, type = 'text', style = {} }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box', ...style }} />
}

function Sel({ value, onChange, options, style = {} }) {
  return <select value={value} onChange={e => onChange(e.target.value)}
    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit', ...style }}>
    {options.map(o => <option key={o.value} value={o.value} style={{ background: C.surface }}>{o.label}</option>)}
  </select>
}

function Btn({ children, onClick, disabled, variant = 'primary', style = {} }) {
  const base = variant === 'primary'
    ? { background: C.purple, color: '#fff', border: 'none' }
    : { background: 'rgba(255,255,255,0.04)', color: C.textSub, border: `1px solid ${C.border}` }
  return <button onClick={onClick} disabled={disabled}
    style={{ ...base, borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1, ...style }}>
    {children}
  </button>
}

function Card({ children, style = {} }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, ...style }}>{children}</div>
}

export default function DocumentosHub({ user, isSuperAdmin }) {
  const [salas, setSalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [abierta, setAbierta] = useState(null)     // id de la sala en detalle
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', meeting_at: '', dias: '7', watermark: true })
  const [err, setErr] = useState('')

  // Detalle
  const [archivos, setArchivos] = useState([])
  const [invitados, setInvitados] = useState([])
  const [accesos, setAccesos] = useState([])
  const [grupos, setGrupos] = useState([])
  const [grupoSel, setGrupoSel] = useState('')
  const [correosPegados, setCorreosPegados] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState(null)             // {tipo,texto}
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [confirmBorrar, setConfirmBorrar] = useState(null)

  const sala = salas.find(s => s.id === abierta) || null

  const cargarSalas = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('crm_doc_salas')
        .select('*, crm_doc_archivos(id), crm_doc_invitados(id), crm_doc_accesos(id)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSalas(data || [])
    } catch (e) { console.error('salas:', e); setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargarSalas() }, [cargarSalas])

  useEffect(() => {
    supabase.from('crm_contact_groups').select('id,name').order('name')
      .then(({ data }) => setGrupos(data || []))
  }, [])

  const cargarDetalle = useCallback(async salaId => {
    const [a, i, ac] = await Promise.all([
      supabase.from('crm_doc_archivos').select('*').eq('sala_id', salaId).order('created_at'),
      supabase.from('crm_doc_invitados').select('*').eq('sala_id', salaId).order('email'),
      supabase.from('crm_doc_accesos').select('*, crm_doc_archivos(original_name)').eq('sala_id', salaId).order('created_at', { ascending: false }).limit(300),
    ])
    setArchivos(a.data || []); setInvitados(i.data || []); setAccesos(ac.data || [])
  }, [])

  useEffect(() => { if (abierta) cargarDetalle(abierta) }, [abierta, cargarDetalle])

  async function crearSala() {
    const titulo = form.titulo.trim()
    if (!titulo) { setErr('Ponle un título a la sala.'); return }
    const dias = Number(form.dias) || 7
    setErr('')
    try {
      const { data, error } = await supabase.from('crm_doc_salas').insert({
        titulo,
        descripcion: form.descripcion.trim() || null,
        meeting_at: form.meeting_at ? new Date(form.meeting_at).toISOString() : null,
        expires_at: new Date(Date.now() + dias * 86400000).toISOString(),
        watermark: form.watermark,
        created_by: user.id,
      }).select().single()
      if (error) throw error
      setForm({ titulo: '', descripcion: '', meeting_at: '', dias: '7', watermark: true })
      setCreando(false)
      await cargarSalas()
      setAbierta(data.id)
    } catch (e) { setErr(e.message) }
  }

  async function borrarSala(s) {
    try {
      // Los archivos del bucket no se van con el ON DELETE CASCADE de la tabla
      const { data: fs } = await supabase.from('crm_doc_archivos').select('file_path').eq('sala_id', s.id)
      if (fs?.length) await supabase.storage.from(BUCKET).remove(fs.map(f => f.file_path))
      const { error } = await supabase.from('crm_doc_salas').delete().eq('id', s.id)
      if (error) throw error
      setAbierta(null); setConfirmBorrar(null)
      await cargarSalas()
    } catch (e) { setMsg({ tipo: 'err', texto: e.message }) }
  }

  async function subirArchivo(file) {
    if (!file || !sala) return
    if (file.size > MAX_SIZE) { setMsg({ tipo: 'err', texto: `El archivo supera los 25 MB (${fmtSize(file.size)}).` }); return }
    setSubiendo(true); setMsg(null)
    try {
      const ext = file.name.split('.').pop()
      const safe = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const path = `${sala.id}/${safe}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { error } = await supabase.from('crm_doc_archivos').insert({
        sala_id: sala.id, file_path: path, original_name: file.name,
        mime_type: file.type, file_size: file.size, uploaded_by: user.id,
      })
      if (error) throw error
      await cargarDetalle(sala.id); await cargarSalas()
      setMsg({ tipo: 'ok', texto: `«${file.name}» subido.` })
    } catch (e) { setMsg({ tipo: 'err', texto: e.message || 'No se pudo subir' }) }
    finally { setSubiendo(false) }
  }

  async function borrarArchivo(a) {
    try {
      await supabase.storage.from(BUCKET).remove([a.file_path])
      const { error } = await supabase.from('crm_doc_archivos').delete().eq('id', a.id)
      if (error) throw error
      await cargarDetalle(sala.id); await cargarSalas()
    } catch (e) { setMsg({ tipo: 'err', texto: e.message }) }
  }

  // Invitados desde un grupo de contactos: los que no tienen email quedan fuera
  // y se dice cuántos, porque si no el conteo no cuadra y parece un fallo.
  async function invitarGrupo() {
    if (!grupoSel || !sala) return
    setMsg(null)
    try {
      const { data, error } = await supabase.from('crm_contact_group_members')
        .select('crm_contacts(id, full_name, email)').eq('group_id', grupoSel)
      if (error) throw error
      const cs = (data || []).map(r => r.crm_contacts).filter(Boolean)
      const conEmail = cs.filter(c => (c.email || '').includes('@'))
      const sinEmail = cs.length - conEmail.length
      if (!conEmail.length) { setMsg({ tipo: 'err', texto: 'Ningún contacto de ese grupo tiene correo.' }); return }
      const filas = conEmail.map(c => ({
        sala_id: sala.id, email: c.email.trim().toLowerCase(),
        full_name: c.full_name || null, contact_id: c.id,
      }))
      // onConflict: reinvitar un grupo que se solapa con otro no debe fallar
      const { error: insErr } = await supabase.from('crm_doc_invitados')
        .upsert(filas, { onConflict: 'sala_id,email', ignoreDuplicates: true })
      if (insErr) throw insErr
      await cargarDetalle(sala.id); await cargarSalas()
      setGrupoSel('')
      setMsg({ tipo: 'ok', texto: `${conEmail.length} invitado(s) añadidos${sinEmail ? ` · ${sinEmail} sin correo quedaron fuera` : ''}.` })
    } catch (e) { setMsg({ tipo: 'err', texto: e.message }) }
  }

  async function invitarPegados() {
    const correos = [...new Set(correosPegados.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(s => s.includes('@')))]
    if (!correos.length) { setMsg({ tipo: 'err', texto: 'No encontré correos válidos en ese texto.' }); return }
    try {
      const { error } = await supabase.from('crm_doc_invitados')
        .upsert(correos.map(email => ({ sala_id: sala.id, email })), { onConflict: 'sala_id,email', ignoreDuplicates: true })
      if (error) throw error
      setCorreosPegados('')
      await cargarDetalle(sala.id); await cargarSalas()
      setMsg({ tipo: 'ok', texto: `${correos.length} correo(s) añadidos.` })
    } catch (e) { setMsg({ tipo: 'err', texto: e.message }) }
  }

  async function quitarInvitado(inv) {
    try {
      const { error } = await supabase.from('crm_doc_invitados').delete().eq('id', inv.id)
      if (error) throw error
      await cargarDetalle(sala.id); await cargarSalas()
    } catch (e) { setMsg({ tipo: 'err', texto: e.message }) }
  }

  async function enviarInvitaciones(reenviar = false) {
    setEnviando(true); setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'send_invites', sala_id: sala.id, reenviar }),
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r.error || 'No se pudo enviar')
      await cargarDetalle(sala.id)
      setMsg({ tipo: r.enviados ? 'ok' : 'err', texto: r.message || `${r.enviados} invitación(es) enviadas${r.fallidos ? ` · ${r.fallidos} fallaron` : ''}.` })
    } catch (e) { setMsg({ tipo: 'err', texto: e.message }) }
    finally { setEnviando(false) }
  }

  async function copiarEnlace() {
    const url = `${window.location.origin}/documento/${sala.public_token}`
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800) }
    catch { setMsg({ tipo: 'err', texto: 'El navegador bloqueó el portapapeles.' }) }
  }

  // ── Detalle de una sala ───────────────────────────────────────────────────
  if (sala) {
    const enlace = `${window.location.origin}/documento/${sala.public_token}`
    const pendientes = invitados.filter(i => !i.invite_sent_at).length
    const puedeEditar = sala.created_by === user.id || isSuperAdmin

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={() => { setAbierta(null); setMsg(null) }} style={{ fontSize: 12, padding: '7px 12px' }}>← Salas</Btn>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: 19, color: C.text, fontWeight: 700 }}>{sala.titulo}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: vencida(sala) ? C.red : C.muted }}>
              {vencida(sala) ? `Venció el ${fmtDia(sala.expires_at)}` : `Disponible hasta el ${fmtDia(sala.expires_at)}`}
              {sala.meeting_at ? ` · reunión ${fmtDia(sala.meeting_at)}` : ''}
              {sala.watermark ? ' · con marca de agua' : ' · sin marca de agua'}
            </p>
          </div>
        </div>

        {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: msg.tipo === 'ok' ? C.greenDim : C.redDim, border: `1px solid ${msg.tipo === 'ok' ? C.green : C.red}30` }}>
          <p style={{ margin: 0, fontSize: 12.5, color: msg.tipo === 'ok' ? C.green : C.red }}>{msg.texto}</p>
        </div>}

        <Card style={{ marginBottom: 16 }}>
          <Lbl>Enlace para los invitados</Lbl>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ flex: 1, minWidth: 240, fontSize: 12, color: C.textSub, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', wordBreak: 'break-all' }}>{enlace}</code>
            <Btn variant="ghost" onClick={copiarEnlace} style={{ fontSize: 12 }}>{copiado ? '✓ Copiado' : '📋 Copiar'}</Btn>
          </div>
          <p style={{ fontSize: 11.5, color: C.muted, margin: '8px 0 0', lineHeight: 1.6 }}>
            El enlace es el mismo para todos y por sí solo no abre nada: cada invitado tiene que verificar su correo con un código.
          </p>
        </Card>

        {/* Archivos */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Documentos ({archivos.length})</h3>
            {puedeEditar && <label style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: C.purple, background: C.purpleDim, border: '1px solid rgba(108,92,231,0.35)', borderRadius: 8, padding: '7px 14px', cursor: subiendo ? 'wait' : 'pointer' }}>
              {subiendo ? 'Subiendo…' : '+ Subir documento'}
              <input type="file" style={{ display: 'none' }} disabled={subiendo}
                onChange={e => { subirArchivo(e.target.files[0]); e.target.value = '' }} />
            </label>}
          </div>
          {archivos.length === 0
            ? <p style={{ fontSize: 12.5, color: C.muted, fontStyle: 'italic', margin: 0 }}>Todavía no hay documentos. Súbelos antes de mandar las invitaciones.</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {archivos.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.original_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                      {fmtSize(a.file_size)}
                      {sala.watermark && (a.mime_type || '').includes('pdf') ? ' · se estampa al descargar' : ''}
                    </p>
                  </div>
                  {puedeEditar && <button onClick={() => borrarArchivo(a)} title="Quitar de la sala"
                    style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>🗑</button>}
                </div>
              ))}
            </div>}
        </Card>

        {/* Invitados */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Invitados ({invitados.length})</h3>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn onClick={() => enviarInvitaciones(false)} disabled={enviando || !pendientes || !archivos.length} style={{ fontSize: 12 }}>
                {enviando ? 'Enviando…' : `✉ Enviar a los ${pendientes} pendientes`}
              </Btn>
              <Btn variant="ghost" onClick={() => enviarInvitaciones(true)} disabled={enviando || !invitados.length} style={{ fontSize: 12 }}>Reenviar a todos</Btn>
            </div>
          </div>

          {!archivos.length && invitados.length > 0 && (
            <p style={{ fontSize: 11.5, color: C.orange, margin: '0 0 12px' }}>⚠ Sube al menos un documento antes de avisar a los invitados.</p>
          )}

          {puedeEditar && <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Lbl>Añadir desde un grupo de contactos</Lbl>
              <Sel value={grupoSel} onChange={setGrupoSel}
                options={[{ value: '', label: 'Elige un grupo…' }, ...grupos.map(g => ({ value: g.id, label: g.name }))]} />
            </div>
            <Btn variant="ghost" onClick={invitarGrupo} disabled={!grupoSel} style={{ fontSize: 12 }}>+ Añadir grupo</Btn>
          </div>}

          {puedeEditar && <div style={{ marginBottom: 14 }}>
            <Lbl>O pegar correos sueltos</Lbl>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Input value={correosPegados} onChange={setCorreosPegados} placeholder="ana@empresa.cl, luis@otra.com" />
              </div>
              <Btn variant="ghost" onClick={invitarPegados} disabled={!correosPegados.trim()} style={{ fontSize: 12 }}>+ Añadir</Btn>
            </div>
          </div>}

          {invitados.length === 0
            ? <p style={{ fontSize: 12.5, color: C.muted, fontStyle: 'italic', margin: 0 }}>Sin invitados. Nadie puede abrir la sala todavía.</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {invitados.map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: C.text, fontWeight: 600 }}>{i.full_name || i.email}</p>
                    {i.full_name && <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{i.email}</p>}
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 5, whiteSpace: 'nowrap',
                    background: i.first_access_at ? C.greenDim : i.invite_sent_at ? C.blueDim : 'rgba(255,255,255,0.05)',
                    color: i.first_access_at ? C.green : i.invite_sent_at ? C.blue : C.muted }}>
                    {i.first_access_at ? 'Entró' : i.invite_sent_at ? 'Avisado' : 'Sin avisar'}
                  </span>
                  {puedeEditar && <button onClick={() => quitarInvitado(i)} title="Quitar de la lista"
                    style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>✕</button>}
                </div>
              ))}
            </div>}
        </Card>

        {/* Bitácora */}
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Descargas ({accesos.length})</h3>
          {accesos.length === 0
            ? <p style={{ fontSize: 12.5, color: C.muted, fontStyle: 'italic', margin: 0 }}>Nadie ha descargado todavía.</p>
            : <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Cuándo', 'Quién', 'Documento', 'ID de descarga'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {accesos.map(a => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px 10px', color: C.textSub, whiteSpace: 'nowrap' }}>{fmtHora(a.created_at)}</td>
                      <td style={{ padding: '8px 10px', color: C.text, fontFamily: 'monospace', fontSize: 11 }}>{a.email}</td>
                      <td style={{ padding: '8px 10px', color: C.textSub }}>{a.crm_doc_archivos?.original_name || '—'}</td>
                      <td style={{ padding: '8px 10px', color: C.orange, fontFamily: 'monospace', fontSize: 11 }}>{a.download_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </Card>

        {puedeEditar && (
          <Btn variant="ghost" onClick={() => confirmBorrar === sala.id ? borrarSala(sala) : setConfirmBorrar(sala.id)}
            style={{ fontSize: 12, color: confirmBorrar === sala.id ? C.red : C.muted }}>
            {confirmBorrar === sala.id ? '¿Seguro? Se borran los archivos y el historial' : '🗑 Eliminar la sala'}
          </Btn>
        )}
      </div>
    )
  }

  // ── Listado de salas ──────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: C.text, fontWeight: 700 }}>Salas de documentos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.muted }}>
            Reparte material a los invitados de una reunión. Sólo abren los correos de la lista, y cada copia va marcada.
          </p>
        </div>
        <Btn onClick={() => setCreando(v => !v)}>{creando ? 'Cancelar' : '+ Nueva sala'}</Btn>
      </div>

      {err && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: C.redDim }}><p style={{ margin: 0, fontSize: 12.5, color: C.red }}>{err}</p></div>}

      {creando && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Lbl>Título de la reunión</Lbl>
              <Input value={form.titulo} onChange={v => setForm(f => ({ ...f, titulo: v }))} placeholder="ej: Comité de inversiones · agosto" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Lbl>Descripción (opcional)</Lbl>
              <Input value={form.descripcion} onChange={v => setForm(f => ({ ...f, descripcion: v }))} placeholder="Qué van a encontrar aquí" />
            </div>
            <div>
              <Lbl>Fecha de la reunión (opcional)</Lbl>
              <Input type="date" value={form.meeting_at} onChange={v => setForm(f => ({ ...f, meeting_at: v }))} />
            </div>
            <div>
              <Lbl>El acceso dura</Lbl>
              <Sel value={form.dias} onChange={v => setForm(f => ({ ...f, dias: v }))}
                options={[{ value: '3', label: '3 días' }, { value: '7', label: '7 días' }, { value: '15', label: '15 días' }, { value: '30', label: '30 días' }]} />
            </div>
          </div>
          <button onClick={() => setForm(f => ({ ...f, watermark: !f.watermark }))}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <span style={{ fontSize: 14, color: form.watermark ? C.green : C.muted }}>{form.watermark ? '☑' : '☐'}</span>
            <span style={{ fontSize: 12.5, color: C.textSub }}>Estampar cada PDF con el correo de quien lo descarga y un ID único</span>
          </button>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setCreando(false)}>Cancelar</Btn>
            <Btn onClick={crearSala}>Crear sala</Btn>
          </div>
        </Card>
      )}

      {loading
        ? <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p>
        : salas.length === 0
          ? <Card><p style={{ margin: 0, fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Todavía no hay salas. Crea la primera con «+ Nueva sala».</p></Card>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {salas.map(s => {
              const exp = vencida(s)
              return (
                <div key={s.id} onClick={() => { setAbierta(s.id); setMsg(null) }}
                  style={{ background: C.card, border: `1px solid ${exp ? 'rgba(255,71,87,0.25)' : C.border}`, borderRadius: 14, padding: 18, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14.5, color: C.text, fontWeight: 700, flex: 1 }}>{s.titulo}</h3>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap',
                      background: exp ? C.redDim : C.greenDim, color: exp ? C.red : C.green }}>
                      {exp ? 'Vencida' : 'Activa'}
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 11.5, color: C.muted }}>
                    {exp ? `Venció el ${fmtDia(s.expires_at)}` : `Hasta el ${fmtDia(s.expires_at)}`}
                  </p>
                  <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
                    {[['📄', s.crm_doc_archivos?.length || 0, 'docs'],
                      ['👤', s.crm_doc_invitados?.length || 0, 'invitados'],
                      ['⬇', s.crm_doc_accesos?.length || 0, 'descargas']].map(([ic, n, l]) => (
                      <div key={l}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{ic} {n}</p>
                        <p style={{ margin: 0, fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>}
    </div>
  )
}
