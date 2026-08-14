// ─── VENTAS · UI y constantes compartidas ────────────────────────────────────
// Helpers autocontenidos para el módulo de ventas (patrón components/webcontent/
// y components/whatsapp/). La paleta es la misma de App.jsx, copiada a propósito:
// App.jsx es un monolito de ~5.800 líneas y extraerle los primitivos sería un
// diff enorme por un componente nuevo.

export const P = {
  bg:'#0d0f17', surface:'#13151f',
  card:'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border:'rgba(255,255,255,0.07)', text:'#f1f2f6', textSub:'#a4b0be', muted:'#636e72',
  purple:'#6c5ce7', purpleLight:'#a29bfe', purpleDim:'rgba(108,92,231,0.15)', purpleBorder:'rgba(108,92,231,0.3)',
  blue:'#0984e3', blueDim:'rgba(9,132,227,0.15)',
  green:'#00d084', greenDim:'rgba(0,208,132,0.12)',
  red:'#ff4757', redDim:'rgba(255,71,87,0.12)',
  orange:'#ffa502', orangeDim:'rgba(255,165,2,0.10)',
}

// ── Etapas de venta ─────────────────────────────────────────────────────────
// El orden es el del embudo y lo usan el selector de la ficha, el desglose de
// SalesMetrics y los filtros de Contactos. Las probabilidades son las mismas
// que pondera sales_kpis() en SQL: si cambian aquí, hay que cambiarlas allá.
export const SALES_STAGES = [
  { id:'PROSPECTO',         label:'Prospecto',          color:P.muted,  prob:0.10 },
  { id:'CONTACTADO',        label:'Contactado',         color:P.blue,   prob:0.20 },
  { id:'REUNION_AGENDADA',  label:'Reunión agendada',   color:'#00b8d4',prob:0.40 },
  { id:'PROPUESTA_ENVIADA', label:'Propuesta enviada',  color:P.orange, prob:0.60 },
  { id:'EN_NEGOCIACION',    label:'En negociación',     color:P.purple, prob:0.80 },
  { id:'CERRADO_GANADO',    label:'Cerrado ganado',     color:P.green,  prob:1    },
  { id:'CERRADO_PERDIDO',   label:'Cerrado perdido',    color:P.red,    prob:0    },
]
export const STAGE_LABEL = Object.fromEntries(SALES_STAGES.map(s => [s.id, s.label]))
export const STAGE_COLOR = Object.fromEntries(SALES_STAGES.map(s => [s.id, s.color]))
export const esCerrada   = id => String(id || '').startsWith('CERRADO')

export const TIPO_LABEL = { P2P:'Persona', B2B:'Empresa' }
export const TIPO_COLOR = { P2P:P.purple, B2B:P.blue }

// Tipos de actividad comercial que ofrece la ficha. Son un subconjunto de los
// que admite el CHECK de contact_activity_log: el resto los escribe el sistema
// (registro, estado_cambiado, asignacion...) y no tiene sentido ofrecerlos.
export const ACTIVIDADES = [
  { id:'llamada',       label:'Llamada',  icon:'📞' },
  { id:'reunion',       label:'Reunión',  icon:'🤝' },
  { id:'email_enviado', label:'Email',    icon:'📧' },
  { id:'whatsapp_chat', label:'WhatsApp', icon:'💬' },
]

// ── Formato ─────────────────────────────────────────────────────────────────
export const fmtUSD = n => new Intl.NumberFormat('es-CL',
  { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(Number(n) || 0)
export const fmtPct = n => `${(Number(n) || 0).toFixed(1).replace(/\.0$/, '')} %`

/**
 * Normaliza un RUT a 12345678-9. Devuelve '' si no queda nada aprovechable.
 * No se fuerza en la base: company_tax_id admite identificadores extranjeros,
 * así que esto es ayuda de captura, no una regla del modelo.
 */
export function normalizaRut(v) {
  const limpio = String(v || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (limpio.length < 2) return limpio
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`
}

/** Validación por módulo 11. Se usa como aviso en la ficha, nunca como bloqueo. */
export function rutValido(v) {
  const s = String(v || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (s.length < 7 || s.length > 9) return false
  const cuerpo = s.slice(0, -1), dv = s.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  let suma = 0, mult = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const resto = 11 - (suma % 11)
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === esperado
}

// ── Primitivos ──────────────────────────────────────────────────────────────
export function GlassCard({ children, style = {}, accent, ...rest }) {
  return <div style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:14, padding:18,
    ...(accent ? { borderLeft:`3px solid ${accent}` } : {}), ...style }} {...rest}>{children}</div>
}

export function StatCard({ label, value, sub, accent = P.purple, icon }) {
  return (
    <GlassCard style={{ padding:'16px 18px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-24, right:-24, width:88, height:88,
        background:`radial-gradient(circle,${accent}22,transparent 70%)`, borderRadius:'50%' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <p style={{ fontSize:10, fontWeight:600, color:P.muted, textTransform:'uppercase',
          letterSpacing:'0.10em', margin:0 }}>{label}</p>
        {icon && <span style={{ fontSize:14, opacity:0.8 }}>{icon}</span>}
      </div>
      <p style={{ fontSize:22, fontWeight:800, color:accent, margin:'0 0 3px', letterSpacing:'-0.01em' }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:P.muted, margin:0 }}>{sub}</p>}
    </GlassCard>
  )
}

export function Badge({ label, color }) {
  return <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em',
    color, background:`${color}1f`, borderRadius:5, padding:'2px 8px', whiteSpace:'nowrap' }}>{label}</span>
}

export function Lbl({ children }) {
  return <label style={{ display:'block', fontSize:11, fontWeight:600, color:P.muted,
    textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>{children}</label>
}

export function Input({ value, onChange, style = {}, ...rest }) {
  return <input value={value ?? ''} onChange={e => onChange(e.target.value)}
    style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${P.border}`, borderRadius:8,
      padding:'9px 12px', color:P.text, fontSize:13, outline:'none', width:'100%',
      fontFamily:'inherit', boxSizing:'border-box', ...style }} {...rest}/>
}

export function Sel({ value, onChange, options, style = {}, ...rest }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}
      style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${P.border}`, borderRadius:8,
        padding:'9px 12px', color:P.text, fontSize:13, outline:'none', width:'100%',
        fontFamily:'inherit', boxSizing:'border-box', cursor:'pointer', ...style }} {...rest}>
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background:P.surface }}>{o.label}</option>
      ))}
    </select>
  )
}

export function Btn({ children, variant = 'primary', style = {}, disabled, ...rest }) {
  const base = { padding:'8px 16px', borderRadius:9, fontSize:13, fontWeight:600,
    cursor:disabled ? 'not-allowed' : 'pointer', fontFamily:'inherit',
    opacity:disabled ? 0.5 : 1, border:'1px solid transparent' }
  const kinds = {
    primary:{ background:P.purple, color:'#fff' },
    ghost:{ background:'rgba(255,255,255,0.05)', color:P.textSub, border:`1px solid ${P.border}` },
    danger:{ background:P.redDim, color:P.red, border:'1px solid rgba(255,71,87,0.3)' },
  }
  return <button disabled={disabled} style={{ ...base, ...kinds[variant], ...style }} {...rest}>{children}</button>
}

export function Spinner() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
    <div style={{ width:24, height:24, border:`3px solid ${P.border}`, borderTop:`3px solid ${P.purple}`,
      borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
  </div>
}
