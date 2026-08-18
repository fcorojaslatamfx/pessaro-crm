import { useState, useEffect, useCallback, Component, useRef } from 'react'
import { supabase } from './lib/supabase.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import WhatsAppInbox from './components/whatsapp/WhatsAppInbox.jsx'
import ChatWindow from './components/whatsapp/ChatWindow.jsx'
import CampaignSender from './components/whatsapp/CampaignSender.jsx'
import StartChatModal from './components/whatsapp/StartChatModal.jsx'
import WAFinanceChat from './pages/WAFinanceChat.jsx'
import WAFinanceChatInbox from './components/whatsapp/WAFinanceChatInbox.jsx'
import WAFinanceInviteButton from './components/whatsapp/WAFinanceInviteButton.jsx'
import SupportPortal from './pages/SupportPortal.jsx'
import SupportTicketView from './pages/SupportTicketView.jsx'
import DocumentoSala from './pages/DocumentoSala.jsx'
import DocumentosHub from './components/documentos/DocumentosHub.jsx'
import SupportInbox from './components/support/SupportInbox.jsx'
import WebContentHub from './components/webcontent/WebContentHub.jsx'
import ContactsHub from './components/clients/ClientsPortalKYC.jsx'
import EducationAdmin from './components/education/EducationAdmin.jsx'
import SalesMetrics from './components/sales/SalesMetrics.jsx'
import { SALES_STAGES, STAGE_LABEL as SALES_STAGE_LABEL, STAGE_COLOR as SALES_STAGE_COLOR,
  TIPO_LABEL, TIPO_COLOR, ACTIVIDADES, normalizaRut, rutValido } from './components/sales/ui.jsx'

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(p){super(p);this.state={err:null}}
  static getDerivedStateFromError(e){return{err:e}}
  componentDidCatch(e,info){console.error('ErrorBoundary caught:',e,info)}
  render(){
    if(this.state.err)return(
      <div style={{padding:32,textAlign:'center',color:'#ff4757'}}>
        <p style={{fontSize:16,fontWeight:700,marginBottom:8}}>⚠ Error al renderizar este módulo</p>
        <p style={{fontSize:12,color:'#636e72',marginBottom:16}}>{this.state.err.message}</p>
        <button onClick={()=>this.setState({err:null})} style={{padding:'8px 20px',borderRadius:8,background:'rgba(255,71,87,0.15)',border:'1px solid rgba(255,71,87,0.3)',color:'#ff4757',cursor:'pointer',fontSize:13}}>Reintentar</button>
      </div>
    )
    return this.props.children
  }
}

// ─── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
function useWindowSize(){
  const[w,setW]=useState(typeof window!=='undefined'?window.innerWidth:1280)
  useEffect(()=>{
    const h=()=>setW(window.innerWidth)
    window.addEventListener('resize',h)
    return()=>window.removeEventListener('resize',h)
  },[])
  return w
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const P = {
  bg:'#0d0f17', surface:'#13151f', sidebar:'#0a0c16',
  card:'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border:'rgba(255,255,255,0.07)', text:'#f1f2f6', textSub:'#a4b0be', muted:'#636e72',
  purple:'#6c5ce7', purpleLight:'#a29bfe', purpleDim:'rgba(108,92,231,0.15)', purpleBorder:'rgba(108,92,231,0.3)',
  blue:'#0984e3', blueDim:'rgba(9,132,227,0.15)',
  green:'#00d084', greenDim:'rgba(0,208,132,0.12)',
  red:'#ff4757', redDim:'rgba(255,71,87,0.12)',
  orange:'#ffa502', orangeDim:'rgba(255,165,2,0.10)',
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STAGES      = ['lead','contactado','propuesta','negociacion','cerrado']
const STAGE_LABEL = { lead:'Lead', contactado:'Contactado', propuesta:'Propuesta', negociacion:'Negociación', cerrado:'Cerrado' }
const STAGE_COLOR = { lead:P.muted, contactado:P.blue, propuesta:P.orange, negociacion:P.purple, cerrado:P.green }
const ETAPA_STAGE = { 1:'lead', 2:'contactado', 3:'propuesta', 4:'negociacion', 5:'cerrado' }
const STAGE_ETAPA = { lead:1, contactado:2, propuesta:3, negociacion:4, cerrado:5 }
const STATUS_COLOR = { new:P.orange, read:P.blue, replied:P.green, archived:P.muted }
const STATUS_OPT   = [{value:'activo',label:'Activo'},{value:'prospecto',label:'Prospecto'},{value:'cliente',label:'Cliente'},{value:'inactivo',label:'Inactivo'}]
const SCOLOR_MAP   = { activo:P.green, prospecto:P.orange, cliente:P.purple, inactivo:P.muted }
const PRIO_COLOR   = { alta:P.red, media:P.orange, baja:P.green }
const ACTIVITY_ICONS = {
  registro:'📋', email_enviado:'📧', whatsapp_chat:'💬',
  wafinance_invitacion:'💹', nota_agregada:'📝', estado_cambiado:'🔄',
  tarea_creada:'📌', tarea_completada:'✅', llamada:'📞',
  asignacion:'👤', otro:'📎',
}
const GROUP_COLORS = ['#6c5ce7','#00d084','#ffa502','#2563eb','#e84393','#00b8d4','#f0a500','#636e72']

// Une las fuentes del CRM en una sola línea de tiempo, lo más nuevo primero.
// La usan tanto la ficha en pantalla como los export a HTML/PDF, para que el
// documento descargado sea exactamente lo que el asesor vio.
function buildTimeline(notes,activities,ficha){
  const ev=[]
  const push=(ts,icon,tipo,titulo,detalle,color)=>{if(ts)ev.push({ts,icon,tipo,titulo:titulo||'',detalle:detalle||'',color})}
  for(const n of notes||[])push(n.created_at,'📝','Nota',n.content,'',P.purple)
  for(const a of activities||[])push(a.created_at,ACTIVITY_ICONS[a.activity_type]||'📎','Actividad',a.description,a.metadata?.source?`Fuente: ${a.metadata.source}`:'',P.orange)
  const f=ficha||{}
  for(const m of f.wa||[]){
    const txt=m.content?.text||m.content?.caption||m.template_name||m.message_type
    push(m.created_at,m.direction==='inbound'?'📥':'📤','WhatsApp',
      `${m.direction==='inbound'?'Recibido':'Enviado'}: ${String(txt||'').slice(0,140)}`,
      m.template_name?`Plantilla ${m.template_name}${m.status?` · ${m.status}`:''}`:(m.status||''),P.green)
  }
  if(f.lead)push(f.lead.created_at,'🎯','Lead de campaña',`Registrado como lead${f.lead.etapa?` · etapa ${f.lead.etapa}`:''}`,
    [f.lead.investment_range&&`Capital: ${f.lead.investment_range}`,f.lead.variant&&`Variante: ${f.lead.variant}`,f.lead.perfil&&`Perfil: ${f.lead.perfil}`].filter(Boolean).join(' · '),P.blue)
  for(const s of f.subs||[])push(s.submitted_at||s.created_at,'🌐','Formulario web',s.form_type||s.management_type||'Formulario enviado',s.comments||'',P.orange)
  for(const t of f.tickets||[])push(t.created_at,'🎫','Soporte',`Ticket ${t.ticket_number||''} · ${t.subject||''}`,[t.status,t.category].filter(Boolean).join(' · '),'#00b8d4')
  for(const t of f.tasks||[])push(t.created_at,t.done?'✅':'📌','Tarea',t.title,[t.priority&&`prioridad ${t.priority}`,t.due_date&&`vence ${String(t.due_date).slice(0,10)}`].filter(Boolean).join(' · '),P.red)
  if(f.cliente)push(f.cliente.created_at,'👤','Cuenta de cliente',`Cuenta creada${f.cliente.account_status?` · ${f.cliente.account_status}`:''}`,
    [f.cliente.account_type,f.cliente.risk_tolerance&&`riesgo ${f.cliente.risk_tolerance}`].filter(Boolean).join(' · '),P.purple)
  return ev.sort((a,b)=>new Date(b.ts)-new Date(a.ts))
}
async function logActivity(userId, contactId, activityType, description, metadata={}) {
  if(!contactId||String(contactId).startsWith('sub_'))return
  try{await supabase.from('contact_activity_log').insert({contact_id:contactId,user_id:userId,activity_type:activityType,description,metadata})}
  catch(e){console.warn('[logActivity]',e)}
}
const LOGO_URI     = "data:image/webp;base64,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RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5mYXZpY29uLTI1NiAtIEljb25vIFBlc3Nhcm8gQ2FwaXRhbCA8L3JkZjpsaT4KICAgPC9yZGY6QWx0PgogIDwvZGM6dGl0bGU+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgPHBkZjpBdXRob3I+RnJhbmNpc2NvIFJvamFzPC9wZGY6QXV0aG9yPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczp4bXA9J2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8nPgogIDx4bXA6Q3JlYXRvclRvb2w+Q2FudmEgZG9jPURBSEJDSFZaZ0xVIHVzZXI9VUFDZHdIZFdBRjAgYnJhbmQ9VmVydGljMyB0ZW1wbGF0ZT1CbHVlIE1vZGVybiBQcm9mZXNzaW9uYWwgTGV0dGVyIEsgTG9nbzwveG1wOkNyZWF0b3JUb29sPgogPC9yZGY6RGVzY3JpcHRpb24+CjwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cjw/eHBhY2tldCBlbmQ9J3InPz4A"

const TEMPLATES=[
  {id:'bienvenida_lead',     label:'Bienvenida lead',       color:P.purple, desc:'Primer contacto tras registro'},
  {id:'seguimiento_lead',    label:'Seguimiento',           color:P.blue,   desc:'Follow-up personalizable'},
  {id:'invitacion_radex',    label:'Invitación Radex',      color:'#e74c3c',desc:'Apertura cuenta Radex'},
  {id:'invitacion_tradeview',label:'Invitación Tradeview',  color:'#3498db',desc:'Apertura cuenta Tradeview'},
  {id:'deposito_confirmado', label:'Depósito confirmado',   color:P.green,  desc:'Confirmación con acceso al portal'},
  {id:'informe_trimestral',  label:'Informe trimestral',    color:'#f0a500',desc:'Resultados Q1 2026 con métricas'},
  {id:'accesos_crm',         label:'Accesos CRM',           color:'#2563eb',desc:'Entrega de credenciales provisionales al equipo'},
  {id:'personalizado',       label:'Personalizado',         color:P.muted,  desc:'Asunto y cuerpo libres'},
]

const fmt    = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0)
// Una fecha suelta ('2026-08-14') la parsea JS como medianoche UTC, y al
// pintarla en hora de Chile (UTC-4) retrocede al día anterior: el análisis del
// día salía rotulado con el de ayer mientras el portal lo fechaba bien. Las
// columnas 'date' (fecha del análisis, birth_date, movement_date, due_date) son
// días de calendario, no instantes, así que se arman en horario local. Las
// marcas timestamptz siguen convirtiéndose como siempre.
const fmtDate= d => {
  if(!d)return '—'
  const soloDia=typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)
  const dt=soloDia?new Date(`${d}T00:00:00`):new Date(d)
  return dt.toLocaleDateString('es-CL')
}
const uid    = () => Math.random().toString(36).slice(2,9)
// Formato único de móvil en todo el CRM: sólo dígitos, sin '+' ni espacios.
// Es el formato que espera Meta y el que usan las claves de WhatsApp
// (whatsapp_messages/assignments/opt_outs), así que evita que el mismo número
// quede duplicado según de dónde venga (manual, CSV, landing, webhook).
const soloDigitos = v => String(v ?? '').replace(/\D/g, '')

// Rangos rápidos sobre created_at. El corte es la medianoche LOCAL (Chile), no
// la UTC: pasadas las 21:00 de Chile ya es el día siguiente en UTC, y "hoy"
// habría dejado fuera justo los contactos recién cargados. Es el mismo error
// que costó las campañas programadas.
const RANGOS_FECHA = [
  {value:'todos', label:'Cualquier fecha'},
  {value:'hoy',   label:'Creados hoy'},
  {value:'7d',    label:'Últimos 7 días'},
  {value:'30d',   label:'Últimos 30 días'},
]
const desdeRango = rango => {
  if(!rango||rango==='todos')return null
  const d=new Date(); d.setHours(0,0,0,0)
  if(rango==='7d') d.setDate(d.getDate()-6)
  if(rango==='30d')d.setDate(d.getDate()-29)
  return d
}
// Nombre del grupo del día: estable, para que pulsarlo dos veces no cree otro
const nombreGrupoDia = (d=new Date()) => {
  const p=n=>String(n).padStart(2,'0')
  return `Ingresos ${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()}`
}

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
function Badge({label,color}){
  return <span style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',background:color+'20',color,border:`1px solid ${color}35`}}>{label}</span>
}
function GlassCard({children,style={},accent}){
  return <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:14,padding:20,position:'relative',overflow:'hidden',...style}}>
    {accent&&<div style={{position:'absolute',top:-30,right:-30,width:100,height:100,background:`radial-gradient(circle,${accent}25,transparent 70%)`,borderRadius:'50%',pointerEvents:'none'}}/>}
    {children}
  </div>
}
function StatCard({label,value,sub,Icon,accent=P.purple}){
  return <GlassCard accent={accent} style={{flex:1,minWidth:150}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',margin:0}}>{label}</p>
      <div style={{width:28,height:28,borderRadius:8,background:accent+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>{Icon}</div>
    </div>
    <div style={{display:'inline-flex',background:accent+'18',border:`1px solid ${accent}35`,borderRadius:8,padding:'5px 12px',marginBottom:sub?6:0}}>
      <span style={{fontSize:16,fontWeight:700,color:accent,fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
    </div>
    {sub&&<p style={{fontSize:11,color:P.muted,marginTop:4,margin:'4px 0 0'}}>{sub}</p>}
  </GlassCard>
}
// ...rest deja pasar onBlur, min, step y demás al input real. Sin esto, la
// ficha comercial no podría guardar al salir del campo: el handler se perdía.
function Input({value,onChange,placeholder,type='text',style={},...rest}){
  const[showPwd,setShowPwd]=useState(false)
  const isPwd=type==='password'
  if(!isPwd){
    return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',boxSizing:'border-box',...style}} {...rest}/>
  }
  return <div style={{position:'relative',width:'100%'}}>
    <input type={showPwd?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 40px 9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',boxSizing:'border-box',...style}}/>
    <button type="button" onClick={()=>setShowPwd(v=>!v)} tabIndex={-1}
      aria-label={showPwd?'Ocultar contraseña':'Mostrar contraseña'}
      style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:6,display:'flex',alignItems:'center',justifyContent:'center',color:P.muted,opacity:0.75}}
      onMouseEnter={e=>e.currentTarget.style.opacity=1}
      onMouseLeave={e=>e.currentTarget.style.opacity=0.75}>
      {showPwd
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  </div>
}
function Sel({value,onChange,options,style={}}){
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',...style}}>
    {options.map(o=><option key={o.value} value={o.value} style={{background:P.surface}}>{o.label}</option>)}
  </select>
}
function Btn({children,onClick,variant='primary',style={},disabled=false}){
  const vs={
    primary:{background:`linear-gradient(135deg,#7c6fee,${P.purple})`,color:'#fff',border:'none',fontWeight:600,boxShadow:`0 4px 14px ${P.purple}40`},
    ghost:{background:'rgba(255,255,255,0.04)',color:P.textSub,border:`1px solid ${P.border}`,fontWeight:500},
    blue:{background:`linear-gradient(135deg,#1a9bff,${P.blue})`,color:'#fff',border:'none',fontWeight:600},
    danger:{background:P.redDim,color:P.red,border:`1px solid ${P.red}35`,fontWeight:500},
    green:{background:P.greenDim,color:P.green,border:`1px solid ${P.green}35`,fontWeight:600},
  }
  return <button onClick={onClick} disabled={disabled}
    style={{padding:'9px 16px',borderRadius:8,fontSize:13,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,display:'inline-flex',alignItems:'center',gap:6,...vs[variant],...style}}>{children}</button>
}
function Modal({title,onClose,children,accent=P.purple}){
  const mW=useWindowSize()<768
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1001,padding:mW?10:20}}>
    <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,width:'100%',maxWidth:mW?'95vw':540,maxHeight:'90vh',overflow:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.6)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:accent}}/><h3 style={{margin:0,fontSize:16,fontWeight:700,color:P.text}}>{title}</h3></div>
        <button onClick={onClose} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:20}}>✕</button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>
}
function Lbl({children}){return <label style={{fontSize:11,color:P.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>{children}</label>}
function Spinner(){return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60}}><div style={{width:28,height:28,border:`3px solid ${P.border}`,borderTop:`3px solid ${P.purple}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>}
function SHdr({title,sub,action}){
  const isMob=useWindowSize()<768
  return <div style={{display:'flex',flexDirection:isMob?'column':'row',justifyContent:'space-between',alignItems:isMob?'stretch':'flex-start',gap:isMob?14:12,marginBottom:24}}>
    <div style={{minWidth:0}}>
      <h2 style={{fontSize:isMob?17:20,fontWeight:700,color:P.text,marginBottom:4,margin:'0 0 4px',wordBreak:'break-word'}}>{title}</h2>
      {sub&&<p style={{fontSize:13,color:P.muted,margin:0,wordBreak:'break-word'}}>{sub}</p>}
    </div>
    {action&&<div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>{action}</div>}
  </div>
}
const TT={contentStyle:{background:P.surface,border:`1px solid ${P.border}`,borderRadius:8,color:P.text,fontSize:12}}

// ─── FICHA DEL CLIENTE: piezas de la vista en pantalla completa ───────────────
// Bloque con título; agrupa una sección de la ficha (registro, cuenta, tareas…)
function FSection({title,icon,accent=P.purple,right,children}){
  return <section style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:14,padding:'18px 20px',marginBottom:16}}>
    <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14,flexWrap:'wrap'}}>
      <span style={{fontSize:14,lineHeight:1}}>{icon}</span>
      <h3 style={{margin:0,fontSize:11,fontWeight:800,color:accent,textTransform:'uppercase',letterSpacing:'0.11em'}}>{title}</h3>
      {right&&<div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>{right}</div>}
    </div>
    {children}
  </section>
}
// Rejilla fluida: en móvil cae a una columna sola sin media queries
function FGrid({children,min=210}){
  return <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fit,minmax(${min}px,1fr))`,gap:14}}>{children}</div>
}
// Campo etiqueta/valor. Lo no registrado se ve distinto para que salte a la vista
function FField({label,value,mono,color}){
  const vacio=value===null||value===undefined||value===''||value==='—'
  return <div style={{minWidth:0}}>
    <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 4px'}}>{label}</p>
    <p style={{fontSize:13,color:vacio?P.muted:(color||P.text),margin:0,fontFamily:mono?'monospace':'inherit',fontStyle:vacio?'italic':'normal',wordBreak:'break-word',lineHeight:1.45}}>{vacio?'Sin registrar':value}</p>
  </div>
}
// Barra de progreso 0-100 usada por el bloque de educación
function FBar({pct,color=P.green}){
  return <div style={{height:7,borderRadius:99,background:'rgba(255,255,255,0.07)',overflow:'hidden'}}>
    <div style={{height:'100%',width:`${Math.max(0,Math.min(100,pct||0))}%`,background:color,borderRadius:99,transition:'width 0.3s'}}/>
  </div>
}
const edad=d=>{
  if(!d)return null
  const b=new Date(d); if(isNaN(b))return null
  const h=new Date(); let a=h.getFullYear()-b.getFullYear()
  const m=h.getMonth()-b.getMonth()
  if(m<0||(m===0&&h.getDate()<b.getDate()))a--
  return a>=0&&a<130?a:null
}
const fmtUSD=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n)||0)

// ─── WA TOAST ─────────────────────────────────────────────────────────────────
// ─── BANNER DE PERMISO DE NOTIFICACIONES ──────────────────────────────────
// Aparece flotante arriba cuando Notification.permission === 'default'
// Permite al usuario activarlas con un click visible (no esperar a que clickee algo random)
function NotifPermBanner({onGranted}){
  const[show,setShow]=useState(false)
  const[busy,setBusy]=useState(false)
  const[dismissed,setDismissed]=useState(false)

  useEffect(()=>{
    if(typeof Notification==='undefined')return
    // Solo mostrar si nunca se preguntó y no fue rechazado
    if(Notification.permission==='default'){
      // Esperar 2s tras login para no abrumar al usuario en el primer instante
      const t=setTimeout(()=>{
        if(!sessionStorage.getItem('notif_banner_dismissed'))setShow(true)
      },2000)
      return()=>clearTimeout(t)
    }
  },[])

  const handleActivate=async()=>{
    setBusy(true)
    try{
      const result=await Notification.requestPermission()
      if(result==='granted'){
        setShow(false)
        if(onGranted)onGranted()
      }else{
        // denied o default → ocultar banner, no insistir más en esta sesión
        sessionStorage.setItem('notif_banner_dismissed','1')
        setShow(false)
      }
    }catch(e){
      console.error('[notif-banner] error:',e)
    }finally{
      setBusy(false)
    }
  }

  const handleDismiss=()=>{
    sessionStorage.setItem('notif_banner_dismissed','1')
    setShow(false)
    setDismissed(true)
  }

  if(!show||dismissed)return null

  return(
    <div style={{
      position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',
      maxWidth:520,width:'calc(100% - 40px)',
      background:'linear-gradient(135deg, rgba(124,92,255,0.95), rgba(96,72,200,0.95))',
      borderRadius:14,padding:'14px 18px',
      boxShadow:'0 8px 28px rgba(124,92,255,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
      zIndex:99999,
      display:'flex',alignItems:'center',gap:14,
      animation:'slideDown 0.4s ease-out',
      backdropFilter:'blur(12px)',
    }}>
      <div style={{fontSize:24,flexShrink:0}}>🔔</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:2}}>
          Activa las notificaciones del CRM
        </div>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.85)',lineHeight:1.4}}>
          Recibe alertas de WhatsApp incluso con la app cerrada
        </div>
      </div>
      <button onClick={handleActivate} disabled={busy} style={{
        background:'rgba(255,255,255,0.95)',color:'#5a3fd6',
        border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,
        fontWeight:700,cursor:busy?'wait':'pointer',whiteSpace:'nowrap',
        flexShrink:0,
      }}>
        {busy?'…':'Activar'}
      </button>
      <button onClick={handleDismiss} disabled={busy} style={{
        background:'transparent',color:'rgba(255,255,255,0.7)',
        border:'none',cursor:'pointer',padding:4,fontSize:18,lineHeight:1,
        flexShrink:0,
      }} title="Recordar más tarde">×</button>
    </div>
  )
}

function WaToast({toast,onClose,onView}){
  return <div style={{background:'#1a1c2e',border:'1px solid rgba(0,208,132,0.3)',borderRadius:12,padding:'14px 16px',width:300,boxShadow:'0 8px 32px rgba(0,0,0,0.6)',display:'flex',flexDirection:'column',gap:10}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div style={{display:'flex',alignItems:'center',gap:7}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:P.green,flexShrink:0}}/>
        <span style={{fontSize:11,fontWeight:700,color:P.green,textTransform:'uppercase',letterSpacing:'0.08em'}}>Nuevo WhatsApp</span>
      </div>
      <button onClick={onClose} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:16,lineHeight:1,padding:0}}>✕</button>
    </div>
    <div>
      <div style={{fontSize:14,fontWeight:700,color:P.text,marginBottom:2}}>{toast.name}</div>
      <div style={{fontSize:11,color:P.muted,fontFamily:"'JetBrains Mono',monospace"}}>{toast.phone}</div>
    </div>
    {toast.preview&&<div style={{fontSize:12,color:P.textSub,background:'rgba(255,255,255,0.04)',borderRadius:6,padding:'7px 10px',fontStyle:'italic',lineHeight:1.5}}>"{toast.preview.length>60?toast.preview.slice(0,60)+'…':toast.preview}"</div>}
    <button onClick={onView} style={{padding:'8px 12px',borderRadius:8,fontSize:12,fontWeight:600,background:P.greenDim,color:P.green,border:`1px solid ${P.green}40`,cursor:'pointer',textAlign:'center'}}>Ver conversación →</button>
  </div>
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({onLogin}){
  const BACKGROUND_IMAGE='https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200'
  const LOGO_URL='https://pessaro.cl/images/logo-256.webp'

  const windowSize=useWindowSize()
  const isMobile=windowSize<768
  const isTablet=windowSize>=768&&windowSize<1024
  const isDesktop=windowSize>=1024

  const[email,setEmail]=useState('')
  const[pass,setPass]=useState('')
  const[showPass,setShowPass]=useState(false)
  const[error,setError]=useState('')
  const[loading,setLoading]=useState(false)
  const[view,setView]=useState('login')
  const[recoveryEmail,setRecoveryEmail]=useState('')
  const[recoveryError,setRecoveryError]=useState('')
  const[recoveryLoading,setRecoveryLoading]=useState(false)
  const[showSplash,setShowSplash]=useState(()=>typeof window!=='undefined'?window.innerWidth<1024:false)

  useEffect(()=>{
    if(isDesktop){
      setShowSplash(false)
    } else if(isMobile){
      const timer=setTimeout(()=>setShowSplash(false),3500)
      return()=>clearTimeout(timer)
    } else if(isTablet){
      const timer=setTimeout(()=>setShowSplash(false),2500)
      return()=>clearTimeout(timer)
    }
  },[isMobile,isTablet,isDesktop])

  const handle=async()=>{
    if(!email||!pass)return
    setLoading(true);setError('')
    const{data,error:err}=await supabase.auth.signInWithPassword({email,password:pass})
    setLoading(false)
    if(err){setError(err.message);return}
    onLogin(data.user)
  }

  const handleRecovery=async()=>{
    if(!recoveryEmail)return
    setRecoveryLoading(true);setRecoveryError('')
    try{
      const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL
      const ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY
      const res=await fetch(`${SUPABASE_URL}/functions/v1/password_recovery_2026_06_18`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${ANON_KEY}`,
        },
        body:JSON.stringify({email:recoveryEmail.trim().toLowerCase()})
      })
      const data=await res.json().catch(()=>({}))
      setRecoveryLoading(false)
      if(!res.ok||!data?.success){
        setRecoveryError(data?.error||'No se pudo enviar el correo. Intenta nuevamente.')
        return
      }
      setView('recovery_sent')
    }catch(e){
      setRecoveryLoading(false)
      setRecoveryError('Error de red. Verifica tu conexión.')
      console.error('[recovery] error:',e)
    }
  }

  const cssAnim=`
    @keyframes scaleIn{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes slideDown{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes fadeInUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
    @keyframes float{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,20px)}}
    @keyframes pulse{0%,100%{box-shadow:0 8px 32px rgba(124,92,255,0.4)}50%{box-shadow:0 8px 32px rgba(124,92,255,0.7)}}
  `

  const inputStyle={
    backgroundColor:'#f5f5f7',color:'#0a0a0f',border:'none',borderRadius:8,
    padding:'12px 14px',fontSize:'0.9375rem',width:'100%',boxSizing:'border-box',
    outline:'none',fontFamily:'inherit',transition:'all 0.2s ease',
  }
  const onFocusIn=e=>{e.target.style.backgroundColor='#ffffff';e.target.style.boxShadow='0 0 0 2px rgba(124,92,255,0.4)'}
  const onFocusOut=e=>{e.target.style.backgroundColor='#f5f5f7';e.target.style.boxShadow='none'}

  const recovHeader=(
    <div style={{textAlign:'center',marginBottom:36}}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
        <img src={LOGO_URL} width={52} height={52} style={{borderRadius:10,display:'block'}} alt="Pessaro"/>
      </div>
      <h1 style={{fontSize:22,fontWeight:800,color:P.text,margin:'0 0 4px'}}>Pessaro Capital</h1>
      <p style={{color:'#7c5cff',fontWeight:700,fontSize:13,letterSpacing:'2px',textTransform:'uppercase',margin:'0 0 6px'}}>CRM INTERNO</p>
      <p style={{color:P.muted,fontSize:13,margin:0}}>Acceso exclusivo para el equipo</p>
    </div>
  )

  if(showSplash&&!isDesktop){
    return(
      <div style={{minHeight:'100vh',backgroundImage:`url(${BACKGROUND_IMAGE})`,backgroundSize:'cover',backgroundPosition:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
        <style>{cssAnim}</style>
        {/* Overlay azul translúcido sobre la imagen */}
        <div style={{position:'absolute',top:0,right:0,bottom:0,left:0,background:'linear-gradient(135deg,rgba(10,15,50,0.85) 0%,rgba(30,58,138,0.65) 50%,rgba(10,15,50,0.85) 100%)',zIndex:0}}/>
        <div style={{position:'absolute',top:'10%',left:'10%',width:300,height:300,background:'radial-gradient(circle,rgba(124,92,255,0.25),transparent 70%)',borderRadius:'50%',animation:'float 6s ease-in-out infinite',pointerEvents:'none',zIndex:1}}/>
        <div style={{position:'absolute',bottom:'10%',right:'10%',width:250,height:250,background:'radial-gradient(circle,rgba(96,165,250,0.18),transparent 70%)',borderRadius:'50%',animation:'float 8s ease-in-out infinite reverse',pointerEvents:'none',zIndex:1}}/>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20,zIndex:2,textAlign:'center',padding:'0 32px'}}>
          <div style={{width:80,height:80,borderRadius:16,overflow:'hidden',animation:'scaleIn 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards, pulse 2s ease-in-out 1s infinite'}}>
            <img src={LOGO_URL} alt="Pessaro Capital" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
          </div>
          <div>
            <h1 style={{fontSize:28,fontWeight:800,color:'#ffffff',letterSpacing:'-1px',margin:'0 0 4px',animation:'slideDown 0.8s ease-out 0.2s both'}}>Pessaro Capital</h1>
            <p style={{fontSize:13,fontWeight:700,color:'#7c5cff',letterSpacing:'2px',textTransform:'uppercase',margin:'0 0 12px',animation:'slideDown 0.8s ease-out 0.3s both'}}>CRM INTERNO</p>
            <p style={{fontSize:14,color:'rgba(255,255,255,0.7)',margin:0,animation:'slideDown 0.8s ease-out 0.4s both'}}>Gestión Inteligente de Inversiones</p>
          </div>
          <div style={{display:'flex',gap:8,animation:'fadeIn 0.8s ease-out 0.6s both'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#7c5cff',animation:'bounce 1s ease-in-out infinite'}}/>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#7c5cff',animation:'bounce 1s ease-in-out 0.2s infinite'}}/>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#7c5cff',animation:'bounce 1s ease-in-out 0.4s infinite'}}/>
          </div>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.5)',animation:'fadeIn 0.8s ease-out 0.6s both',margin:0}}>Cargando panel de control...</p>
        </div>
      </div>
    )
  }

  if(view==='recovery_sent'){
    return(
      <div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{width:'100%',maxWidth:380}}>
          {recovHeader}
          <GlassCard accent={P.purple}>
            <div style={{display:'flex',flexDirection:'column',gap:16,textAlign:'center'}}>
              <div style={{fontSize:32}}>📧</div>
              <p style={{fontSize:14,color:P.text,lineHeight:1.6,margin:0}}>Si tu email está registrado, recibirás un enlace de recuperación en tu correo.</p>
              <button onClick={()=>{setView('login');setRecoveryEmail('');setRecoveryError('')}} style={{background:'none',border:'none',color:'#7c5cff',cursor:'pointer',fontSize:13,fontWeight:600,textDecoration:'underline',padding:0}}>← Volver al login</button>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  if(view==='recovery'){
    return(
      <div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{width:'100%',maxWidth:380}}>
          {recovHeader}
          <GlassCard accent={P.purple}>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <p style={{fontSize:13,color:P.muted,margin:0}}>Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
              <div><Lbl>Email</Lbl><Input value={recoveryEmail} onChange={setRecoveryEmail} placeholder="tu@pessaro.cl" type="email"/></div>
              {recoveryError&&<div style={{fontSize:12,color:P.red,background:P.redDim,padding:'10px 12px',borderRadius:8,border:`1px solid ${P.red}30`}}>{recoveryError}</div>}
              <Btn onClick={handleRecovery} disabled={recoveryLoading} style={{width:'100%',justifyContent:'center',padding:11}}>{recoveryLoading?'Enviando...':'Enviar enlace de recuperación'}</Btn>
              <button onClick={()=>{setView('login');setRecoveryError('')}} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:13,textDecoration:'underline',padding:0,textAlign:'center'}}>← Volver al login</button>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  if(isDesktop){
    return(
      <div style={{minHeight:'100vh',display:'flex'}}>
        <style>{cssAnim}</style>
        <div style={{width:'55%',position:'relative',display:'flex',alignItems:'center',justifyContent:'center',backgroundImage:`url(${BACKGROUND_IMAGE})`,backgroundSize:'cover',backgroundPosition:'center'}}>
          <div style={{position:'absolute',top:0,right:0,bottom:0,left:0,background:'linear-gradient(135deg,rgba(10,15,50,0.75) 0%,rgba(30,58,138,0.55) 50%,rgba(10,15,50,0.75) 100%)'}}/>
          <div style={{position:'relative',zIndex:1,textAlign:'center',padding:'0 48px'}}>
            <h1 style={{fontSize:'3.5rem',fontWeight:800,color:'#ffffff',textShadow:'0 4px 12px rgba(0,0,0,0.5)',margin:'0 0 8px',lineHeight:1.1,letterSpacing:'-1px'}}>Pessaro Capital</h1>
            <p style={{fontSize:'1rem',fontWeight:700,color:'#7c5cff',letterSpacing:'3px',textTransform:'uppercase',margin:'0 0 24px',textShadow:'0 2px 8px rgba(0,0,0,0.4)'}}>CRM INTERNO</p>
            <p style={{fontSize:'1.25rem',color:'rgba(255,255,255,0.9)',textShadow:'0 2px 8px rgba(0,0,0,0.4)',margin:'0 0 16px'}}>Gestión Inteligente de Inversiones</p>
            <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.6)',letterSpacing:'0.5px',margin:0,textShadow:'0 2px 6px rgba(0,0,0,0.4)'}}>Acceso exclusivo para el equipo</p>
          </div>
        </div>
        <div style={{width:'45%',backgroundColor:'#0a0a0f',display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 32px',animation:'fadeIn 0.5s ease-in-out'}}>
          <div style={{width:'100%',maxWidth:360}}>
            <div style={{textAlign:'center',marginBottom:28}}>
              <img src={LOGO_URL} height={64} style={{display:'block',margin:'0 auto',borderRadius:12,marginBottom:24}} alt="Pessaro Capital"/>
              <h2 style={{fontSize:'1.5rem',fontWeight:700,color:'#ffffff',margin:'0 0 4px'}}>Pessaro Capital</h2>
              <p style={{fontSize:'0.75rem',fontWeight:700,color:'#7c5cff',letterSpacing:'2.5px',textTransform:'uppercase',margin:'0 0 8px'}}>CRM INTERNO</p>
              <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.6)',margin:'0 0 28px'}}>Acceso exclusivo para el equipo</p>
            </div>
            <div style={{backgroundColor:'#1a1a24',borderRadius:12,padding:24,border:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div>
                  <label style={{display:'block',fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6,letterSpacing:'1.5px',textTransform:'uppercase'}}>EMAIL</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@pessaro.cl" onFocus={onFocusIn} onBlur={onFocusOut} style={{...inputStyle}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6,letterSpacing:'1.5px',textTransform:'uppercase'}}>CONTRASEÑA</label>
                  <div style={{position:'relative'}}>
                    <input type={showPass?'text':'password'} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onFocus={onFocusIn} onBlur={onFocusOut} onKeyDown={e=>e.key==='Enter'&&handle()} style={{...inputStyle,paddingRight:44}}/>
                    <button type="button" onClick={()=>setShowPass(v=>!v)} tabIndex={-1} aria-label={showPass?'Ocultar contraseña':'Mostrar contraseña'}
                      style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:6,display:'flex',alignItems:'center',color:'#6b6b75'}}>
                      {showPass
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>
                {error&&<div style={{padding:'10px 12px',backgroundColor:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,color:'#fca5a5',fontSize:'0.8125rem',textAlign:'center'}}>{error}</div>}
                <button onClick={handle} disabled={loading} onMouseEnter={e=>{if(!loading)e.currentTarget.style.backgroundColor='#6b4ce0'}} onMouseLeave={e=>{if(!loading)e.currentTarget.style.backgroundColor='#7c5cff'}} style={{width:'100%',padding:'12px 16px',borderRadius:8,fontSize:'0.9375rem',fontWeight:600,backgroundColor:loading?'rgba(124,92,255,0.5)':'#7c5cff',color:'#ffffff',border:'none',cursor:loading?'not-allowed':'pointer',transition:'all 0.2s ease',marginTop:4}}>{loading?'Iniciando...':'Entrar al CRM'}</button>
                <button onClick={()=>{setView('recovery');setError('')}} style={{background:'none',border:'none',color:'#7c5cff',cursor:'pointer',fontSize:'0.8125rem',padding:0,textAlign:'center',textDecoration:'underline',fontFamily:'inherit',marginTop:14}}>¿Olvidaste tu contraseña?</button>
              </div>
            </div>
            <p style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',textAlign:'center',marginTop:24}}>Usa tu cuenta de Pessaro Capital</p>
          </div>
        </div>
      </div>
    )
  }

  if(isTablet){
    return(
      <div style={{minHeight:'100vh',display:'flex',animation:'fadeIn 0.5s ease-in-out'}}>
        <style>{cssAnim}</style>
        <div style={{width:'50%',position:'relative',display:'flex',alignItems:'center',justifyContent:'center',backgroundImage:`url(${BACKGROUND_IMAGE})`,backgroundSize:'cover',backgroundPosition:'center'}}>
          <div style={{position:'absolute',top:0,right:0,bottom:0,left:0,background:'linear-gradient(135deg,rgba(10,15,50,0.75) 0%,rgba(30,58,138,0.55) 50%,rgba(10,15,50,0.75) 100%)'}}/>
          <div style={{position:'relative',zIndex:1,textAlign:'center',padding:'0 32px'}}>
            <h1 style={{fontSize:'2.5rem',fontWeight:800,color:'#ffffff',textShadow:'0 4px 12px rgba(0,0,0,0.5)',margin:'0 0 8px',lineHeight:1.1,letterSpacing:'-1px'}}>Pessaro Capital</h1>
            <p style={{fontSize:'0.875rem',fontWeight:700,color:'#7c5cff',letterSpacing:'3px',textTransform:'uppercase',margin:'0 0 12px',textShadow:'0 2px 8px rgba(0,0,0,0.4)'}}>CRM INTERNO</p>
            <p style={{fontSize:'1rem',color:'rgba(255,255,255,0.9)',textShadow:'0 2px 8px rgba(0,0,0,0.4)',margin:'0 0 10px'}}>Gestión Inteligente de Inversiones</p>
            <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.7)',letterSpacing:'0.5px',margin:0}}>Acceso exclusivo para el equipo</p>
          </div>
        </div>
        <div style={{width:'50%',backgroundColor:'#0a0a0f',display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 24px'}}>
          <div style={{width:'100%',maxWidth:320}}>
            <div style={{textAlign:'center',marginBottom:24}}>
              <img src={LOGO_URL} height={56} style={{display:'block',margin:'0 auto',borderRadius:12,marginBottom:20}} alt="Pessaro Capital"/>
              <h2 style={{fontSize:'1.5rem',fontWeight:700,color:'#ffffff',margin:'0 0 4px'}}>Pessaro Capital</h2>
              <p style={{fontSize:'0.75rem',fontWeight:700,color:'#7c5cff',letterSpacing:'2.5px',textTransform:'uppercase',margin:'0 0 8px'}}>CRM INTERNO</p>
              <p style={{fontSize:'0.875rem',color:'rgba(255,255,255,0.6)',margin:'0 0 20px'}}>Acceso exclusivo para el equipo</p>
            </div>
            <div style={{backgroundColor:'#1a1a24',borderRadius:12,padding:24,border:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <label style={{display:'block',fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6,letterSpacing:'1.5px',textTransform:'uppercase'}}>EMAIL</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@pessaro.cl" onFocus={onFocusIn} onBlur={onFocusOut} style={{...inputStyle,padding:'11px 14px',fontSize:'0.875rem'}}/>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6,letterSpacing:'1.5px',textTransform:'uppercase'}}>CONTRASEÑA</label>
                  <div style={{position:'relative'}}>
                    <input type={showPass?'text':'password'} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onFocus={onFocusIn} onBlur={onFocusOut} onKeyDown={e=>e.key==='Enter'&&handle()} style={{...inputStyle,padding:'11px 44px 11px 14px',fontSize:'0.875rem'}}/>
                    <button type="button" onClick={()=>setShowPass(v=>!v)} tabIndex={-1} aria-label={showPass?'Ocultar contraseña':'Mostrar contraseña'}
                      style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:6,display:'flex',alignItems:'center',color:'#6b6b75'}}>
                      {showPass
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>
                {error&&<div style={{padding:'10px 12px',backgroundColor:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,color:'#fca5a5',fontSize:'0.8125rem',textAlign:'center'}}>{error}</div>}
                <button onClick={handle} disabled={loading} onMouseEnter={e=>{if(!loading)e.currentTarget.style.backgroundColor='#6b4ce0'}} onMouseLeave={e=>{if(!loading)e.currentTarget.style.backgroundColor='#7c5cff'}} style={{width:'100%',padding:'11px 16px',borderRadius:8,fontSize:'0.875rem',fontWeight:600,backgroundColor:loading?'rgba(124,92,255,0.5)':'#7c5cff',color:'#ffffff',border:'none',cursor:loading?'not-allowed':'pointer',transition:'all 0.2s ease',marginTop:4}}>{loading?'Iniciando...':'Entrar al CRM'}</button>
                <button onClick={()=>{setView('recovery');setError('')}} style={{background:'none',border:'none',color:'#7c5cff',cursor:'pointer',fontSize:'0.8125rem',padding:0,textAlign:'center',textDecoration:'underline',fontFamily:'inherit',marginTop:10}}>¿Olvidaste tu contraseña?</button>
              </div>
            </div>
            <p style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',textAlign:'center',marginTop:20}}>Usa tu cuenta de Pessaro Capital</p>
          </div>
        </div>
      </div>
    )
  }

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',backgroundImage:`url(${BACKGROUND_IMAGE})`,backgroundSize:'cover',backgroundPosition:'center',padding:'24px 16px'}}>
      <style>{cssAnim}</style>
      <div style={{position:'absolute',top:0,right:0,bottom:0,left:0,background:'linear-gradient(135deg,rgba(10,15,50,0.82) 0%,rgba(30,58,138,0.7) 50%,rgba(10,15,50,0.82) 100%)',zIndex:0}}/>
      <div style={{position:'relative',zIndex:2,width:'100%',maxWidth:360,display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <img src={LOGO_URL} height={56} style={{display:'block',margin:'0 auto',borderRadius:12,marginBottom:12}} alt="Pessaro Capital"/>
          <h1 style={{fontSize:'1.5rem',fontWeight:700,color:'#ffffff',margin:'0 0 4px',textAlign:'center'}}>Pessaro Capital</h1>
          <p style={{fontSize:'0.75rem',fontWeight:700,color:'#7c5cff',letterSpacing:'2.5px',textTransform:'uppercase',margin:'0 0 8px',textAlign:'center'}}>CRM INTERNO</p>
          <p style={{fontSize:'0.8125rem',color:'rgba(255,255,255,0.7)',margin:0,textAlign:'center'}}>Acceso exclusivo para el equipo</p>
        </div>
        <div style={{width:'calc(100% - 32px)',maxWidth:360,backgroundColor:'rgba(26,26,36,0.85)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',padding:20,animation:'fadeInUp 0.6s ease-out'}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={{display:'block',fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6,letterSpacing:'1.5px',textTransform:'uppercase'}}>EMAIL</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@pessaro.cl" onFocus={onFocusIn} onBlur={onFocusOut} style={{...inputStyle}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:'0.6875rem',fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6,letterSpacing:'1.5px',textTransform:'uppercase'}}>CONTRASEÑA</label>
              <div style={{position:'relative'}}>
                <input type={showPass?'text':'password'} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onFocus={onFocusIn} onBlur={onFocusOut} onKeyDown={e=>e.key==='Enter'&&handle()} style={{...inputStyle,paddingRight:44}}/>
                <button type="button" onClick={()=>setShowPass(v=>!v)} tabIndex={-1} aria-label={showPass?'Ocultar contraseña':'Mostrar contraseña'}
                      style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:6,display:'flex',alignItems:'center',color:'#6b6b75'}}>
                      {showPass
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
              </div>
            </div>
            {error&&<div style={{padding:'10px 12px',backgroundColor:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,color:'#fca5a5',fontSize:'0.8125rem',textAlign:'center',marginTop:12}}>{error}</div>}
            <button onClick={handle} disabled={loading} style={{width:'100%',padding:'12px 16px',borderRadius:8,fontSize:'0.9375rem',fontWeight:600,backgroundColor:loading?'rgba(124,92,255,0.5)':'#7c5cff',color:'#ffffff',border:'none',cursor:loading?'not-allowed':'pointer',transition:'all 0.2s ease',marginTop:4,WebkitTapHighlightColor:'transparent'}}>{loading?'Iniciando...':'Entrar al CRM'}</button>
            <button onClick={()=>{setView('recovery');setError('')}} style={{background:'none',border:'none',color:'#7c5cff',cursor:'pointer',fontSize:'0.8125rem',padding:0,textAlign:'center',textDecoration:'underline',fontFamily:'inherit',marginTop:14,WebkitTapHighlightColor:'transparent'}}>¿Olvidaste tu contraseña?</button>
          </div>
        </div>
        <p style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',textAlign:'center',marginTop:20}}>Usa tu cuenta de Pessaro Capital</p>
      </div>
    </div>
  )
}

// ─── PASSWORD RESET ───────────────────────────────────────────────────────────
function PasswordReset({onDone}){
  const[newPass,setNewPass]=useState('')
  const[confirm,setConfirm]=useState('')
  const[error,setError]=useState('')
  const[loading,setLoading]=useState(false)
  const[done,setDone]=useState(false)

  const handle=async()=>{
    if(!newPass||!confirm)return
    if(newPass.length<8){setError('La contraseña debe tener al menos 8 caracteres.');return}
    if(newPass!==confirm){setError('Las contraseñas no coinciden.');return}
    setLoading(true);setError('')

    // Race entre updateUser y timeout de seguridad de 8s.
    // Supabase JS v2 a veces NO resuelve updateUser() después de un PASSWORD_RECOVERY
    // event aunque PUT /user retorne 200 en backend (bug conocido relacionado con
    // _notifyAllSubscribers awaiting callbacks). Como el backend log confirma que
    // el password se cambió, hacemos timeout y asumimos éxito.
    let result
    try{
      const timeoutPromise=new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),8000))
      result=await Promise.race([
        supabase.auth.updateUser({password:newPass}),
        timeoutPromise
      ])
    }catch(e){
      setLoading(false)
      setError('Error de red. Intenta nuevamente.')
      console.error('[reset] error:',e)
      return
    }
    setLoading(false)
    if(result?.error){setError(result.error.message);return}
    // Éxito (o timeout — el PUT en backend ya fue exitoso). Hacer signOut limpio.
    setDone(true)
    try{supabase.auth.signOut({scope:'global'}).catch(()=>{})}catch{}
    setTimeout(()=>onDone(),2500)
  }

  return <div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div style={{width:'100%',maxWidth:380}}>
      <div style={{textAlign:'center',marginBottom:36}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
          <img src={LOGO_URI} width={52} height={52} style={{borderRadius:10,display:'block'}} alt="Pessaro"/>
        </div>
        <h1 style={{fontSize:22,fontWeight:800,color:P.text,margin:'0 0 4px'}}>Pessaro Capital</h1>
        <p style={{color:P.purple,fontWeight:600,fontSize:14,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 6px'}}>CRM Interno</p>
      </div>
      <GlassCard accent={P.purple}>
        {done
          ? <div style={{textAlign:'center',padding:'8px 0'}}>
              <div style={{fontSize:32,marginBottom:12}}>✅</div>
              <p style={{fontSize:14,color:P.text,margin:0}}>¡Contraseña actualizada! Redirigiendo al login…</p>
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <p style={{fontSize:13,color:P.muted,margin:0}}>Elige una nueva contraseña para tu cuenta.</p>
              <div><Lbl>Nueva contraseña</Lbl><Input value={newPass} onChange={setNewPass} placeholder="Mínimo 8 caracteres" type="password"/></div>
              <div><Lbl>Confirmar contraseña</Lbl><Input value={confirm} onChange={setConfirm} placeholder="Repite la contraseña" type="password"/></div>
              {error&&<div style={{fontSize:12,color:P.red,background:P.redDim,padding:'10px 12px',borderRadius:8,border:`1px solid ${P.red}30`}}>{error}</div>}
              <Btn onClick={handle} disabled={loading} style={{width:'100%',justifyContent:'center',padding:11}}>{loading?'Guardando...':'Cambiar contraseña'}</Btn>
            </div>
        }
      </GlassCard>
    </div>
  </div>
}

// ─── NO STAFF SCREEN ──────────────────────────────────────────────────────────
// Pantalla mostrada cuando un usuario autenticado NO está registrado como staff CRM.
// Caso típico: cliente del portal pessaro.cl con credenciales válidas intenta
// entrar al CRM. La sesión ya fue cerrada en loadProfile; aquí solo informamos.
function NoStaffScreen({onBackToLogin}){
  return <div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div style={{width:'100%',maxWidth:440}}>
      <div style={{textAlign:'center',marginBottom:36}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
          <img src={LOGO_URI} width={52} height={52} style={{borderRadius:10,display:'block'}} alt="Pessaro"/>
        </div>
        <h1 style={{fontSize:22,fontWeight:800,color:P.text,margin:'0 0 4px'}}>Pessaro Capital</h1>
        <p style={{color:P.purple,fontWeight:600,fontSize:14,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 6px'}}>CRM Interno</p>
      </div>
      <GlassCard accent={P.red}>
        <div style={{display:'flex',flexDirection:'column',gap:18,textAlign:'center'}}>
          <div style={{fontSize:48,lineHeight:1}}>🚫</div>
          <h2 style={{fontSize:20,fontWeight:800,color:P.text,margin:0}}>Acceso denegado</h2>
          <p style={{fontSize:14,color:P.muted,margin:0,lineHeight:1.6}}>
            Tu cuenta no está registrada como <strong>staff del CRM</strong> de Pessaro Capital.
          </p>
          <div style={{background:P.redDim,border:`1px solid ${P.red}30`,borderRadius:10,padding:'12px 14px',textAlign:'left'}}>
            <p style={{fontSize:12,color:P.text,margin:'0 0 6px',fontWeight:600}}>¿Eres cliente de Pessaro Capital?</p>
            <p style={{fontSize:12,color:P.muted,margin:0,lineHeight:1.5}}>
              Este sitio es de uso exclusivo para el equipo interno. Para acceder a tu portal de cliente, visita <a href="https://pessaro.cl/portal-cliente" style={{color:P.purple,textDecoration:'none',fontWeight:600}}>pessaro.cl/portal-cliente</a>.
            </p>
          </div>
          <p style={{fontSize:12,color:P.muted,margin:0,lineHeight:1.5}}>
            Si crees que esto es un error, contacta al administrador en <a href="mailto:info@pessaro.cl" style={{color:P.purple,textDecoration:'none'}}>info@pessaro.cl</a>.
          </p>
          <Btn onClick={onBackToLogin} style={{width:'100%',justifyContent:'center',padding:11,marginTop:6}}>Volver al login</Btn>
        </div>
      </GlassCard>
    </div>
  </div>
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ─── ANÁLISIS DIARIO DE INSTRUMENTOS (panel del asesor) ──────────────────────
// Lee la parte interna (analisis_instrumentos_staff), que RLS reserva al staff.
// El aviso de carácter educativo se pinta siempre, sin condición: es un
// requisito legal del sitio, no un adorno.
function AnalisisDiario(){
  const[filas,setFilas]=useState([])
  const[fechas,setFechas]=useState([])   // días publicados, el más reciente primero
  const[fecha,setFecha]=useState(null)   // día que se está viendo
  const[cargando,setCargando]=useState(true)
  const[abierto,setAbierto]=useState(null)
  const isMob=useWindowSize()<768

  // Fecha local, no UTC. Con toISOString() el CRM pedía el día UTC: entre las
  // ~20:00 de Chile y medianoche el día ya había cambiado allá y el análisis del
  // día desaparecía de la pantalla con un «revisa el planificador» que no venía
  // a cuento. La tabla se fecha con el día en que se publicó, no en UTC.
  const hoyLocal=()=>{
    const d=new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  // Días disponibles. Se piden aparte para poder navegar el histórico: la tabla
  // guarda todos los días desde el alta.
  const cargarFechas=useCallback(async()=>{
    try{
      const{data,error}=await supabase
        .from('analisis_instrumentos').select('fecha')
        .order('fecha',{ascending:false}).limit(400)
      if(error)throw error
      const unicas=[...new Set((data||[]).map(r=>r.fecha))]
      setFechas(unicas)
      // Se abre en el último día publicado, no en "hoy": si el cron se retrasa
      // se ve el anterior fechado, que es mejor que un panel vacío.
      setFecha(f=>f&&unicas.includes(f)?f:(unicas[0]||null))
    }catch(e){console.error('analisis fechas:',e)}
  },[])

  const cargar=useCallback(async()=>{
    if(!fecha){setCargando(false);return}
    setCargando(true)
    try{
      const{data,error}=await supabase
        .from('analisis_instrumentos')
        .select('*, analisis_instrumentos_staff(analisis_staff)')
        .eq('fecha',fecha)
        .order('instrumento')
      if(error)throw error
      setFilas(data||[])
    }catch(e){console.error('analisis diario:',e)}
    finally{setCargando(false)}
  },[fecha])

  useEffect(()=>{cargarFechas()},[cargarFechas])
  useEffect(()=>{cargar()},[cargar])

  // Realtime: cuando la edge function publica el análisis de la mañana, la
  // pantalla se actualiza sola sin recargar.
  useEffect(()=>{
    const refrescar=()=>{cargarFechas();cargar()}
    const canal=supabase.channel('analisis-diario')
      .on('postgres_changes',{event:'*',schema:'public',table:'analisis_instrumentos'},refrescar)
      .on('postgres_changes',{event:'*',schema:'public',table:'analisis_instrumentos_staff'},refrescar)
      .subscribe()
    return()=>{supabase.removeChannel(canal)}
  },[cargar,cargarFechas])

  const COLOR={ALCISTA:P.green,BAJISTA:P.red,NEUTRA:P.muted}
  const FLECHA={ALCISTA:'▲',BAJISTA:'▼',NEUTRA:'▬'}
  const num=v=>Number(v).toLocaleString('es-CL',{maximumFractionDigits:5})
  const aviso=filas[0]?.disclaimer||'Contenido de carácter educativo e informativo. No constituye asesoría de inversión.'

  return <GlassCard style={{marginBottom:18}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
      <span style={{fontSize:15}}>📈</span>
      <p style={{fontSize:10,fontWeight:800,color:'#f0a500',textTransform:'uppercase',letterSpacing:'0.11em',margin:0}}>
        Análisis diario de instrumentos
      </p>
      <span style={{fontSize:10.5,color:P.muted,marginLeft:'auto'}}>
        {cargando?'cargando…':filas.length?`${filas.length} instrumentos`:'sin análisis'}
      </span>
      {/* Histórico: la tabla guarda todos los días desde el alta. */}
      {fechas.length>0&&<select value={fecha||''} onChange={e=>{setFecha(e.target.value);setAbierto(null)}}
        style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${P.border}`,borderRadius:7,
          padding:'4px 8px',color:P.text,fontSize:10.5,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
        {fechas.map(f=>(
          <option key={f} value={f} style={{background:P.surface}}>
            {fmtDate(f)}{f===hoyLocal()?' · hoy':''}
          </option>
        ))}
      </select>}
    </div>

    {/* Sólo se avisa del planificador si de verdad no hay nada publicado. Un día
        anterior a la vista no es un fallo del cron, es el histórico. */}
    {!cargando&&fechas.length===0&&(
      <p style={{fontSize:12,color:P.muted,fontStyle:'italic',margin:'0 0 14px'}}>
        Todavía no hay ningún análisis publicado. Si esto persiste, revisa el planificador.
      </p>
    )}
    {!cargando&&fechas.length>0&&fecha!==hoyLocal()&&(
      <p style={{fontSize:11,color:P.orange,margin:'0 0 12px'}}>
        {fecha===fechas[0]
          ? 'Último análisis publicado. El de hoy aparecerá cuando corra el planificador de la mañana.'
          : 'Estás viendo un análisis del histórico.'}
      </p>
    )}

    {filas.length>0&&<div style={{display:'grid',gridTemplateColumns:isMob?'1fr':'repeat(auto-fit,minmax(250px,1fr))',gap:10,marginBottom:14}}>
      {filas.map(f=>{
        const col=COLOR[f.tendencia]||P.muted
        const activo=abierto===f.id
        const staff=f.analisis_instrumentos_staff?.analisis_staff
        return <div key={f.id}
          onClick={()=>setAbierto(activo?null:f.id)}
          style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderLeft:`3px solid ${col}`,
            borderRadius:10,padding:'11px 13px',cursor:'pointer',gridColumn:activo&&!isMob?'1 / -1':'auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:13,fontWeight:700,color:P.text,fontFamily:'monospace'}}>{f.instrumento}</span>
            <span style={{fontSize:11,fontWeight:700,color:col}}>{FLECHA[f.tendencia]} {f.tendencia}</span>
            <span style={{fontSize:10.5,color:P.muted,marginLeft:'auto',fontFamily:'monospace'}}>{num(f.precio_referencia)}</span>
          </div>
          <div style={{display:'flex',gap:12,marginTop:6,fontSize:10.5,fontFamily:'monospace'}}>
            <span style={{color:P.green}}>S {num(f.soporte)}</span>
            <span style={{color:P.red}}>R {num(f.resistencia)}</span>
          </div>
          {activo&&(
            <div style={{marginTop:11,paddingTop:11,borderTop:`1px solid ${P.border}`}}>
              <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 6px'}}>
                Lectura técnica
              </p>
              <p style={{fontSize:12.5,color:P.textSub,margin:0,lineHeight:1.65,whiteSpace:'pre-wrap'}}>
                {staff||'Sin lectura técnica disponible.'}
              </p>
              <p style={{fontSize:10,color:P.muted,margin:'9px 0 0'}}>
                Fuente: {f.fuente_datos} · {f.validacion?.velas||'—'} sesiones · datos {fmtDate(f.datos_at)}
              </p>
            </div>
          )}
          {!activo&&<p style={{fontSize:10,color:P.muted,margin:'7px 0 0'}}>Ver lectura técnica →</p>}
        </div>
      })}
    </div>}

    {/* Aviso legal: se muestra siempre, haya o no análisis */}
    <div style={{background:P.orangeDim,border:'1px solid rgba(255,165,2,0.28)',borderRadius:9,padding:'9px 12px'}}>
      <p style={{fontSize:10.5,color:P.orange,margin:0,lineHeight:1.6}}>
        <strong>Carácter educativo.</strong> {aviso}
      </p>
    </div>
  </GlassCard>
}

function Dashboard({contacts,leads:allLeads,onNav,isSuperAdmin,user,staffProfile}){
  // Asesor ve solo SUS leads (por advisor_assigned o por referral_code)
  const leads=isSuperAdmin?allLeads:(()=>{
    const emailPrefix=(user?.email||'').split('@')[0].toLowerCase()
    const refCode=staffProfile?.referral_code||''
    return allLeads.filter(l=>
      (l.advisor_assigned&&l.advisor_assigned.toLowerCase().includes(emailPrefix))
      ||(refCode&&l.advisor_referral_code&&l.advisor_referral_code===refCode)
    )
  })()
  const closed=leads.filter(l=>l.etapa===5).length
  const newC=isSuperAdmin?contacts.filter(c=>c.status==='new').length:0
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital||c._capital)||0),0)
  const pipeData=STAGES.map(s=>({name:STAGE_LABEL[s],v:leads.filter(l=>ETAPA_STAGE[l.etapa]===s).length}))
  const isMob=useWindowSize()<768
  // Status breakdown adapts to SA (form statuses) vs asesor (contact statuses)
  const statusRows=isSuperAdmin
    ?[['new','Sin leer',P.orange],['read','Leídos',P.blue],['replied','Respondidos',P.green],['archived','Archivados / Spam',P.muted]]
    :[['activo','Activos',P.green],['prospecto','Prospectos',P.orange],['cliente','Clientes',P.purple],['inactivo','Inactivos',P.muted]]
  return <div>
    <SHdr title="Dashboard" sub="Datos en tiempo real desde Supabase"/>
    <div style={{display:'grid',gridTemplateColumns:isMob?'1fr 1fr':'repeat(4,1fr)',gap:14,marginBottom:22}}>
      <StatCard label={isSuperAdmin?'Formularios':'Mis contactos'} value={contacts.length} sub={isSuperAdmin?(newC>0?`${newC} sin leer`:contacts.length>0?'Todos leídos ✓':'Sin formularios'):(contacts.length>0?`${contacts.filter(c=>c.status==='activo').length} activos`:'Sin contactos')} accent={isSuperAdmin&&newC>0?P.orange:P.purple} Icon="📋"/>
      <StatCard label="Leads pipeline" value={leads.length} sub={`${closed} cerrados`} accent={P.blue} Icon="◈"/>
      <StatCard label="Capital declarado" value={fmt(totalCap)} accent={P.green} Icon="💵"/>
      <StatCard label="Tasa cierre" value={leads.length?`${Math.round(closed/leads.length*100)}%`:'—'} accent={P.orange} Icon="🎯"/>
    </div>

    <AnalisisDiario/>

    <div style={{display:'grid',gridTemplateColumns:isMob?'1fr':'1fr 1fr',gap:18,marginBottom:18}}>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Pipeline por etapa</p>
        <ErrorBoundary><ResponsiveContainer width="100%" height={180}>
          <BarChart data={pipeData} barSize={28}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.purple} radius={[4,4,0,0]}/></BarChart>
        </ResponsiveContainer></ErrorBoundary>
      </GlassCard>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>{isSuperAdmin?'Estado formularios':'Estado contactos'}</p>
        {statusRows.map(([s,l,c])=>{
          const cnt=contacts.filter(x=>x.status===s).length
          return <div key={s} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13,color:P.textSub}}>{l}</span><span style={{fontSize:13,fontFamily:'monospace',color:c,fontWeight:600}}>{cnt}</span></div>
            <div style={{background:'rgba(255,255,255,0.06)',borderRadius:2,height:4}}><div style={{background:c,height:4,borderRadius:2,width:`${contacts.length?cnt/contacts.length*100:0}%`,transition:'width 0.6s'}}/></div>
          </div>
        })}
      </GlassCard>
    </div>
    <GlassCard>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>{isSuperAdmin?'Últimos formularios':'Mis contactos recientes'}</p>
      {contacts.filter(c=>c.status!=='archived'&&c.status!=='inactivo').slice(0,6).map((c,i)=>(
        <div key={c.id} onClick={()=>onNav('contacts')} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<5?`1px solid ${P.border}`:'none',cursor:'pointer',borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <div style={{width:30,height:30,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:P.purple}}>{(c.full_name||'?')[0]}</div>
            <div><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{c.full_name}</p><p style={{fontSize:11,color:P.muted,margin:0}}>{c.email}</p></div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {(c.investment_capital||c._capital)>0&&<span style={{fontSize:12,fontFamily:'monospace',color:P.green}}>{fmt(c.investment_capital||c._capital)}</span>}
            <Badge label={c.status} color={isSuperAdmin?(STATUS_COLOR[c.status]||P.muted):(SCOLOR_MAP[c.status]||P.muted)}/>
          </div>
        </div>
      ))}
      {contacts.length===0&&<p style={{color:P.muted,fontSize:13,margin:0}}>{isSuperAdmin?'Sin formularios aún':'Sin contactos aún'}</p>}
    </GlassCard>
  </div>
}

// ─── CONTACTS (SUPER ADMIN = todos, asesor = propios) ─────────────────────────
function Contacts({user,isSuperAdmin,staffProfile}){
  const isSARef=useRef(isSuperAdmin)
  useEffect(()=>{isSARef.current=isSuperAdmin},[isSuperAdmin])
  const[contacts,setContacts]=useState([])
  const[loading,setLoading]=useState(true)
  const[search,setSearch]=useState('')
  const[statusFilter,setStatusFilter]=useState('todos')
  // Segmentación comercial: tipo de contacto y etapa de venta
  const[tipoFilter,setTipoFilter]=useState('todos')
  const[stageFilter,setStageFilter]=useState('todos')
  const[staffList,setStaffList]=useState([])
  const[userFilter,setUserFilter]=useState('todos')
  const[tab,setTab]=useState('lista')
  const[selected,setSelected]=useState(null)
  const[notes,setNotes]=useState([])
  const[noteText,setNoteText]=useState('')
  const[noteErr,setNoteErr]=useState('')
  const[form,setForm]=useState({full_name:'',email:'',phone:'',address:'',status:'activo',notes:''})
  const[formErr,setFormErr]=useState({})
  const[saving,setSaving]=useState(false)
  const[csvRows,setCsvRows]=useState([])
  const[csvNew,setCsvNew]=useState([])              // filas sin duplicado
  const[csvDuplicates,setCsvDuplicates]=useState([])// {row, existing, decision: 'skip'|'update'|'duplicate'|null}
  const[dupReviewIdx,setDupReviewIdx]=useState(-1)  // índice del duplicado en revisión (-1 = modal cerrado)
  const[csvErrors,setCsvErrors]=useState([])
  const[csvImporting,setCsvImporting]=useState(false)
  const[csvDone,setCsvDone]=useState(null)
  const[dragOver,setDragOver]=useState(false)
  const[activities,setActivities]=useState([])
  const[loadingActivities,setLoadingActivities]=useState(false)
  const[editingAssignee,setEditingAssignee]=useState(null)
  const[assigneeValue,setAssigneeValue]=useState('')
  const[editingContact,setEditingContact]=useState(null)
  const[editForm,setEditForm]=useState({full_name:'',email:'',phone:'',address:'',status:'activo',
    birth_date:'',profession:'',account_opened:false,account_opened_at:'',account_kind:'',broker:'',account_number:'',initial_balance:'',managed_type:''})
  // Grupos: el grupo es del asesor que lo crea; el SA ve los de todos (RLS)
  const[groups,setGroups]=useState([])
  const[memberships,setMemberships]=useState({})   // contact_id -> [group_id]
  const[groupFilter,setGroupFilter]=useState('todos')
  const[showGroups,setShowGroups]=useState(false)
  const[groupForm,setGroupForm]=useState({name:'',description:'',color:GROUP_COLORS[0]})
  const[editingGroup,setEditingGroup]=useState(null)
  const[managingGroup,setManagingGroup]=useState(null) // grupo cuyos miembros se están editando
  const[groupSearch,setGroupSearch]=useState('')
  const[confirmDeleteGroup,setConfirmDeleteGroup]=useState(null) // borrar pide confirmación en el propio botón
  const[groupErr,setGroupErr]=useState('')
  // Filtro por fecha de creación + agrupar de un golpe los del día
  const[dateFilter,setDateFilter]=useState('todos')
  const[agrupando,setAgrupando]=useState(false)
  const[agrupaMsg,setAgrupaMsg]=useState(null)   // {type,text}
  // Import CSV: grupo destino, creado antes de importar si hace falta
  const[importGroupId,setImportGroupId]=useState('')      // '' = sin grupo, 'nuevo' = crear
  const[importGroupNew,setImportGroupNew]=useState({name:'',color:GROUP_COLORS[0]})
  const[importGroupUpdated,setImportGroupUpdated]=useState(true) // agregar también los actualizados
  // Traspasos entre grupos
  const[groupTab,setGroupTab]=useState('grupos')  // 'grupos' | 'historial'
  const[picked,setPicked]=useState([])            // contactos marcados dentro de un grupo
  const[transferTo,setTransferTo]=useState('')
  const[transferNote,setTransferNote]=useState('')
  const[transferCopy,setTransferCopy]=useState(false)
  const[transferring,setTransferring]=useState(false)
  const[transfers,setTransfers]=useState([])
  const[loadingTransfers,setLoadingTransfers]=useState(false)
  const[trFilter,setTrFilter]=useState({desde:'',hasta:'',grupo:'todos'})
  const[transferMsg,setTransferMsg]=useState(null) // {type,text}
  const[transferMode,setTransferMode]=useState(false) // la lista de miembros pasa a selección múltiple
  // Filtros dentro del grupo, para armar la membresía en bloque
  const MEMBER_FILTER_0={estado:'todos',tipo:'todos',etapa:'todos',fecha:'todos',asesor:'todos',grupo:'todos',pertenencia:'todos'}
  const[memberFilter,setMemberFilter]=useState(MEMBER_FILTER_0)
  const[bulkBusy,setBulkBusy]=useState(false)
  const[bulkMsg,setBulkMsg]=useState(null) // {type,text}
  // Campañas WABA que ya recibió el contacto abierto en la ficha
  const[campanas,setCampanas]=useState([])
  // Gestión comercial dentro de la ficha
  const[actForm,setActForm]=useState({tipo:'llamada',notas:'',resultado:'',fecha:new Date().toISOString().slice(0,10)})
  const[actSaving,setActSaving]=useState(false)
  const[comErr,setComErr]=useState('')
  // Ficha: historial consolidado del contacto (WhatsApp, lead, tickets, tareas, cuenta)
  const[ficha,setFicha]=useState(null)
  const[loadingFicha,setLoadingFicha]=useState(false)
  // Ficha en pantalla completa: depósitos/retiros y progreso educativo
  const[movs,setMovs]=useState([])
  const[movForm,setMovForm]=useState({kind:'deposito',amount:'',movement_date:new Date().toISOString().slice(0,10),note:''})
  const[movSaving,setMovSaving]=useState(false)
  const[movErr,setMovErr]=useState('')
  const[edu,setEdu]=useState([])            // filas de list_certificate_candidates para este contacto
  // Bajas de WhatsApp: el teléfono va en dígitos, igual que crm_contacts.phone
  const[optOuts,setOptOuts]=useState(new Set())
  // Envio de plantilla WABA desde Contactos (solo super admin)
  const[waContact,setWaContact]=useState(null)
  const[issuing,setIssuing]=useState(null)
  const[certMsg,setCertMsg]=useState(null)
  // La emisión de certificados es de admin/super admin; el asesor no ve el bloque
  const isAdmin=isSuperAdmin||staffProfile?.role==='admin'
  const ancho=useWindowSize()
  const isMob=ancho<768

  const loadGroups=useCallback(async()=>{
    try{
      const[{data:gs},{data:ms}]=await Promise.all([
        supabase.from('crm_contact_groups').select('*').order('name'),
        supabase.from('crm_contact_group_members').select('group_id,contact_id'),
      ])
      setGroups(gs||[])
      const map={}
      for(const m of ms||[])(map[m.contact_id]=map[m.contact_id]||[]).push(m.group_id)
      setMemberships(map)
    }catch(e){console.error('loadGroups:',e)}
  },[])

  useEffect(()=>{loadGroups()},[loadGroups])

  // Quién pidió no recibir mensajes. Sólo cuentan las bajas sin reactivar.
  useEffect(()=>{(async()=>{
    try{
      const{data}=await supabase.from('whatsapp_opt_outs').select('client_phone').is('opted_in_at',null)
      setOptOuts(new Set((data||[]).map(o=>soloDigitos(o.client_phone))))
    }catch(e){console.error('loadOptOuts:',e)}
  })()},[])

  const saveGroup=async()=>{
    const name=groupForm.name.trim()
    if(!name){setGroupErr('El nombre es obligatorio');return}
    setGroupErr('')
    if(editingGroup){
      const{error}=await supabase.from('crm_contact_groups')
        .update({name,description:groupForm.description||null,color:groupForm.color,updated_at:new Date().toISOString()}).eq('id',editingGroup)
      if(error){setGroupErr(error.message);return}
    }else{
      const{error}=await supabase.from('crm_contact_groups')
        .insert({name,description:groupForm.description||null,color:groupForm.color,user_id:user.id})
      // 23505 = choca con UNIQUE(user_id,name): el mismo asesor no repite nombre
      if(error){setGroupErr(error.code==='23505'?'Ya tienes un grupo con ese nombre.':error.message);return}
    }
    setGroupForm({name:'',description:'',color:GROUP_COLORS[0]});setEditingGroup(null);loadGroups()
  }

  const deleteGroup=async(id)=>{
    const{error}=await supabase.from('crm_contact_groups').delete().eq('id',id)
    if(error){setGroupErr(error.message);return}
    if(groupFilter===id)setGroupFilter('todos')
    if(editingGroup===id){setEditingGroup(null);setGroupForm({name:'',description:'',color:GROUP_COLORS[0]})}
    loadGroups()
  }

  const toggleMember=async(contactId,groupId)=>{
    const has=(memberships[contactId]||[]).includes(groupId)
    // Optimista: los chips de la ficha responden sin esperar al round-trip
    setMemberships(p=>({...p,[contactId]:has?(p[contactId]||[]).filter(g=>g!==groupId):[...(p[contactId]||[]),groupId]}))
    // Va por la RPC y no por insert/delete directo porque es la que deja el
    // movimiento en el historial. Alta = sin origen; baja = sin destino.
    const{error}=await supabase.rpc('transfer_contacts_between_groups',{
      p_contact_ids:[contactId],
      p_from_group:has?groupId:null,
      p_to_group:has?null:groupId,
      p_note:null,p_copiar:false,
    })
    if(error){console.error('toggleMember:',error);loadGroups()}
  }

  // Historial de traspasos. Se carga al abrir la pestaña, no al montar: es una
  // tabla que sólo crece y no hace falta para el listado.
  const loadTransfers=useCallback(async()=>{
    setLoadingTransfers(true)
    try{
      const{data,error}=await supabase.from('crm_contact_group_transfers')
        .select('*,crm_contacts(full_name,email,phone)')
        .order('moved_at',{ascending:false}).limit(2000)
      if(error)throw error
      setTransfers(data||[])
    }catch(e){console.error('loadTransfers:',e);setTransfers([])}
    finally{setLoadingTransfers(false)}
  },[])

  // El historial se trae al abrir su pestaña, no al montar el CRM.
  // Va DESPUÉS de loadTransfers a propósito: el array de dependencias se
  // evalúa durante el render, así que declararlo antes lo dejaba en la zona
  // muerta temporal y el módulo entero reventaba al entrar en Contactos.
  useEffect(()=>{if(showGroups&&groupTab==='historial'&&!managingGroup)loadTransfers()},[showGroups,groupTab,managingGroup,loadTransfers])

  // Alta o baja en bloque de todo lo que cumple el filtro. Va por la misma RPC
  // que el resto, así que también queda en el historial de movimientos.
  const bulkMembership=async(groupId,ids,agregar)=>{
    if(!ids.length)return
    setBulkBusy(true);setBulkMsg(null)
    try{
      const{data,error}=await supabase.rpc('transfer_contacts_between_groups',{
        p_contact_ids:ids,
        p_from_group:agregar?null:groupId,
        p_to_group:agregar?groupId:null,
        p_note:agregar?'Alta en bloque desde los filtros del grupo':'Baja en bloque desde los filtros del grupo',
        p_copiar:false,
      })
      if(error)throw error
      await loadGroups()
      setBulkMsg({type:'ok',text:`${data?.movidos||0} contacto(s) ${agregar?'agregados':'quitados'}${data?.omitidos?` · ${data.omitidos} omitidos`:''}.`})
    }catch(e){
      console.error('bulkMembership:',e)
      setBulkMsg({type:'err',text:e.message||'No se pudo aplicar el cambio'})
    }finally{setBulkBusy(false)}
  }

  // Traspaso en lote desde la pantalla de miembros del grupo
  const doTransfer=async()=>{
    if(!managingGroup||!picked.length)return
    if(!transferTo){setTransferMsg({type:'err',text:'Elige el grupo de destino.'});return}
    setTransferring(true);setTransferMsg(null)
    try{
      const{data,error}=await supabase.rpc('transfer_contacts_between_groups',{
        p_contact_ids:picked,
        p_from_group:managingGroup,
        p_to_group:transferTo,
        p_note:transferNote.trim()||null,
        p_copiar:transferCopy,
      })
      if(error)throw error
      const destino=groups.find(g=>g.id===transferTo)?.name||'destino'
      await loadGroups()
      setPicked([]);setTransferNote('');setTransferTo('')
      setTransferMsg({type:'ok',text:`${data?.movidos||0} contacto(s) ${transferCopy?'copiados':'trasladados'} a «${destino}»${data?.omitidos?` · ${data.omitidos} omitidos`:''}.`})
    }catch(e){console.error('doTransfer:',e);setTransferMsg({type:'err',text:e.message||'No se pudo completar el traspaso'})}
    finally{setTransferring(false)}
  }

  // Convierte el filtro de fecha en un grupo real. Idempotente: reutiliza el
  // grupo del día si ya existe y la RPC omite a los que ya están dentro.
  const agruparDelRango=async()=>{
    const desde=desdeRango(dateFilter)
    if(!desde)return
    const delRango=contacts.filter(c=>!String(c.id).startsWith('sub_')&&c.created_at&&new Date(c.created_at)>=desde)
    if(!delRango.length){setAgrupaMsg({type:'err',text:'No hay contactos en ese rango.'});return}
    setAgrupando(true);setAgrupaMsg(null)
    try{
      const hoy=nombreGrupoDia()
      const nombre=dateFilter==='hoy'?hoy:`${hoy} (${dateFilter==='7d'?'7':'30'} días)`
      let grupo=groups.find(g=>g.name===nombre&&g.user_id===user.id)
      if(!grupo){
        const{data,error}=await supabase.from('crm_contact_groups').insert({
          name:nombre,description:'Creado desde el filtro por fecha de Contactos',
          color:GROUP_COLORS[1],user_id:user.id,
        }).select().single()
        if(error)throw error
        grupo=data
      }
      const{data:res,error:e2}=await supabase.rpc('transfer_contacts_between_groups',{
        p_contact_ids:delRango.map(c=>c.id),
        p_from_group:null,p_to_group:grupo.id,
        p_note:'Agrupado desde el filtro por fecha',p_copiar:false,
      })
      if(e2)throw e2
      await loadGroups()
      setGroupFilter(grupo.id)
      setAgrupaMsg({type:'ok',text:`«${nombre}»: ${res?.movidos||0} agregado(s)${res?.omitidos?` · ${res.omitidos} ya estaban dentro`:''}.`})
    }catch(e){
      console.error('agruparDelRango:',e)
      setAgrupaMsg({type:'err',text:e.code==='23505'?'Ya existe un grupo con ese nombre.':(e.message||'No se pudo crear el grupo')})
    }finally{setAgrupando(false)}
  }

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      if(isSARef.current){
        const[{data:crm},{data:subs},{data:sp}]=await Promise.all([
          supabase.from('crm_contacts').select('*').order('created_at',{ascending:false}),
          supabase.from('contact_submissions').select('id,full_name,email,mobile,investment_capital,management_type,status,submitted_at').order('submitted_at',{ascending:false}),
          supabase.from('crm_staff_profiles').select('user_id,display_name'),
        ])
        setStaffList(sp||[])
        const existing=new Set((crm||[]).map(c=>c.email))
        const normalized=(subs||[]).filter(s=>!existing.has(s.email)).map(s=>({
          id:'sub_'+s.id, user_id:null,
          full_name:s.full_name||'Sin nombre', email:s.email, phone:s.mobile||'—', address:'',
          notes:s.management_type||'', status:s.status==='new'?'prospecto':s.status==='read'?'activo':s.status==='replied'?'cliente':'inactivo',
          _origStatus:s.status, source:'formulario', created_at:s.submitted_at, _capital:s.investment_capital,
        }))
        setContacts([...(crm||[]),...normalized])
      } else {
        const{data}=await supabase.from('crm_contacts').select('*').eq('user_id',user.id).order('created_at',{ascending:false})
        setContacts(data||[])
      }
    }catch(e){console.error('contacts load:',e)}
    finally{setLoading(false)}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  useEffect(()=>{load()},[load])

  const desdeFecha=desdeRango(dateFilter)
  const filtered=contacts.filter(c=>{
    const ms=`${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
    // Rango por fecha de creación (medianoche local, ver desdeRango)
    const mf=!desdeFecha||(c.created_at&&new Date(c.created_at)>=desdeFecha)
    const mst=statusFilter==='todos'||(statusFilter==='activos'&&c.status!=='inactivo')||c.status===statusFilter
    const mu=userFilter==='todos'||c.user_id===userFilter
    const mg=groupFilter==='todos'||(memberships[c.id]||[]).includes(groupFilter)
    // Los formularios web (sub_) no tienen perfil comercial: al filtrar por tipo
    // o etapa quedan fuera en vez de colarse como si fueran P2P sin etapa.
    const esSub=String(c.id).startsWith('sub_')
    const mt=tipoFilter==='todos'||(!esSub&&(c.contact_type||'P2P')===tipoFilter)
    const me=stageFilter==='todos'
      ||(stageFilter==='pendientes'&&!esSub&&!String(c.sales_stage||'').startsWith('CERRADO'))
      ||(!esSub&&c.sales_stage===stageFilter)
    return ms&&mst&&mu&&mg&&mt&&me&&mf
  })
  // Cuántos entrarían al grupo si se pulsa «Agrupar»: sólo contactos reales
  const nuevosDelRango=desdeFecha
    ?contacts.filter(c=>!String(c.id).startsWith('sub_')&&c.created_at&&new Date(c.created_at)>=desdeFecha).length
    :0

  const validate=()=>{
    const e={}
    if(!form.full_name.trim())e.full_name='Obligatorio'
    if(!form.email.trim()||!form.email.includes('@'))e.email='Email válido obligatorio'
    if(!soloDigitos(form.phone))e.phone='Indica el móvil en dígitos (ej: 56912345678)'
    setFormErr(e); return !Object.keys(e).length
  }

  const saveContact=async()=>{
    if(!validate())return
    setSaving(true)
    const{data,error}=await supabase.from('crm_contacts')
      .insert({...form,phone:soloDigitos(form.phone),user_id:user.id,source:'manual'}).select().single()
    setSaving(false)
    if(error){setFormErr({email:error.message});return}
    setContacts(p=>[data,...p])
    setForm({full_name:'',email:'',phone:'',address:'',status:'activo',notes:''})
    setFormErr({});setTab('lista')
  }

  // Consolida el historial del contacto desde las cuatro fuentes del CRM.
  // Los teléfonos entran con formatos distintos según su origen (manual, CSV,
  // landing, webhook), así que WhatsApp se cruza por los últimos 8 dígitos.
  // La ficha ocupa toda la pantalla: Escape la cierra y el fondo no debe scrollear
  useEffect(()=>{
    if(!selected)return
    const h=e=>{if(e.key==='Escape'&&!editingContact)setSelected(null)}
    const prev=document.body.style.overflow
    document.body.style.overflow='hidden'
    window.addEventListener('keydown',h)
    return()=>{window.removeEventListener('keydown',h);document.body.style.overflow=prev}
  },[selected,editingContact])

  // Depósitos y retiros del cliente, lo más reciente primero
  const loadMovs=useCallback(async contactId=>{
    try{
      const{data,error}=await supabase.from('crm_client_movements').select('*')
        .eq('contact_id',contactId).order('movement_date',{ascending:false}).order('created_at',{ascending:false})
      if(error)throw error
      setMovs(data||[])
    }catch(e){console.error('loadMovs:',e);setMovs([])}
  },[])

  const addMov=async()=>{
    if(!selected)return
    const monto=Number(String(movForm.amount).replace(',','.'))
    if(!(monto>0)){setMovErr('Indica un monto mayor que 0');return}
    if(!movForm.movement_date){setMovErr('Indica la fecha del movimiento');return}
    setMovErr('');setMovSaving(true)
    try{
      const{data,error}=await supabase.from('crm_client_movements').insert({
        contact_id:selected.id,kind:movForm.kind,amount:monto,
        movement_date:movForm.movement_date,note:movForm.note.trim()||null,
      }).select().single()
      if(error)throw error
      setMovs(p=>[data,...p].sort((a,b)=>new Date(b.movement_date)-new Date(a.movement_date)))
      setMovForm({kind:'deposito',amount:'',movement_date:new Date().toISOString().slice(0,10),note:''})
      logActivity(user.id,selected.id,'otro',`${movForm.kind==='deposito'?'Depósito':'Retiro'} registrado: ${fmtUSD(monto)}`,{})
    }catch(e){console.error('addMov:',e);setMovErr(e.message||'No se pudo guardar el movimiento')}
    finally{setMovSaving(false)}
  }

  // El certificado lo emite la RPC: valida rol (admin/super admin) y progreso 100 %
  const issueCert=async row=>{
    setIssuing(row.assignment_id);setCertMsg(null)
    try{
      const{data,error}=await supabase.rpc('issue_education_certificate',{p_assignment_id:row.assignment_id,p_note:null})
      if(error)throw error
      setCertMsg({type:'ok',text:data?.already_issued
        ?`Este curso ya tenía el certificado ${data.certificate_number}`
        :`Certificado ${data.certificate_number} emitido para ${row.client_name}`})
      const{data:rows}=await supabase.rpc('list_certificate_candidates',{p_email:selected?.email||null})
      setEdu(rows||[])
      if(selected)logActivity(user.id,selected.id,'otro',`Certificado emitido · ${row.module_title}`,{})
    }catch(e){console.error('issueCert:',e);setCertMsg({type:'err',text:e.message||'No se pudo emitir el certificado'})}
    finally{setIssuing(null)}
  }

  const delMov=async id=>{
    try{
      const{error}=await supabase.from('crm_client_movements').delete().eq('id',id)
      if(error)throw error
      setMovs(p=>p.filter(m=>m.id!==id))
    }catch(e){console.error('delMov:',e);setMovErr(e.message||'No se pudo eliminar')}
  }

  const loadFicha=async c=>{
    setFicha(null);setMovs([]);setEdu([]);setMovErr('');setCampanas([])
    if(String(c.id).startsWith('sub_'))return
    loadMovs(c.id)
    // Campañas WABA que ya recibió. Se cruza por contact_id y por teléfono:
    // el histórico anterior a la tabla se enlazó por número.
    ;(async()=>{
      const tel=soloDigitos(c.phone)
      const filtro=tel?`contact_id.eq.${c.id},phone.eq.${tel}`:`contact_id.eq.${c.id}`
      const{data,error}=await supabase.from('whatsapp_campaign_recipients')
        .select('id,outcome,template_name,error,created_at,whatsapp_campaigns(name,status)')
        .or(filtro).order('created_at',{ascending:false}).limit(100)
      if(error)console.error('campanas:',error)
      else setCampanas(data||[])
    })()
    // Progreso y certificados sólo los ve admin/super admin (la RPC además lo exige)
    if(isAdmin&&c.email){
      supabase.rpc('list_certificate_candidates',{p_email:c.email})
        .then(({data,error})=>{if(error)console.error('edu:',error);else setEdu(data||[])})
    }
    setLoadingFicha(true)
    try{
      const tail=(c.phone||'').replace(/\D/g,'').slice(-8)
      const email=(c.email||'').trim()
      const[wa,leadById,leadByMail,subs,tkByContact,tkByMail,tasks,cliente]=await Promise.all([
        tail.length>=8?supabase.from('whatsapp_messages').select('id,direction,message_type,content,template_name,status,created_at').ilike('client_phone',`%${tail}`).order('created_at',{ascending:false}).limit(200):{data:[]},
        c.lead_id?supabase.from('campaign_leads').select('*').eq('id',c.lead_id).limit(1):{data:[]},
        email?supabase.from('campaign_leads').select('*').eq('email',email).limit(1):{data:[]},
        email?supabase.from('contact_submissions').select('*').eq('email',email).order('submitted_at',{ascending:false}):{data:[]},
        supabase.from('support_tickets').select('*').eq('contact_id',c.id),
        email?supabase.from('support_tickets').select('*').eq('client_email',email):{data:[]},
        supabase.from('crm_tasks').select('*').eq('contact_id',c.id).order('created_at',{ascending:false}),
        email?supabase.from('client_profiles_2026_02_08_22_02').select('*').eq('email',email).limit(1):{data:[]},
      ])
      // El mismo ticket puede llegar por contact_id y por email; se deduplica
      const tickets=[...(tkByContact.data||[]),...(tkByMail.data||[])]
        .filter((t,i,a)=>a.findIndex(x=>x.id===t.id)===i)
        .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
      setFicha({
        wa:wa.data||[],
        lead:(leadById.data||[])[0]||(leadByMail.data||[])[0]||null,
        subs:subs.data||[],
        tickets,
        tasks:tasks.data||[],
        cliente:(cliente.data||[])[0]||null,
      })
    }catch(e){console.error('loadFicha:',e)}
    finally{setLoadingFicha(false)}
  }

  const openContact=async c=>{
    setSelected(c);setNotes([]);setNoteText('');setNoteErr('');setComErr('');setActivities([])
    loadFicha(c)
    try{
      let q=supabase.from('crm_notes').select('*').order('created_at',{ascending:false})
      if(c.id.startsWith('sub_')) q=q.eq('contact_submission_id',c.id.replace('sub_',''))
      else q=q.eq('crm_contact_id',c.id)
      const{data}=await q
      setNotes(data||[])
    }catch(e){console.error('loadNotes:',e)}
    if(!c.id.startsWith('sub_')){
      setLoadingActivities(true)
      try{
        const{data}=await supabase.from('contact_activity_log').select('*').eq('contact_id',c.id).order('created_at',{ascending:false}).limit(50)
        setActivities(data||[])
      }catch(e){console.error('loadActivities:',e)}
      finally{setLoadingActivities(false)}
    }
    if(c.source==='formulario'&&c._origStatus==='new'){
      try{
        await supabase.from('contact_submissions').update({status:'read'}).eq('id',c.id.replace('sub_',''))
        setContacts(p=>p.map(x=>x.id===c.id?{...x,status:'activo',_origStatus:'read'}:x))
        setSelected(s=>s?{...s,status:'activo',_origStatus:'read'}:s)
      }catch(e){console.error('markRead:',e)}
    }
  }

  const addNote=async()=>{
    if(!noteText.trim()||!selected)return
    const isSub=selected.id.startsWith('sub_')
    const payload={content:noteText,created_by:user.id}
    if(isSub) payload.contact_submission_id=selected.id.replace('sub_','')
    else payload.crm_contact_id=selected.id
    const{data,error}=await supabase.from('crm_notes').insert(payload).select().single()
    // El error se enseña. Antes sólo iba a console.error y el botón parecía no
    // hacer nada: así estuvo la nota rota desde el 2026-06-18 sin que se notara.
    if(error){console.error('addNote:',error);setNoteErr(error.message);return}
    setNoteErr('')
    if(data){
      setNotes(p=>[data,...p]);setNoteText('')
      // La actividad la escribe el trigger fn_log_note_added en la base; aquí
      // sólo se refleja en pantalla para no esperar a recargar la ficha.
      if(!isSub)setActivities(p=>[{id:Date.now().toString(),activity_type:'nota_agregada',description:'Nota agregada al contacto',created_at:new Date().toISOString()},...p])
    }
  }

  const updateStatus=async(id,status)=>{
    try{
      if(id.startsWith('sub_')){
        const subStatus=status==='activo'?'read':status==='cliente'?'replied':status==='inactivo'?'archived':'new'
        await supabase.from('contact_submissions').update({status:subStatus}).eq('id',id.replace('sub_',''))
      } else {
        await supabase.from('crm_contacts').update({status}).eq('id',id)
      }
      const orig=status==='activo'?'read':status==='cliente'?'replied':status==='inactivo'?'archived':'new'
      setContacts(p=>p.map(c=>c.id===id?{...c,status,_origStatus:orig}:c))
      if(selected?.id===id)setSelected(p=>({...p,status}))
      if(!id.startsWith('sub_')){
        logActivity(user.id,id,'estado_cambiado',`Estado cambiado a: ${status}`,{status})
        if(selected?.id===id)setActivities(p=>[{id:Date.now().toString(),activity_type:'estado_cambiado',description:`Estado cambiado a: ${status}`,created_at:new Date().toISOString()},...p])
      }
    }catch(e){console.error('updateStatus:',e)}
  }

  // ── Gestión comercial ──────────────────────────────────────────────────────
  // Un parche genérico sobre crm_contacts con actualización optimista. Los
  // formularios web (sub_) no tienen fila real, así que ni se intenta.
  const patchComercial=async(contactId,patch,descripcion)=>{
    if(String(contactId).startsWith('sub_'))return
    const{error}=await supabase.from('crm_contacts').update(patch).eq('id',contactId)
    if(error){setComErr(error.message);return}
    setComErr('')
    setContacts(p=>p.map(c=>c.id===contactId?{...c,...patch}:c))
    if(selected?.id===contactId)setSelected(p=>({...p,...patch}))
    if(descripcion){
      logActivity(user.id,contactId,'estado_cambiado',descripcion,patch)
      if(selected?.id===contactId)setActivities(p=>[{id:Date.now().toString(),activity_type:'estado_cambiado',description:descripcion,created_at:new Date().toISOString()},...p])
    }
  }

  // Registrar una gestión. occurred_at es cuándo ocurrió de verdad: el asesor
  // anota el lunes la llamada del viernes y el KPI del mes debe contarla bien.
  const registrarActividad=async contactId=>{
    if(String(contactId).startsWith('sub_'))return
    const desc=actForm.notas.trim()
    if(!desc){setComErr('Escribe una nota de la gestión');return}
    setActSaving(true);setComErr('')
    const fecha=actForm.fecha?new Date(`${actForm.fecha}T12:00:00`).toISOString():new Date().toISOString()
    const{data,error}=await supabase.from('contact_activity_log').insert({
      contact_id:contactId,user_id:user.id,activity_type:actForm.tipo,
      description:desc,occurred_at:fecha,outcome:actForm.resultado.trim()||null,metadata:{},
    }).select().single()
    setActSaving(false)
    if(error){setComErr(error.message);return}
    setActivities(p=>[data,...p])
    setActForm({tipo:'llamada',notas:'',resultado:'',fecha:new Date().toISOString().slice(0,10)})
  }

  const handleAssigneeChange=async(contactId,newAdvisorId)=>{
    try{
      await supabase.from('crm_contacts').update({user_id:newAdvisorId||null}).eq('id',contactId)
      const advisorName=newAdvisorId?staffList.find(s=>s.user_id===newAdvisorId)?.display_name:'sin asesor'
      logActivity(user.id,contactId,'asignacion',`Contacto asignado a ${advisorName}`,{})
      if(selected?.id===contactId){
        setSelected(p=>({...p,user_id:newAdvisorId||null}))
        setActivities(p=>[{id:Date.now().toString(),activity_type:'asignacion',description:`Contacto asignado a ${advisorName}`,created_at:new Date().toISOString()},...p])
      }
      load()
    }catch(e){console.error('handleAssigneeChange:',e)}
    setEditingAssignee(null)
  }

  const saveContactEdit=async(contactId)=>{
    // Las columnas date/numeric no aceptan '': se mandan como null
    const nn=v=>{const s=typeof v==='string'?v.trim():v; return s===''||s===undefined?null:s}
    const payload={
      ...editForm,
      phone:soloDigitos(editForm.phone),
      birth_date:nn(editForm.birth_date),
      account_opened_at:nn(editForm.account_opened_at),
      account_kind:nn(editForm.account_kind),
      managed_type:nn(editForm.managed_type),
      profession:nn(editForm.profession),
      broker:nn(editForm.broker),
      account_number:nn(editForm.account_number),
      initial_balance:editForm.initial_balance===''||editForm.initial_balance===null?null:Number(String(editForm.initial_balance).replace(',','.')),
      account_opened:!!editForm.account_opened,
    }
    try{
      const{error}=await supabase.from('crm_contacts').update(payload).eq('id',contactId)
      if(error)throw error
      logActivity(user.id,contactId,'nota_agregada','Datos del contacto actualizados',{})
      load()
      setEditingContact(null)
      if(selected?.id===contactId)setSelected(p=>({...p,...payload}))
    }catch(e){console.error('saveContactEdit:',e);setMovErr('')}
  }

  const openEditContact=(c)=>{
    setEditingContact(c.id)
    setEditForm({
      full_name:c.full_name||'',email:c.email||'',phone:c.phone||'',address:c.address||'',status:c.status||'activo',
      birth_date:c.birth_date||'',profession:c.profession||'',
      account_opened:!!c.account_opened,account_opened_at:c.account_opened_at||'',
      account_kind:c.account_kind||'',broker:c.broker||'',account_number:c.account_number||'',
      initial_balance:c.initial_balance??'',managed_type:c.managed_type||'',
    })
  }

  // Parser mejorado: detecta separador automáticamente (coma, tab, punto y coma),
  // soporta comillas dobles, columna 'notas' opcional. Acepta .csv y .txt
  const parseCSV=text=>{
    const trimmed=text.trim()
    if(!trimmed)return{rows:[],errors:['Archivo vacío']}
    const lines=trimmed.split(/\r?\n/)
    if(lines.length<2)return{rows:[],errors:['El archivo debe tener encabezado y al menos una fila']}
    // Detectar separador por frecuencia en la primera línea
    const firstLine=lines[0]
    const seps=[
      {sep:'\t',count:(firstLine.match(/\t/g)||[]).length},
      {sep:',', count:(firstLine.match(/,/g)||[]).length},
      {sep:';', count:(firstLine.match(/;/g)||[]).length},
    ].sort((a,b)=>b.count-a.count)
    const sep=seps[0].count>0?seps[0].sep:','
    // Parsea una línea respetando comillas dobles (RFC 4180-ish)
    const parseLine=line=>{
      const out=[];let cur='';let q=false
      for(let i=0;i<line.length;i++){
        const c=line[i]
        if(c==='"'){
          if(q&&line[i+1]==='"'){cur+='"';i++}
          else q=!q
        }else if(c===sep&&!q){out.push(cur.trim());cur=''}
        else cur+=c
      }
      out.push(cur.trim())
      return out
    }
    const headers=parseLine(lines[0]).map(h=>h.toLowerCase().replace(/['"]/g,''))
    const ni=headers.findIndex(h=>/nombre|name|full_name/.test(h))
    const ei=headers.findIndex(h=>/correo|email|mail/.test(h))
    const pi=headers.findIndex(h=>/tel|phone|movil|móvil|fono/.test(h))
    const ai=headers.findIndex(h=>/dir|address|direccion|domicilio/.test(h))
    const noi=headers.findIndex(h=>/nota|note|comentario|observ/.test(h))
    const errs=[]
    if(ni<0)errs.push('Columna "nombre" no encontrada')
    if(ei<0)errs.push('Columna "correo/email" no encontrada')
    if(pi<0)errs.push('Columna "telefono" no encontrada')
    if(errs.length)return{rows:[],errors:errs}
    const rows=[]
    lines.slice(1).forEach((line,i)=>{
      if(!line.trim())return // ignorar líneas vacías
      const cols=parseLine(line)
      const n=cols[ni]||''
      const e=(cols[ei]||'').toLowerCase()
      // El CSV puede traer '+56 9 1234 5678'; se guarda siempre en dígitos
      const p=soloDigitos(cols[pi]||'')
      if(!n||!e||!p){errs.push(`Fila ${i+2}: faltan campos requeridos`);return}
      rows.push({
        full_name:n,
        email:e,
        phone:p,
        address:ai>=0?(cols[ai]||''):'',
        notes:noi>=0?(cols[noi]||''):'',
        status:'activo',
        source:'csv',
      })
    })
    return{rows,errors:errs}
  }

  const handleCSVFile=async file=>{
    if(!file)return
    const text=await file.text()
    const{rows,errors}=parseCSV(text)
    setCsvErrors(errors);setCsvDone(null)
    if(!rows.length){setCsvRows([]);setCsvNew([]);setCsvDuplicates([]);setDupReviewIdx(-1);return}
    // Detectar duplicados por email contra crm_contacts del usuario
    const emails=rows.map(r=>r.email)
    const{data:existing}=await supabase
      .from('crm_contacts')
      .select('id,full_name,email,phone,address,notes,user_id')
      .in('email',emails)
      .eq('user_id',user.id)
    const existingMap=new Map((existing||[]).map(c=>[(c.email||'').toLowerCase(),c]))
    const newRows=[]
    const dups=[]
    for(const r of rows){
      const ex=existingMap.get(r.email.toLowerCase())
      if(ex)dups.push({row:r,existing:ex,decision:null})
      else newRows.push(r)
    }
    setCsvRows(rows);setCsvNew(newRows);setCsvDuplicates(dups)
    setDupReviewIdx(dups.length>0?0:-1)
  }

  // Aplica una decisión al duplicado en revisión y avanza al siguiente
  const decideDup=(decision)=>{
    setCsvDuplicates(prev=>{
      const next=[...prev]
      if(dupReviewIdx>=0&&dupReviewIdx<next.length){
        next[dupReviewIdx]={...next[dupReviewIdx],decision}
      }
      return next
    })
    // Avanzar al siguiente pendiente
    setDupReviewIdx(prev=>{
      const next=prev+1
      return next<csvDuplicates.length?next:-1
    })
  }

  const importCSV=async()=>{
    if(!csvRows.length)return
    // Verificar que todos los duplicados tengan decisión
    const pending=csvDuplicates.filter(d=>!d.decision)
    if(pending.length>0){
      setCsvErrors([`Tienes ${pending.length} duplicado(s) pendiente(s) de revisar.`])
      setDupReviewIdx(csvDuplicates.findIndex(d=>!d.decision))
      return
    }
    // El grupo nuevo se valida antes de tocar nada: si falla después, los
    // contactos ya estarían dentro y el error llegaría tarde.
    if(importGroupId==='nuevo'&&!importGroupNew.name.trim()){
      setCsvErrors(['Indica el nombre del grupo nuevo, o elige «Sin grupo».'])
      return
    }
    setCsvImporting(true);setCsvErrors([])
    let inserted=0,updated=0,skipped=0
    const insertedRows=[]
    try{
      // 1) Insertar nuevos (sin duplicado) + los que el usuario marcó como duplicado-permitido
      const toInsert=[
        ...csvNew.map(r=>({...r,user_id:user.id})),
        ...csvDuplicates.filter(d=>d.decision==='duplicate').map(d=>({...d.row,user_id:user.id})),
      ]
      if(toInsert.length){
        const{data,error}=await supabase.from('crm_contacts').insert(toInsert).select()
        if(error)throw error
        inserted=data?.length||0
        insertedRows.push(...(data||[]))
      }
      // 2) Actualizar duplicados con decision='update' — solo campos vacíos del existente (regla A)
      const toUpdate=csvDuplicates.filter(d=>d.decision==='update')
      for(const d of toUpdate){
        const patch={}
        if(!d.existing.full_name && d.row.full_name) patch.full_name=d.row.full_name
        if(!d.existing.phone     && d.row.phone)     patch.phone=d.row.phone
        if(!d.existing.address   && d.row.address)   patch.address=d.row.address
        if(!d.existing.notes     && d.row.notes)     patch.notes=d.row.notes
        if(Object.keys(patch).length===0)continue
        const{error:e}=await supabase.from('crm_contacts').update(patch).eq('id',d.existing.id)
        if(!e)updated++
      }
      // 3) Contar skipped
      skipped=csvDuplicates.filter(d=>d.decision==='skip').length
      // 4) Grupo destino. El grupo nuevo se crea recién aquí, con la
      //    importación ya hecha, para no dejar grupos vacíos si se cancela.
      let grupoTxt=''
      if(importGroupId){
        let gid=importGroupId
        let nombreG=groups.find(g=>g.id===importGroupId)?.name||''
        if(importGroupId==='nuevo'){
          nombreG=importGroupNew.name.trim()
          const{data:g,error:ge}=await supabase.from('crm_contact_groups')
            .insert({name:nombreG,description:'Creado al importar un archivo de contactos',color:importGroupNew.color,user_id:user.id})
            .select().single()
          if(ge)throw new Error(ge.code==='23505'
            ?`Los contactos se importaron, pero ya tienes un grupo llamado «${nombreG}»: agrégalos desde 🗂 Grupos.`
            :ge.message)
          gid=g.id
        }
        const ids=[
          ...insertedRows.map(r=>r.id),
          ...(importGroupUpdated?csvDuplicates.filter(d=>d.decision==='update').map(d=>d.existing.id):[]),
        ]
        if(ids.length){
          // Por la RPC: el alta queda registrada en el historial de grupos
          const{data:res,error:re}=await supabase.rpc('transfer_contacts_between_groups',{
            p_contact_ids:ids,p_from_group:null,p_to_group:gid,
            p_note:'Alta por importación de archivo',p_copiar:false,
          })
          if(re)throw re
          grupoTxt=` · ${res?.movidos||0} en «${nombreG}»`
        }
        await loadGroups()
        setImportGroupId('');setImportGroupNew({name:'',color:GROUP_COLORS[0]})
      }
      // 5) Refrescar lista
      if(insertedRows.length)setContacts(p=>[...insertedRows,...p])
      if(updated>0)await load() // recargar para reflejar updates
      setCsvDone(`✓ ${inserted} nuevos · ${updated} actualizados · ${skipped} omitidos${grupoTxt}`)
      setCsvRows([]);setCsvNew([]);setCsvDuplicates([]);setDupReviewIdx(-1)
    }catch(e){
      setCsvErrors([e.message||'Error al importar'])
    }finally{
      setCsvImporting(false)
    }
  }

  const getAdvisorName=uid=>staffList.find(s=>s.user_id===uid)?.display_name||'Asesor'

  return <div>
    <SHdr title={isSuperAdmin?'Todos los Contactos':'Mis Contactos'}
      sub={isSuperAdmin?`${filtered.length} de ${contacts.length} · CRM + formularios web`:`${contacts.length} contactos propios`}
      action={<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn variant="ghost" onClick={()=>load()} style={{fontSize:11,padding:'6px 10px'}} title="Recargar contactos">⟳ Recargar</Btn>
        <Btn variant="ghost" onClick={()=>setShowGroups(true)} style={{fontSize:11,padding:'6px 10px'}} title="Crear y administrar grupos de contactos">🗂 Grupos ({groups.length})</Btn>
        {isSuperAdmin&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <Btn variant="ghost" onClick={()=>exportContactsCSV(filtered)} style={{fontSize:11,padding:'6px 10px'}}>⬇ CSV</Btn>
          <Btn variant="ghost" onClick={()=>exportContactsExcel(filtered)} style={{fontSize:11,padding:'6px 10px'}}>⬇ Excel</Btn>
          <Btn variant="ghost" onClick={()=>exportContactsHTML(filtered)} style={{fontSize:11,padding:'6px 10px'}}>⬇ HTML</Btn>
          <Btn onClick={()=>exportContactsPDF(filtered,LOGO_URI)} style={{fontSize:11,padding:'6px 10px',background:'linear-gradient(135deg,#0a1f5c,#2563eb)',color:'#fff',border:'none'}}>⬇ PDF</Btn>
        </div>}
        {isSuperAdmin&&contacts.filter(c=>c._origStatus==='new').length>0&&<Btn variant="ghost" onClick={async()=>{
          const newIds=contacts.filter(c=>c._origStatus==='new'&&c.id.startsWith('sub_')).map(c=>c.id.replace('sub_',''))
          if(!newIds.length)return
          await supabase.from('contact_submissions').update({status:'read'}).in('id',newIds)
          setContacts(p=>p.map(c=>c._origStatus==='new'?{...c,status:'activo',_origStatus:'read'}:c))
        }} style={{fontSize:12}}>✓ Marcar todos leídos ({contacts.filter(c=>c._origStatus==='new').length})</Btn>}
        <Btn variant="ghost" onClick={()=>setTab(tab==='csv'?'lista':'csv')}>📂 CSV</Btn>
        <Btn onClick={()=>setTab(tab==='nuevo'?'lista':'nuevo')}>+ Nuevo</Btn>
      </div>}/>

    {tab==='nuevo'&&<GlassCard accent={P.purple} style={{marginBottom:20}}>
      <p style={{fontWeight:700,color:P.text,marginBottom:18,margin:'0 0 18px'}}>Nuevo contacto</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        {[['full_name','Nombre completo *','Juan García'],['email','Email *','juan@empresa.com'],['phone','Móvil *','56912345678']].map(([f,l,p])=>(
          <div key={f}>
            <Lbl>{l}</Lbl>
            <Input value={form[f]} onChange={v=>setForm(x=>({...x,[f]:v}))} placeholder={p} type={f==='email'?'email':'text'}
              style={formErr[f]?{border:`1px solid ${P.red}`}:{}}/>
            {formErr[f]&&<p style={{fontSize:11,color:P.red,marginTop:3,margin:'3px 0 0'}}>{formErr[f]}</p>}
          </div>
        ))}
        <div><Lbl>Estado</Lbl><Sel value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={STATUS_OPT}/></div>
        <div style={{gridColumn:'1/-1'}}><Lbl>Dirección (opcional)</Lbl><Input value={form.address} onChange={v=>setForm(p=>({...p,address:v}))} placeholder="Av. Ejemplo 123"/></div>
        <div style={{gridColumn:'1/-1'}}><Lbl>Notas (opcional)</Lbl>
          <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notas internas..."
            style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:10,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:60,resize:'vertical',fontFamily:'inherit'}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <Btn variant="ghost" onClick={()=>setTab('lista')}>Cancelar</Btn>
        <Btn onClick={saveContact} disabled={saving}>{saving?'Guardando...':'Guardar'}</Btn>
      </div>
    </GlassCard>}

    {tab==='csv'&&<GlassCard accent={P.blue} style={{marginBottom:20}}>
      <p style={{fontWeight:700,color:P.text,marginBottom:6,margin:'0 0 6px'}}>Importar contactos (CSV o TXT)</p>
      <p style={{fontSize:12,color:P.muted,marginBottom:14,margin:'0 0 14px'}}>Columnas requeridas: <strong style={{color:P.text}}>nombre, correo, telefono</strong> · opcionales: <strong style={{color:P.text}}>direccion, notas</strong>. Separador detectado automáticamente (coma, tab, punto y coma).</p>
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <button onClick={()=>{const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent('nombre,correo,telefono,direccion,notas\nJuan García,juan@ejemplo.com,56912345678,Av. Ejemplo 123,Cliente referido\nMaría López,maria@ejemplo.com,56987654321,,Interesada en PAMM');a.download='plantilla_contactos.csv';a.click()}}
          style={{fontSize:12,color:P.blue,background:P.blueDim,border:`1px solid ${P.blue}30`,borderRadius:6,padding:'5px 12px',cursor:'pointer'}}>⬇ Plantilla CSV</button>
        <button onClick={()=>{const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent('nombre\tcorreo\ttelefono\tdireccion\tnotas\nJuan García\tjuan@ejemplo.com\t56912345678\tAv. Ejemplo 123\tCliente referido\nMaría López\tmaria@ejemplo.com\t56987654321\t\tInteresada en PAMM');a.download='plantilla_contactos.txt';a.click()}}
          style={{fontSize:12,color:P.blue,background:P.blueDim,border:`1px solid ${P.blue}30`,borderRadius:6,padding:'5px 12px',cursor:'pointer'}}>⬇ Plantilla TXT</button>
      </div>

      {/* Grupo destino: se elige (o se crea) ANTES de importar, para no tener
          que ir a buscar después los 200 contactos recién cargados. */}
      <div style={{marginBottom:14,padding:'12px 14px',background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:10}}>
        <Lbl>Grupo destino de esta importación</Lbl>
        <Sel value={importGroupId} onChange={v=>{setImportGroupId(v);setGroupErr('')}} style={{maxWidth:340}}
          options={[
            {value:'',label:'Sin grupo — sólo cargar los contactos'},
            ...groups.map(g=>({value:g.id,label:`Añadir a: ${g.name}`})),
            {value:'nuevo',label:'➕ Crear un grupo nuevo…'},
          ]}/>
        {importGroupId==='nuevo'&&<div style={{marginTop:10}}>
          <Input value={importGroupNew.name} onChange={v=>setImportGroupNew(p=>({...p,name:v}))}
            placeholder="Nombre del grupo nuevo (ej: Webinar Agosto)" style={{maxWidth:340,marginBottom:8}}/>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {GROUP_COLORS.map(col=>(
              <button key={col} onClick={()=>setImportGroupNew(p=>({...p,color:col}))}
                style={{width:22,height:22,borderRadius:'50%',background:col,cursor:'pointer',
                  border:importGroupNew.color===col?'2px solid #fff':'2px solid transparent'}}/>
            ))}
          </div>
          <p style={{fontSize:11,color:P.muted,margin:'8px 0 0'}}>El grupo se crea al pulsar Importar, no antes: si cancelas no queda un grupo vacío dando vueltas.</p>
        </div>}
        {importGroupId&&<button onClick={()=>setImportGroupUpdated(v=>!v)}
          style={{display:'flex',alignItems:'center',gap:8,marginTop:10,background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>
          <span style={{fontSize:13,color:importGroupUpdated?P.green:P.muted}}>{importGroupUpdated?'☑':'☐'}</span>
          <span style={{fontSize:12,color:P.textSub}}>Agregar al grupo también los contactos que ya existían y decidiste actualizar</span>
        </button>}
      </div>
      <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);handleCSVFile(e.dataTransfer.files[0])}}
        style={{border:`2px dashed ${dragOver?P.blue:P.border}`,borderRadius:10,padding:'20px',textAlign:'center',background:dragOver?P.blueDim:'rgba(255,255,255,0.02)',cursor:'pointer',marginBottom:12}}
        onClick={()=>document.getElementById('csvInput').click()}>
        <p style={{fontSize:14,color:P.textSub,margin:0}}>📂 Arrastra tu CSV o TXT, o <span style={{color:P.blue,fontWeight:600}}>haz clic</span></p>
        <input id="csvInput" type="file" accept=".csv,.txt,text/csv,text/plain" style={{display:'none'}} onChange={e=>handleCSVFile(e.target.files[0])}/>
      </div>
      {csvErrors.length>0&&<div style={{marginBottom:10,padding:'10px',background:P.redDim,borderRadius:8}}>{csvErrors.map((e,i)=><p key={i} style={{fontSize:12,color:P.red,margin:'2px 0'}}>{e}</p>)}</div>}
      {csvRows.length>0&&<div>
        {/* Resumen del análisis */}
        <div style={{display:'flex',gap:10,marginBottom:10,flexWrap:'wrap'}}>
          <span style={{fontSize:11,color:P.muted,background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:6,padding:'4px 10px'}}>Total leídos: <strong style={{color:P.text}}>{csvRows.length}</strong></span>
          <span style={{fontSize:11,color:P.green,background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:6,padding:'4px 10px'}}>Nuevos: <strong>{csvNew.length}</strong></span>
          {csvDuplicates.length>0&&(()=>{
            const pendCount=csvDuplicates.filter(d=>!d.decision).length
            return <span style={{fontSize:11,color:pendCount>0?P.orange:P.purple,background:pendCount>0?'rgba(253,150,68,0.10)':P.purpleDim,border:`1px solid ${pendCount>0?'rgba(253,150,68,0.30)':'rgba(108,92,231,0.30)'}`,borderRadius:6,padding:'4px 10px'}}>Duplicados: <strong>{csvDuplicates.length}</strong>{pendCount>0?` (${pendCount} sin revisar)`:''}</span>
          })()}
        </div>
        {/* Botón para revisar duplicados pendientes */}
        {csvDuplicates.filter(d=>!d.decision).length>0&&<div style={{marginBottom:10,padding:'10px 14px',background:'rgba(253,150,68,0.10)',border:`1px solid rgba(253,150,68,0.30)`,borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <p style={{fontSize:12,color:P.orange,margin:0,fontWeight:600}}>⚠ Hay {csvDuplicates.filter(d=>!d.decision).length} contacto(s) que ya existen. Revísalos uno a uno antes de importar.</p>
          <Btn variant="ghost" onClick={()=>setDupReviewIdx(csvDuplicates.findIndex(d=>!d.decision))} style={{fontSize:12,padding:'6px 12px'}}>Revisar duplicados →</Btn>
        </div>}
        {csvDone&&<div style={{marginBottom:10,padding:'8px 12px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}><p style={{fontSize:13,color:P.green,margin:0}}>{csvDone}</p></div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>{setCsvRows([]);setCsvNew([]);setCsvDuplicates([]);setDupReviewIdx(-1);setCsvErrors([]);setCsvDone(null)}}>Cancelar</Btn>
          <Btn variant="blue" onClick={importCSV} disabled={csvImporting||csvDuplicates.some(d=>!d.decision)}>{csvImporting?'Importando...':`Importar (${csvNew.length} nuevos + ${csvDuplicates.filter(d=>d.decision==='update').length} actualizar + ${csvDuplicates.filter(d=>d.decision==='duplicate').length} duplicar)`}</Btn>
        </div>
      </div>}
    </GlassCard>}

    {/* Modal: revisión de duplicado por contacto */}
    {dupReviewIdx>=0&&dupReviewIdx<csvDuplicates.length&&(()=>{
      const d=csvDuplicates[dupReviewIdx]
      const totalPending=csvDuplicates.filter(x=>!x.decision).length
      const fields=[['full_name','Nombre'],['phone','Teléfono'],['address','Dirección'],['notes','Notas']]
      return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:20}}
        onClick={()=>setDupReviewIdx(-1)}>
        <div style={{background:'#1a1c2e',border:'1px solid rgba(255,255,255,0.10)',borderRadius:14,padding:22,width:'100%',maxWidth:640,maxHeight:'90vh',overflow:'auto',display:'flex',flexDirection:'column',gap:14}}
          onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
            <div>
              <p style={{margin:0,fontSize:15,fontWeight:700,color:P.text}}>Duplicado detectado por email</p>
              <p style={{margin:'2px 0 0',fontSize:11,color:P.muted}}>Revisando {dupReviewIdx+1} de {csvDuplicates.length} · {totalPending} pendiente(s)</p>
            </div>
            <button onClick={()=>setDupReviewIdx(-1)} style={{background:'none',border:'none',color:P.muted,fontSize:18,cursor:'pointer',lineHeight:1,padding:0}}>✕</button>
          </div>
          <div style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:10,padding:'10px 14px'}}>
            <p style={{margin:0,fontSize:12,color:P.muted}}>Email:</p>
            <p style={{margin:'2px 0 0',fontSize:14,color:P.text,fontWeight:600,fontFamily:'monospace'}}>{d.row.email}</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {/* Existente */}
            <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:10,padding:14}}>
              <p style={{margin:'0 0 10px',fontSize:11,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>📋 Existente</p>
              {fields.map(([f,l])=>(
                <div key={f} style={{marginBottom:8}}>
                  <p style={{margin:0,fontSize:10,color:P.muted}}>{l}</p>
                  <p style={{margin:'2px 0 0',fontSize:12,color:d.existing[f]?P.text:P.muted,fontStyle:d.existing[f]?'normal':'italic',wordBreak:'break-word'}}>{d.existing[f]||'(vacío)'}</p>
                </div>
              ))}
            </div>
            {/* Nuevo del CSV */}
            <div style={{background:'rgba(108,92,231,0.08)',border:`1px solid rgba(108,92,231,0.25)`,borderRadius:10,padding:14}}>
              <p style={{margin:'0 0 10px',fontSize:11,color:P.purple,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>📥 Nuevo (del archivo)</p>
              {fields.map(([f,l])=>{
                const willFill=d.existing && !d.existing[f] && d.row[f]
                return <div key={f} style={{marginBottom:8}}>
                  <p style={{margin:0,fontSize:10,color:P.muted}}>{l}</p>
                  <p style={{margin:'2px 0 0',fontSize:12,color:d.row[f]?P.text:P.muted,fontStyle:d.row[f]?'normal':'italic',wordBreak:'break-word'}}>
                    {d.row[f]||'(vacío)'}
                    {willFill&&<span style={{marginLeft:6,fontSize:9,color:P.green,background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:4,padding:'1px 5px'}}>llenaría existente</span>}
                  </p>
                </div>
              })}
            </div>
          </div>
          <div style={{borderTop:`1px solid ${P.border}`,paddingTop:14,display:'flex',flexDirection:'column',gap:8}}>
            <p style={{margin:'0 0 4px',fontSize:11,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>¿Qué hacemos con este duplicado?</p>
            <Btn variant="ghost" onClick={()=>decideDup('skip')} style={{justifyContent:'flex-start',padding:'10px 14px',textAlign:'left'}}>
              <div>
                <div style={{fontSize:13,color:P.text,fontWeight:600}}>⊘ Omitir</div>
                <div style={{fontSize:11,color:P.muted,marginTop:2}}>No hacer nada con este contacto. El existente queda igual.</div>
              </div>
            </Btn>
            <Btn variant="ghost" onClick={()=>decideDup('update')} style={{justifyContent:'flex-start',padding:'10px 14px',textAlign:'left'}}>
              <div>
                <div style={{fontSize:13,color:P.green,fontWeight:600}}>✏ Actualizar — solo campos vacíos del existente</div>
                <div style={{fontSize:11,color:P.muted,marginTop:2}}>Llenar los campos que están vacíos en el existente con los datos del archivo (no sobrescribe nada lleno).</div>
              </div>
            </Btn>
            <Btn variant="ghost" onClick={()=>decideDup('duplicate')} style={{justifyContent:'flex-start',padding:'10px 14px',textAlign:'left'}}>
              <div>
                <div style={{fontSize:13,color:P.orange,fontWeight:600}}>+ Crear nuevo (permitir duplicado)</div>
                <div style={{fontSize:11,color:P.muted,marginTop:2}}>Insertar un nuevo contacto aunque ya exista uno con este email. No recomendado.</div>
              </div>
            </Btn>
          </div>
        </div>
      </div>
    })()}

    {/* KPIs del asesor. Los calcula la RPC sales_kpis() en SQL, no el navegador. */}
    {tab==='lista'&&<SalesMetrics user={user} isSuperAdmin={isSuperAdmin} staffProfile={staffProfile} staffList={staffList}/>}

    <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
      <Input value={search} onChange={setSearch} placeholder="Buscar nombre, email o teléfono..." style={{maxWidth:300}}/>
      <Sel value={statusFilter} onChange={setStatusFilter} style={{maxWidth:160}} options={[{value:'todos',label:'Todos (incl. spam)'},{value:'activos',label:'Activos (excl. spam)'},...STATUS_OPT]}/>
      <Sel value={tipoFilter} onChange={setTipoFilter} style={{maxWidth:150}}
        options={[{value:'todos',label:'P2P y B2B'},{value:'P2P',label:'Sólo personas'},{value:'B2B',label:'Sólo empresas'}]}/>
      {/* "Sin cerrar" es el filtro del día a día: deja a la vista lo que todavía
          se puede mover, que es donde el asesor tiene que poner el foco. */}
      <Sel value={stageFilter} onChange={setStageFilter} style={{maxWidth:190}}
        options={[{value:'todos',label:'Todas las etapas'},{value:'pendientes',label:'Sin cerrar'},
          ...SALES_STAGES.map(s=>({value:s.id,label:s.label}))]}/>
      {isSuperAdmin&&staffList.length>0&&<Sel value={userFilter} onChange={setUserFilter} style={{maxWidth:200}} options={[{value:'todos',label:'Todos los asesores'},...staffList.map(s=>({value:s.user_id,label:s.display_name}))]}/>}
      {groups.length>0&&<Sel value={groupFilter} onChange={setGroupFilter} style={{maxWidth:200}} options={[{value:'todos',label:'Todos los grupos'},...groups.map(g=>({value:g.id,label:`${g.name} (${Object.values(memberships).filter(ids=>ids.includes(g.id)).length})`}))]}/>}
      {/* Fecha de creación: el caso del día a día es "qué cargué hoy" */}
      <Sel value={dateFilter} onChange={v=>{setDateFilter(v);setAgrupaMsg(null)}} style={{maxWidth:170}} options={RANGOS_FECHA}/>
      <Btn variant="ghost" onClick={load} style={{padding:'9px 12px'}}>↺</Btn>
    </div>

    {/* Convertir el recorte por fecha en un grupo de verdad, de una pasada */}
    {tab==='lista'&&dateFilter!=='todos'&&<div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:16,padding:'10px 14px',
      background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:10}}>
      <span style={{fontSize:12,color:P.text}}>
        <strong>{nuevosDelRango}</strong> contacto{nuevosDelRango!==1?'s':''} {dateFilter==='hoy'?'creado(s) hoy':`en los últimos ${dateFilter==='7d'?7:30} días`}
      </span>
      <Btn variant="ghost" onClick={agruparDelRango} disabled={agrupando||!nuevosDelRango} style={{fontSize:11,padding:'6px 12px'}}
        title="Crea (o reutiliza) el grupo del día y agrega estos contactos">
        {agrupando?'Agrupando…':`🗂 Agrupar en «${dateFilter==='hoy'?nombreGrupoDia():`${nombreGrupoDia()} (${dateFilter==='7d'?'7':'30'} días)`}»`}
      </Btn>
      {agrupaMsg&&<span style={{fontSize:11.5,color:agrupaMsg.type==='ok'?P.green:P.red}}>{agrupaMsg.text}</span>}
    </div>}

    {loading?<Spinner/>:<GlassCard style={{padding:0}}>
      <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
        <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
          {[...(isSuperAdmin?['Asesor']:[]),(isSuperAdmin?'Capital':''),'Nombre','Email','Teléfono','Etapa','Estado','Origen',''].filter(Boolean).map(h=>(
            <th key={h} style={{padding:'12px 18px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {filtered.map((c,i)=>(
            <tr key={c.id} style={{borderBottom:i<filtered.length-1?`1px solid ${P.border}`:'none',cursor:'pointer',transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              onClick={()=>openContact(c)}>
              {isSuperAdmin&&<td style={{padding:'12px 18px'}} onClick={e=>e.stopPropagation()}>
                {editingAssignee===c.id?(
                  <select value={assigneeValue} onChange={e=>handleAssigneeChange(c.id,e.target.value)} onBlur={()=>setEditingAssignee(null)} autoFocus
                    style={{padding:'5px 8px',borderRadius:6,background:'rgba(255,255,255,0.1)',border:`1px solid ${P.purpleBorder}`,color:P.text,fontSize:11,fontFamily:'inherit',maxWidth:140}}>
                    <option value="">Sin asignar</option>
                    {staffList.map(s=><option key={s.user_id} value={s.user_id}>{s.display_name}</option>)}
                  </select>
                ):(
                  <span onClick={()=>{setEditingAssignee(c.id);setAssigneeValue(c.user_id||'')}}
                    style={{fontSize:11,color:P.purple,background:P.purpleDim,borderRadius:4,padding:'2px 8px',cursor:'pointer',textDecoration:'underline dotted',textUnderlineOffset:2}}>
                    {c.user_id?getAdvisorName(c.user_id):'Web'}
                  </span>
                )}
              </td>}
              {isSuperAdmin&&<td style={{padding:'12px 18px',fontSize:12,color:P.green,fontFamily:'monospace',fontWeight:600}}>{c._capital>0?fmt(c._capital):'—'}</td>}
              <td style={{padding:'12px 18px'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:30,height:30,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:P.purple,flexShrink:0}}>{(c.full_name||'?')[0]}</div>
                  <span style={{fontSize:13,fontWeight:600,color:P.text}}>{c.full_name}</span>
                </div>
              </td>
              <td style={{padding:'12px 18px',color:P.muted,fontSize:12,fontFamily:'monospace'}}>{c.email}</td>
              <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <span>{c.phone}</span>
                  {optOuts.has(soloDigitos(c.phone))&&<Badge label="no contactar" color={P.red}/>}
                </div>
              </td>
              {/* Etapa comercial. Los formularios web (sub_) no tienen fila real
                  en crm_contacts, así que no tienen etapa que mostrar. */}
              <td style={{padding:'12px 18px'}}>
                {String(c.id).startsWith('sub_')
                  ?<span style={{fontSize:11,color:P.muted}}>—</span>
                  :<div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
                    <Badge label={SALES_STAGE_LABEL[c.sales_stage||'PROSPECTO']||'Prospecto'} color={SALES_STAGE_COLOR[c.sales_stage||'PROSPECTO']||P.muted}/>
                    {(c.contact_type||'P2P')==='B2B'&&<Badge label="B2B" color={TIPO_COLOR.B2B}/>}
                   </div>}
              </td>
              <td style={{padding:'12px 18px'}}><Badge label={c.status} color={SCOLOR_MAP[c.status]||P.muted}/></td>
              <td style={{padding:'12px 18px'}}><div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}><Badge label={c.source||'crm'} color={c.source==='csv'?P.blue:c.source==='formulario'?P.orange:P.muted}/>{c._origStatus==='new'&&<Badge label="nuevo" color={P.orange}/>}</div></td>
              <td style={{padding:'12px 18px'}}><div style={{display:'flex',gap:4,alignItems:'center'}}><Btn variant="ghost" style={{padding:'4px 10px',fontSize:11}}>Ver →</Btn>{isSuperAdmin&&!c.id.startsWith('sub_')&&c.phone&&<button onClick={e=>{e.stopPropagation();setWaContact(c)}} title="Enviar plantilla de WhatsApp (WABA)"
                  style={{padding:'4px 9px',borderRadius:7,background:P.greenDim,border:`1px solid ${P.green}40`,color:P.green,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>💬 WABA</button>}{staffProfile?.referral_code&&<span onClick={e=>e.stopPropagation()}><WAFinanceInviteButton advisorCode={staffProfile.referral_code} advisorName={staffProfile.display_name||''} leadName={c.full_name||''} leadPhone={c.phone||''} compact/></span>}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {filtered.length===0&&<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>{contacts.length===0?'Aún no tienes contactos. Añade uno o importa un CSV.':'Sin resultados.'}</div>}
    </GlassCard>}

    {/* Envío de plantilla WABA — sólo super admin. start_chat valida el rol
        en el backend y auto-asigna el chat, así que la conversación queda en
        la bandeja como cualquier otra. */}
    {waContact&&<StartChatModal contact={waContact} onClose={()=>setWaContact(null)}
      onStarted={c=>{
        logActivity(user.id,c.id,'whatsapp_chat',`Plantilla de WhatsApp enviada a ${c.full_name||c.phone}`,{})
        if(selected?.id===c.id)setActivities(p=>[{id:Date.now().toString(),activity_type:'whatsapp_chat',description:'Plantilla de WhatsApp enviada',created_at:new Date().toISOString()},...p])
      }}/>}

    {showGroups&&<Modal title="Grupos de contactos" onClose={()=>{setShowGroups(false);setManagingGroup(null);setEditingGroup(null);setGroupErr('');setGroupForm({name:'',description:'',color:GROUP_COLORS[0]});setTransferMode(false);setPicked([]);setTransferMsg(null)}}>
      {!managingGroup&&<div style={{display:'flex',gap:6,marginBottom:16,borderBottom:`1px solid ${P.border}`,paddingBottom:10}}>
        {[['grupos','🗂 Grupos'],['historial','📜 Historial de movimientos']].map(([k,l])=>(
          <button key={k} onClick={()=>setGroupTab(k)}
            style={{fontSize:12,fontWeight:600,padding:'6px 12px',borderRadius:8,cursor:'pointer',
              background:groupTab===k?P.purpleDim:'transparent',color:groupTab===k?P.purpleLight:P.muted,
              border:`1px solid ${groupTab===k?P.purpleBorder:'transparent'}`}}>{l}</button>
        ))}
      </div>}
      {managingGroup?(()=>{
        const g=groups.find(x=>x.id===managingGroup)
        if(!g)return null
        // Sólo contactos reales: los formularios web todavía no son crm_contacts
        const reales=contacts.filter(c=>!String(c.id).startsWith('sub_'))
        const q=groupSearch.trim().toLowerCase()
        // Mismos criterios que el listado principal: con cientos de contactos,
        // el buscador de texto solo no alcanza para armar un grupo.
        const coincide=c=>{
          if(q&&!`${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(q))return false
          const f=memberFilter
          if(f.estado!=='todos'&&!(f.estado==='activos'?c.status!=='inactivo':c.status===f.estado))return false
          if(f.tipo!=='todos'&&(c.contact_type||'P2P')!==f.tipo)return false
          if(f.etapa!=='todos'&&!(f.etapa==='pendientes'
            ?!String(c.sales_stage||'').startsWith('CERRADO')
            :c.sales_stage===f.etapa))return false
          const desde=desdeRango(f.fecha)
          if(desde&&!(c.created_at&&new Date(c.created_at)>=desde))return false
          if(f.asesor!=='todos'&&c.user_id!==f.asesor)return false
          if(f.grupo!=='todos'&&!(memberships[c.id]||[]).includes(f.grupo))return false
          return true
        }
        const esMiembro=c=>(memberships[c.id]||[]).includes(g.id)
        const miembros=reales.filter(esMiembro)
        const dentro=miembros.length
        const listaBase=reales.filter(coincide)
        // La pertenencia se aplica al final: los botones en bloque necesitan
        // saber cuántos del filtro faltan y cuántos ya están.
        const porAgregar=listaBase.filter(c=>!esMiembro(c))
        const porQuitar=listaBase.filter(esMiembro)
        const lista=memberFilter.pertenencia==='fuera'?porAgregar
          :memberFilter.pertenencia==='dentro'?porQuitar:listaBase
        // En modo traspaso sólo se ven los que están dentro: no se puede
        // trasladar desde un grupo a alguien que no pertenece a él.
        const listaMiembros=miembros.filter(coincide)
        const destinos=groups.filter(x=>x.id!==g.id)
        return <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
            <Btn variant="ghost" onClick={()=>{setManagingGroup(null);setGroupSearch('');setTransferMode(false);setPicked([]);setTransferMsg(null);setMemberFilter(MEMBER_FILTER_0);setBulkMsg(null)}} style={{fontSize:11,padding:'5px 10px'}}>← Volver</Btn>
            <span style={{width:10,height:10,borderRadius:'50%',background:g.color,flexShrink:0}}/>
            <span style={{fontSize:14,fontWeight:700,color:P.text}}>{g.name}</span>
            <span style={{fontSize:11,color:P.muted}}>{dentro} de {reales.length} contactos</span>
            <Btn variant="ghost" onClick={()=>{setTransferMode(v=>!v);setPicked([]);setGroupSearch('');setTransferMsg(null);setMemberFilter(MEMBER_FILTER_0);setBulkMsg(null)}}
              style={{fontSize:11,padding:'5px 10px',marginLeft:'auto',color:transferMode?P.purple:P.textSub}}
              title="Mover o copiar contactos de este grupo a otro, dejando historial">
              {transferMode?'✕ Salir del traspaso':'⇄ Traspasar a otro grupo'}
            </Btn>
          </div>

          {transferMode?<div>
            {destinos.length===0
              ?<p style={{fontSize:12,color:P.muted,fontStyle:'italic',margin:'0 0 12px'}}>Necesitas al menos otro grupo para poder traspasar. Crea uno desde «← Volver».</p>
              :<>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>
                  <Input value={groupSearch} onChange={setGroupSearch} placeholder="Buscar dentro del grupo..." style={{flex:1,minWidth:180}}/>
                  <Btn variant="ghost" onClick={()=>setPicked(listaMiembros.map(c=>c.id))} style={{fontSize:11,padding:'6px 10px'}}>Marcar todos ({listaMiembros.length})</Btn>
                  <Btn variant="ghost" onClick={()=>setPicked([])} style={{fontSize:11,padding:'6px 10px'}}>Ninguno</Btn>
                </div>
                <div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                  {listaMiembros.map(c=>{
                    const on=picked.includes(c.id)
                    return <button key={c.id} onClick={()=>setPicked(p=>on?p.filter(x=>x!==c.id):[...p,c.id])}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,cursor:'pointer',textAlign:'left',
                        background:on?P.purpleDim:'rgba(255,255,255,0.03)',border:`1px solid ${on?P.purpleBorder:P.border}`}}>
                      <span style={{fontSize:13,color:on?P.purpleLight:P.muted,flexShrink:0}}>{on?'☑':'☐'}</span>
                      <span style={{flex:1,minWidth:0}}>
                        <span style={{display:'block',fontSize:13,color:P.text,fontWeight:600}}>{c.full_name}</span>
                        <span style={{display:'block',fontSize:11,color:P.muted,fontFamily:'monospace'}}>{c.email}</span>
                      </span>
                    </button>
                  })}
                  {listaMiembros.length===0&&<p style={{fontSize:12,color:P.muted,fontStyle:'italic',padding:'12px 0',margin:0}}>Este grupo no tiene contactos que coincidan.</p>}
                </div>
                <div style={{borderTop:`1px solid ${P.border}`,paddingTop:12}}>
                  <Lbl>Grupo de destino</Lbl>
                  <Sel value={transferTo} onChange={setTransferTo} style={{marginBottom:8}}
                    options={[{value:'',label:'Elige el grupo de destino…'},...destinos.map(x=>({value:x.id,label:x.name}))]}/>
                  <Input value={transferNote} onChange={setTransferNote} placeholder="Motivo del traspaso (opcional, queda en el historial)" style={{marginBottom:8}}/>
                  <button onClick={()=>setTransferCopy(v=>!v)}
                    style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>
                    <span style={{fontSize:13,color:transferCopy?P.orange:P.muted}}>{transferCopy?'☑':'☐'}</span>
                    <span style={{fontSize:12,color:P.textSub}}>Copiar en vez de mover (los deja también en «{g.name}»)</span>
                  </button>
                  {transferMsg&&<p style={{fontSize:12,color:transferMsg.type==='ok'?P.green:P.red,margin:'0 0 10px'}}>{transferMsg.text}</p>}
                  <Btn onClick={doTransfer} disabled={transferring||!picked.length||!transferTo}>
                    {transferring?'Traspasando…':`${transferCopy?'Copiar':'Mover'} ${picked.length} contacto${picked.length!==1?'s':''}`}
                  </Btn>
                </div>
              </>}
          </div>:<>
          <Input value={groupSearch} onChange={setGroupSearch} placeholder="Buscar contacto para agregar o quitar..." style={{marginBottom:8}}/>

          {/* Filtros del listado: armar un grupo de 200 contactos a mano no es
              viable, así que se filtra igual que en la lista y se agrega en bloque. */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
            <Sel value={memberFilter.pertenencia} onChange={v=>setMemberFilter(p=>({...p,pertenencia:v}))} style={{maxWidth:165,flex:'1 1 130px'}}
              options={[{value:'todos',label:'Dentro y fuera'},{value:'fuera',label:'Sólo los que faltan'},{value:'dentro',label:'Sólo los del grupo'}]}/>
            <Sel value={memberFilter.fecha} onChange={v=>setMemberFilter(p=>({...p,fecha:v}))} style={{maxWidth:165,flex:'1 1 130px'}} options={RANGOS_FECHA}/>
            <Sel value={memberFilter.estado} onChange={v=>setMemberFilter(p=>({...p,estado:v}))} style={{maxWidth:165,flex:'1 1 130px'}}
              options={[{value:'todos',label:'Todos los estados'},{value:'activos',label:'Activos (excl. spam)'},...STATUS_OPT]}/>
            <Sel value={memberFilter.etapa} onChange={v=>setMemberFilter(p=>({...p,etapa:v}))} style={{maxWidth:165,flex:'1 1 130px'}}
              options={[{value:'todos',label:'Todas las etapas'},{value:'pendientes',label:'Sin cerrar'},...SALES_STAGES.map(s=>({value:s.id,label:s.label}))]}/>
            <Sel value={memberFilter.tipo} onChange={v=>setMemberFilter(p=>({...p,tipo:v}))} style={{maxWidth:165,flex:'1 1 130px'}}
              options={[{value:'todos',label:'P2P y B2B'},{value:'P2P',label:'Sólo personas'},{value:'B2B',label:'Sólo empresas'}]}/>
            {destinos.length>0&&<Sel value={memberFilter.grupo} onChange={v=>setMemberFilter(p=>({...p,grupo:v}))} style={{maxWidth:190,flex:'1 1 150px'}}
              options={[{value:'todos',label:'De cualquier grupo'},...destinos.map(x=>({value:x.id,label:`Que estén en: ${x.name}`}))]}/>}
            {isSuperAdmin&&staffList.length>0&&<Sel value={memberFilter.asesor} onChange={v=>setMemberFilter(p=>({...p,asesor:v}))} style={{maxWidth:190,flex:'1 1 150px'}}
              options={[{value:'todos',label:'Todos los asesores'},...staffList.map(s=>({value:s.user_id,label:s.display_name}))]}/>}
            {JSON.stringify(memberFilter)!==JSON.stringify(MEMBER_FILTER_0)&&
              <Btn variant="ghost" onClick={()=>{setMemberFilter(MEMBER_FILTER_0);setBulkMsg(null)}} style={{fontSize:11,padding:'8px 10px'}}>✕ Limpiar</Btn>}
          </div>

          {/* Aplicar a todo lo que coincide, sin ir uno por uno */}
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:12,padding:'9px 12px',
            background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8}}>
            <span style={{fontSize:11.5,color:P.textSub}}>
              {lista.length} coinciden · <strong style={{color:P.green}}>{porAgregar.length}</strong> fuera del grupo · <strong style={{color:g.color}}>{porQuitar.length}</strong> dentro
            </span>
            <div style={{display:'flex',gap:6,marginLeft:'auto',flexWrap:'wrap'}}>
              <Btn variant="ghost" onClick={()=>bulkMembership(g.id,porAgregar.map(c=>c.id),true)} disabled={bulkBusy||!porAgregar.length}
                style={{fontSize:11,padding:'6px 10px',color:porAgregar.length?P.green:P.muted}}>
                {bulkBusy?'…':`+ Agregar ${porAgregar.length}`}
              </Btn>
              <Btn variant="ghost" onClick={()=>bulkMembership(g.id,porQuitar.map(c=>c.id),false)} disabled={bulkBusy||!porQuitar.length}
                style={{fontSize:11,padding:'6px 10px',color:porQuitar.length?P.red:P.muted}}>
                {bulkBusy?'…':`− Quitar ${porQuitar.length}`}
              </Btn>
            </div>
            {bulkMsg&&<span style={{fontSize:11.5,color:bulkMsg.type==='ok'?P.green:P.red,width:'100%'}}>{bulkMsg.text}</span>}
          </div>
          <div style={{maxHeight:340,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
            {lista.map(c=>{
              const on=(memberships[c.id]||[]).includes(g.id)
              return <button key={c.id} onClick={()=>toggleMember(c.id,g.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,cursor:'pointer',textAlign:'left',
                  background:on?g.color+'18':'rgba(255,255,255,0.03)',border:`1px solid ${on?g.color+'55':P.border}`}}>
                <span style={{fontSize:13,color:on?g.color:P.muted,flexShrink:0}}>{on?'☑':'☐'}</span>
                <span style={{flex:1,minWidth:0}}>
                  <span style={{display:'block',fontSize:13,color:P.text,fontWeight:600}}>{c.full_name}</span>
                  <span style={{display:'block',fontSize:11,color:P.muted,fontFamily:'monospace'}}>{c.email}</span>
                </span>
              </button>
            })}
            {lista.length===0&&<p style={{fontSize:12,color:P.muted,fontStyle:'italic',padding:'12px 0',margin:0}}>Sin contactos que coincidan.</p>}
          </div></>}
        </div>
      })():groupTab==='historial'?(()=>{
        // Altas, bajas y traspasos. El asesor ve los de sus contactos; el SA todos.
        const trFiltered=transfers.filter(t=>{
          const f=new Date(t.moved_at)
          if(trFilter.desde&&f<new Date(`${trFilter.desde}T00:00:00`))return false
          if(trFilter.hasta&&f>new Date(`${trFilter.hasta}T23:59:59`))return false
          if(trFilter.grupo!=='todos'&&t.from_group_id!==trFilter.grupo&&t.to_group_id!==trFilter.grupo)return false
          return true
        })
        return <div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end',marginBottom:12}}>
            <div><Lbl>Desde</Lbl><Input type="date" value={trFilter.desde} onChange={v=>setTrFilter(p=>({...p,desde:v}))} style={{maxWidth:150}}/></div>
            <div><Lbl>Hasta</Lbl><Input type="date" value={trFilter.hasta} onChange={v=>setTrFilter(p=>({...p,hasta:v}))} style={{maxWidth:150}}/></div>
            <div style={{flex:1,minWidth:170}}><Lbl>Grupo (origen o destino)</Lbl>
              <Sel value={trFilter.grupo} onChange={v=>setTrFilter(p=>({...p,grupo:v}))}
                options={[{value:'todos',label:'Todos los grupos'},...groups.map(g=>({value:g.id,label:g.name}))]}/>
            </div>
            <Btn variant="ghost" onClick={loadTransfers} style={{fontSize:11,padding:'8px 12px'}}>⟳</Btn>
            <Btn variant="ghost" onClick={()=>exportTransfersCSV(trFiltered)} disabled={!trFiltered.length} style={{fontSize:11,padding:'8px 12px'}}>⬇ CSV</Btn>
          </div>
          {loadingTransfers?<Spinner/>:trFiltered.length===0
            ?<p style={{fontSize:12,color:P.muted,fontStyle:'italic',margin:'16px 0'}}>
              {transfers.length===0?'Todavía no hay movimientos registrados. Se anotan solos cada vez que un contacto entra, sale o se traspasa de grupo.':'Ningún movimiento en ese filtro.'}
            </p>
            :<div style={{maxHeight:400,overflowY:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
                  {['Fecha','Contacto','Origen','Destino','Acción'].map(h=>(
                    <th key={h} style={{padding:'8px 10px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,position:'sticky',top:0,background:P.surface}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {trFiltered.map(t=>(
                    <tr key={t.id} style={{borderBottom:`1px solid ${P.border}`}}>
                      <td style={{padding:'8px 10px',color:P.textSub,whiteSpace:'nowrap'}}>
                        {new Date(t.moved_at).toLocaleDateString('es-CL')}<br/>
                        <span style={{fontSize:10,color:P.muted}}>{new Date(t.moved_at).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</span>
                      </td>
                      <td style={{padding:'8px 10px'}}>
                        <span style={{color:P.text,fontWeight:600}}>{t.crm_contacts?.full_name||'—'}</span><br/>
                        <span style={{fontSize:10,color:P.muted,fontFamily:'monospace'}}>{t.crm_contacts?.email||''}</span>
                        {t.note&&<><br/><span style={{fontSize:10,color:P.muted,fontStyle:'italic'}}>{t.note}</span></>}
                      </td>
                      <td style={{padding:'8px 10px',color:t.from_group_name?P.textSub:P.muted}}>{t.from_group_name||'—'}</td>
                      <td style={{padding:'8px 10px',color:t.to_group_name?P.textSub:P.muted}}>{t.to_group_name||'—'}</td>
                      <td style={{padding:'8px 10px'}}>
                        <Badge label={ACCION_LABEL[t.action]||t.action}
                          color={t.action==='baja'?P.red:t.action==='alta'?P.green:t.action==='copiar'?P.orange:P.purple}/>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </div>
      })():<div>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
          {groups.map(g=>{
            const n=Object.values(memberships).filter(ids=>ids.includes(g.id)).length
            return <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:10}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:g.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:P.text}}>{g.name}</p>
                <p style={{margin:'2px 0 0',fontSize:11,color:P.muted}}>
                  {n} contacto{n!==1?'s':''}{g.description?` · ${g.description}`:''}
                  {isSuperAdmin&&g.user_id!==user.id?` · ${getAdvisorName(g.user_id)}`:''}
                </p>
              </div>
              <Btn variant="ghost" onClick={()=>{setManagingGroup(g.id);setGroupSearch('');setMemberFilter(MEMBER_FILTER_0);setBulkMsg(null);setTransferMode(false);setPicked([])}} style={{fontSize:11,padding:'5px 10px'}}>Contactos</Btn>
              <Btn variant="ghost" onClick={()=>{setEditingGroup(g.id);setGroupForm({name:g.name,description:g.description||'',color:g.color})}} style={{fontSize:11,padding:'5px 10px'}}>✏️</Btn>
              <Btn variant="ghost" onClick={()=>{if(confirmDeleteGroup===g.id)deleteGroup(g.id);else setConfirmDeleteGroup(g.id)}}
                style={{fontSize:11,padding:'5px 10px',color:confirmDeleteGroup===g.id?P.red:P.muted}}>
                {confirmDeleteGroup===g.id?'¿Seguro?':'🗑'}
              </Btn>
            </div>
          })}
          {groups.length===0&&<p style={{fontSize:12,color:P.muted,fontStyle:'italic',margin:0}}>Todavía no hay grupos. Crea el primero abajo.</p>}
        </div>
        <div style={{borderTop:`1px solid ${P.border}`,paddingTop:16}}>
          <Lbl>{editingGroup?'Editar grupo':'Nuevo grupo'}</Lbl>
          <Input value={groupForm.name} onChange={v=>setGroupForm(p=>({...p,name:v}))} placeholder="Nombre del grupo" style={{marginBottom:8}}/>
          <Input value={groupForm.description} onChange={v=>setGroupForm(p=>({...p,description:v}))} placeholder="Descripción (opcional)" style={{marginBottom:10}}/>
          <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
            {GROUP_COLORS.map(col=>(
              <button key={col} onClick={()=>setGroupForm(p=>({...p,color:col}))}
                style={{width:24,height:24,borderRadius:'50%',background:col,cursor:'pointer',
                  border:groupForm.color===col?'2px solid #fff':'2px solid transparent'}}/>
            ))}
          </div>
          {groupErr&&<p style={{fontSize:11,color:P.red,margin:'0 0 10px'}}>{groupErr}</p>}
          <div style={{display:'flex',gap:8}}>
            <Btn onClick={saveGroup}>{editingGroup?'Guardar cambios':'+ Crear grupo'}</Btn>
            {editingGroup&&<Btn variant="ghost" onClick={()=>{setEditingGroup(null);setGroupForm({name:'',description:'',color:GROUP_COLORS[0]});setGroupErr('')}}>Cancelar</Btn>}
          </div>
        </div>
      </div>}
    </Modal>}

    {/* ── FICHA ONLINE DEL CLIENTE (pantalla completa) ─────────────────────── */}
    {selected&&(()=>{
      const esSub=String(selected.id).startsWith('sub_')
      const f=ficha||{}
      const tareas=f.tasks||[]
      const pend=tareas.filter(t=>!t.done)
      const hechas=tareas.filter(t=>t.done)
      const dep=movs.filter(m=>m.kind==='deposito')
      const ret=movs.filter(m=>m.kind==='retiro')
      const suma=a=>a.reduce((s,m)=>s+Number(m.amount||0),0)
      const linea=buildTimeline(notes,activities,ficha)
      const anios=edad(selected.birth_date)
      const cerrar=()=>{setSelected(null);setCertMsg(null);setMovErr('')}
      return <div style={{position:'fixed',inset:0,zIndex:1002,background:P.bg,overflowY:'auto',fontFamily:'inherit'}}>

        {/* Cabecera fija: identidad + acciones */}
        <div style={{position:'sticky',top:0,zIndex:3,background:'rgba(13,15,23,0.94)',backdropFilter:'blur(14px)',borderBottom:`1px solid ${P.border}`,padding:isMob?'11px 14px':'13px 28px'}}>
          <div style={{maxWidth:1240,margin:'0 auto',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <button onClick={cerrar} title="Volver al listado de contactos"
              style={{padding:'7px 13px',borderRadius:9,background:'rgba(255,255,255,0.05)',border:`1px solid ${P.border}`,color:P.textSub,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
              ← Volver
            </button>
            <div style={{width:38,height:38,borderRadius:11,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:P.purple,flexShrink:0}}>
              {(selected.full_name||'?')[0]}
            </div>
            <div style={{minWidth:0,flex:isMob?'1 1 100%':'0 1 auto',order:isMob?3:0}}>
              <h2 style={{margin:0,fontSize:isMob?16:19,fontWeight:800,color:P.text,letterSpacing:'-0.01em',wordBreak:'break-word'}}>{selected.full_name||'Sin nombre'}</h2>
              <p style={{margin:'2px 0 0',fontSize:11.5,color:P.muted,fontFamily:'monospace',wordBreak:'break-all'}}>{selected.email||'sin correo'}</p>
            </div>
            <div style={{marginLeft:isMob?0:'auto',display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
              <Badge label={selected.status} color={SCOLOR_MAP[selected.status]||P.muted}/>
              <Badge label={selected.source||'crm'} color={selected.source==='formulario'?P.orange:selected.source==='csv'?P.blue:P.muted}/>
              {optOuts.has(soloDigitos(selected.phone))&&<span title="Pidió no recibir más mensajes por WhatsApp. Queda fuera de las campañas.">
                <Badge label="🚫 no contactar" color={P.red}/>
              </span>}
              {selected._capital>0&&<span style={{fontSize:12.5,color:P.green,fontFamily:'monospace',fontWeight:700}}>{fmt(selected._capital)}</span>}
              {!esSub&&<button onClick={()=>openEditContact(selected)}
                style={{padding:'6px 12px',borderRadius:8,background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,color:P.purple,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                ✏️ Editar ficha
              </button>}
              {/* Envío por la API de WhatsApp: sólo super admin, y bloqueado si pidió la baja */}
              {isSuperAdmin&&!esSub&&selected.phone&&(
                optOuts.has(soloDigitos(selected.phone))
                  ?<span title="Este contacto pidió no recibir mensajes. El envío está bloqueado."
                     style={{padding:'6px 12px',borderRadius:8,background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,color:P.muted,fontSize:12,fontWeight:600,cursor:'not-allowed'}}>
                     💬 WABA bloqueado
                   </span>
                  :<button onClick={()=>setWaContact(selected)} title="Enviar una plantilla aprobada por la API de WhatsApp"
                     style={{padding:'6px 12px',borderRadius:8,background:P.greenDim,border:`1px solid ${P.green}40`,color:P.green,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                     💬 Enviar WABA
                   </button>
              )}
              {staffProfile?.referral_code&&<WAFinanceInviteButton advisorCode={staffProfile.referral_code} advisorName={staffProfile.display_name||''} leadName={selected.full_name||''} leadPhone={selected.phone||''} compact onSend={()=>{if(!esSub){logActivity(user.id,selected.id,'wafinance_invitacion','Invitación WAFinance enviada por WhatsApp',{advisor_code:staffProfile.referral_code});setActivities(p=>[{id:Date.now().toString(),activity_type:'wafinance_invitacion',description:'Invitación WAFinance enviada por WhatsApp',created_at:new Date().toISOString()},...p])}}}/>}
              {!esSub&&<>
                <Btn variant="ghost" disabled={loadingFicha} style={{fontSize:11,padding:'6px 10px'}}
                  onClick={()=>exportFichaHTML(buildFichaDoc(selected,groups,memberships,notes,activities,ficha,getAdvisorName,movs))}>⬇ HTML</Btn>
                <Btn disabled={loadingFicha} style={{fontSize:11,padding:'6px 10px',background:'linear-gradient(135deg,#0a1f5c,#2563eb)',color:'#fff',border:'none'}}
                  onClick={()=>exportFichaPDF(buildFichaDoc(selected,groups,memberships,notes,activities,ficha,getAdvisorName,movs),LOGO_URI)}>⬇ PDF</Btn>
              </>}
              <button onClick={cerrar} title="Cerrar ficha"
                style={{background:'none',border:'none',color:P.muted,fontSize:20,cursor:'pointer',lineHeight:1,padding:'0 4px'}}>✕</button>
            </div>
          </div>
        </div>

        <div style={{maxWidth:1240,margin:'0 auto',padding:isMob?'16px 14px 64px':'22px 28px 72px'}}>
          {esSub&&<div style={{background:P.orangeDim,border:'1px solid rgba(255,165,2,0.3)',borderRadius:12,padding:'12px 16px',marginBottom:16}}>
            <p style={{margin:0,fontSize:12.5,color:P.orange}}>
              Este registro viene de un <strong>formulario web</strong> y todavía no es un contacto del CRM.
              Créalo como contacto para completar su ficha (cuenta, depósitos, tareas e historial).
            </p>
          </div>}

          <div style={{display:'grid',gridTemplateColumns:ancho>1080?'1.15fr 1fr':'1fr',gap:16,alignItems:'start'}}>

            {/* ── Columna izquierda ─────────────────────────────────────────── */}
            <div style={{minWidth:0}}>

              <FSection title="Registro completo del cliente" icon="🪪" accent={P.purple}>
                <FGrid>
                  <FField label="Nombre completo" value={selected.full_name}/>
                  <FField label="Fecha de nacimiento" value={selected.birth_date?`${fmtDate(selected.birth_date)}${anios!==null?` · ${anios} años`:''}`:''}/>
                  <FField label="Profesión, actividad u oficio" value={selected.profession}/>
                  <FField label="Número móvil" value={selected.phone} mono/>
                  <FField label="Correo electrónico" value={selected.email} mono/>
                  <FField label="Dirección" value={selected.address}/>
                  <FField label="Fecha de registro" value={fmtDate(selected.created_at)}/>
                  <FField label="Asesor asignado" value={selected.user_id?getAdvisorName(selected.user_id):(selected.source==='formulario'?'Web (sin asignar)':'')}/>
                </FGrid>
                {!esSub&&<div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${P.border}`}}>
                  <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 7px'}}>Grupos</p>
                  {groups.length===0?(
                    <p style={{fontSize:11.5,color:P.muted,fontStyle:'italic',margin:0}}>Aún no hay grupos. Créalos con el botón «Grupos» del listado.</p>
                  ):(
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {groups.map(g=>{
                        const on=(memberships[selected.id]||[]).includes(g.id)
                        return <button key={g.id} onClick={()=>toggleMember(selected.id,g.id)} title={on?'Quitar del grupo':'Agregar al grupo'}
                          style={{padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                            background:on?g.color+'28':'rgba(255,255,255,0.04)',color:on?g.color:P.muted,
                            border:`1px solid ${on?g.color+'60':P.border}`}}>
                          {on?'✓ ':'+ '}{g.name}
                        </button>
                      })}
                    </div>
                  )}
                </div>}
              </FSection>

              {/* Qué campañas ya recibió: es lo que impide volver a escribirle */}
              {!esSub&&<FSection title={`Campañas WhatsApp recibidas (${campanas.length})`} icon="📣" accent={P.green}>
                {campanas.length===0
                  ?<p style={{fontSize:11.5,color:P.muted,fontStyle:'italic',margin:0}}>Este contacto todavía no ha recibido ninguna campaña.</p>
                  :<div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {campanas.map(r=>{
                      const col=r.outcome==='sent'?P.green:r.outcome==='failed'?P.red:P.orange
                      const txt=r.outcome==='sent'?'Enviada':r.outcome==='failed'?'Falló'
                        :r.outcome==='skipped_opt_out'?'Omitida · baja':'Omitida · ya contactado'
                      return <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,
                        background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`}}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{margin:0,fontSize:12.5,color:P.text,fontWeight:600}}>{r.whatsapp_campaigns?.name||'Campaña sin nombre'}</p>
                          <p style={{margin:'2px 0 0',fontSize:10.5,color:P.muted,fontFamily:'monospace'}}>
                            {r.template_name||'—'} · {new Date(r.created_at).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})}
                          </p>
                          {r.error&&<p style={{margin:'2px 0 0',fontSize:10.5,color:P.red}}>{r.error}</p>}
                        </div>
                        <Badge label={txt} color={col}/>
                      </div>
                    })}
                  </div>}
              </FSection>}

              {!esSub&&<FSection title="Cuenta de inversión" icon="💹" accent={P.blue}>
                <FGrid>
                  <FField label="Apertura de cuenta"
                    value={selected.account_opened?`Sí${selected.account_opened_at?` · ${fmtDate(selected.account_opened_at)}`:''}`:(selected.account_opened===false&&(selected.broker||selected.account_number)?'No':'')}
                    color={selected.account_opened?P.green:undefined}/>
                  <FField label="Tipo de cuenta" value={selected.account_kind==='real'?'Real':selected.account_kind==='demo'?'Demo':''}
                    color={selected.account_kind==='real'?P.green:selected.account_kind==='demo'?P.orange:undefined}/>
                  <FField label="Broker" value={selected.broker}/>
                  <FField label="Número de cuenta" value={selected.account_number} mono/>
                  <FField label="PAMM o MAM" value={selected.managed_type&&selected.managed_type!=='ninguno'?selected.managed_type:(selected.managed_type==='ninguno'?'Ninguno':'')}
                    color={selected.managed_type&&selected.managed_type!=='ninguno'?P.purpleLight:undefined}/>
                  <FField label="Equidad o balance inicial" value={selected.initial_balance!==null&&selected.initial_balance!==undefined&&selected.initial_balance!==''?fmtUSD(selected.initial_balance):''} mono color={P.green}/>
                </FGrid>
              </FSection>}

              {!esSub&&<FSection title="Depósitos y retiros" icon="💰" accent={P.green}
                right={<span style={{fontSize:11,color:P.muted}}>{movs.length} movimiento{movs.length!==1?'s':''}</span>}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:14}}>
                  {[['Depósitos',suma(dep),P.green,dep.length],['Retiros',suma(ret),P.red,ret.length],['Neto',suma(dep)-suma(ret),P.text,null]].map(([k,v,col,n])=>(
                    <div key={k} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:10,padding:'10px 12px'}}>
                      <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 3px'}}>{k}{n!==null?` (${n})`:''}</p>
                      <p style={{fontSize:15,fontWeight:700,color:col,margin:0,fontFamily:'monospace'}}>{fmtUSD(v)}</p>
                    </div>
                  ))}
                </div>
                {movs.length>0&&<div style={{maxHeight:230,overflowY:'auto',display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
                  {movs.map(m=>(
                    <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 11px',background:'rgba(255,255,255,0.03)',borderRadius:9,borderLeft:`3px solid ${m.kind==='deposito'?P.green:P.red}`}}>
                      <span style={{fontSize:14,flexShrink:0}}>{m.kind==='deposito'?'↓':'↑'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:12.5,color:P.text,fontWeight:600}}>
                          {m.kind==='deposito'?'Depósito':'Retiro'} · <span style={{fontFamily:'monospace',color:m.kind==='deposito'?P.green:P.red}}>{fmtUSD(m.amount)}</span>
                        </p>
                        <p style={{margin:'2px 0 0',fontSize:10.5,color:P.muted}}>
                          {fmtDate(m.movement_date)}{m.note?` · ${m.note}`:''}
                        </p>
                      </div>
                      <button onClick={()=>delMov(m.id)} title="Eliminar movimiento"
                        style={{background:'none',border:'none',color:P.muted,fontSize:13,cursor:'pointer',flexShrink:0,fontFamily:'inherit'}}>🗑</button>
                    </div>
                  ))}
                </div>}
                <div style={{borderTop:`1px solid ${P.border}`,paddingTop:13}}>
                  <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 8px'}}>Registrar movimiento</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:8}}>
                    <Sel value={movForm.kind} onChange={v=>setMovForm(p=>({...p,kind:v}))} options={[{value:'deposito',label:'Depósito'},{value:'retiro',label:'Retiro'}]}/>
                    <Input type="date" value={movForm.movement_date} onChange={v=>setMovForm(p=>({...p,movement_date:v}))}/>
                    <Input value={movForm.amount} onChange={v=>setMovForm(p=>({...p,amount:v}))} placeholder="Monto USD"/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <Input value={movForm.note} onChange={v=>setMovForm(p=>({...p,note:v}))} placeholder="Nota (opcional)" style={{flex:1}}/>
                    <Btn onClick={addMov} disabled={movSaving}>{movSaving?'…':'+ Añadir'}</Btn>
                  </div>
                  {movErr&&<p style={{fontSize:11.5,color:P.red,margin:'8px 0 0'}}>{movErr}</p>}
                </div>
              </FSection>}

              {!esSub&&isAdmin&&<FSection title="Educación y certificados" icon="🎓" accent="#f0a500"
                right={<span style={{fontSize:10.5,color:P.muted}}>Emisión: admin y super admin</span>}>
                {certMsg&&<p style={{fontSize:12,color:certMsg.type==='ok'?P.green:P.red,background:certMsg.type==='ok'?P.greenDim:P.redDim,borderRadius:8,padding:'9px 12px',margin:'0 0 12px'}}>
                  {certMsg.type==='ok'?'✓ ':'✕ '}{certMsg.text}
                </p>}
                {edu.length===0?(
                  <p style={{fontSize:12,color:P.muted,fontStyle:'italic',margin:0}}>
                    Sin cursos aprobados para este cliente. Asígnale uno desde el módulo Educación.
                  </p>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {edu.map(r=>(
                      <div key={r.assignment_id} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:10,padding:'11px 13px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:8}}>
                          <span style={{fontSize:12.5,fontWeight:700,color:P.text}}>{r.module_title}</span>
                          {r.certificate_number
                            ?(r.certificate_url
                              ?<a href={r.certificate_url} target="_blank" rel="noopener noreferrer" title="Abrir el certificado" style={{textDecoration:'none'}}>
                                 <Badge label={`certificado ${r.certificate_number} ↗`} color={P.green}/>
                               </a>
                              :<Badge label={`certificado ${r.certificate_number}`} color={P.green}/>)
                            :<Badge label={`${r.pct}% completado`} color={r.pct>=100?P.green:r.pct>0?P.orange:P.muted}/>}
                        </div>
                        <FBar pct={r.pct} color={r.pct>=100?P.green:P.orange}/>
                        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:9}}>
                          <span style={{fontSize:10.5,color:P.muted}}>{r.done_lessons} de {r.total_lessons} lecciones</span>
                          {r.certificate_number?(
                            <span style={{fontSize:10.5,color:P.green,marginLeft:'auto'}}>Emitido {fmtDate(r.issued_at)}</span>
                          ):(
                            <Btn onClick={()=>issueCert(r)} disabled={r.pct<100||issuing===r.assignment_id}
                              style={{marginLeft:'auto',fontSize:11,padding:'6px 12px',
                                ...(r.pct<100?{background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`}:{})}}>
                              {issuing===r.assignment_id?'Emitiendo…':r.pct<100?'Curso incompleto':'🏅 Emitir certificado'}
                            </Btn>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </FSection>}
            </div>

            {/* ── Columna derecha ───────────────────────────────────────────── */}
            <div style={{minWidth:0}}>

              {!esSub&&<FSection title="Tareas" icon="✓" accent={P.red}
                right={<span style={{fontSize:11,color:P.muted}}>{tareas.length} asignada{tareas.length!==1?'s':''}</span>}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:tareas.length?13:0}}>
                  {[['Asignadas',tareas.length,P.textSub],['Pendientes',pend.length,P.orange],['Completadas',hechas.length,P.green]].map(([k,v,col])=>(
                    <div key={k} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:10,padding:'9px 11px',textAlign:'center'}}>
                      <p style={{fontSize:18,fontWeight:800,color:col,margin:0}}>{v}</p>
                      <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,margin:'2px 0 0'}}>{k}</p>
                    </div>
                  ))}
                </div>
                {loadingFicha?<Spinner/>:tareas.length===0?(
                  <p style={{fontSize:12,color:P.muted,fontStyle:'italic',margin:0}}>Sin tareas asignadas a este cliente.</p>
                ):(
                  <div style={{maxHeight:280,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
                    {[...pend,...hechas].map(t=>(
                      <div key={t.id} style={{display:'flex',gap:9,padding:'8px 11px',background:'rgba(255,255,255,0.03)',borderRadius:9,borderLeft:`3px solid ${t.done?P.green:(PRIO_COLOR[t.priority]||P.orange)}`}}>
                        <span style={{fontSize:13,flexShrink:0}}>{t.done?'✅':'📌'}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{margin:0,fontSize:12.5,color:t.done?P.muted:P.text,textDecoration:t.done?'line-through':'none',wordBreak:'break-word'}}>{t.title}</p>
                          <p style={{margin:'2px 0 0',fontSize:10.5,color:P.muted}}>
                            {t.done?`Completada ${t.completed_at?fmtDate(t.completed_at):''}`:(t.due_date?`Vence ${fmtDate(t.due_date)}`:'Sin fecha límite')}
                            {t.priority?` · prioridad ${t.priority}`:''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </FSection>}

              <FSection title={`Notas (${notes.length})`} icon="📝" accent={P.purple}>
                {notes.length>0&&<div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                  {notes.map(n=>(
                    <div key={n.id} style={{padding:'10px 12px',background:'rgba(108,92,231,0.08)',borderRadius:9,borderLeft:`3px solid ${P.purple}`}}>
                      <p style={{fontSize:12.5,color:P.textSub,margin:'0 0 4px',lineHeight:1.55,wordBreak:'break-word'}}>{n.content}</p>
                      <p style={{fontSize:10,color:P.muted,margin:0}}>{fmtDate(n.created_at)}</p>
                    </div>
                  ))}
                </div>}
                {noteErr&&<p style={{fontSize:11,color:P.red,margin:'0 0 8px'}}>No se pudo guardar la nota: {noteErr}</p>}
                <div style={{display:'flex',gap:8}}>
                  <Input value={noteText} onChange={setNoteText} placeholder="Añadir nota..." style={{flex:1}}
                    onKeyDown={e=>{if(e.key==='Enter'&&noteText.trim())addNote()}}/>
                  <Btn onClick={addNote} disabled={!noteText.trim()}>+</Btn>
                </div>
              </FSection>

              {/* ── Seguimiento comercial ─────────────────────────────────────
                  Reacciona al tipo de contacto: en B2B aparecen los campos de
                  empresa, en P2P no. Los formularios web (sub_) no tienen fila
                  real en crm_contacts, así que la sección entera no se muestra. */}
              {!esSub&&(()=>{
                const tipo=selected.contact_type||'P2P'
                const etapa=selected.sales_stage||'PROSPECTO'
                const rut=selected.company_tax_id||''
                const rutOk=!rut||rutValido(rut)
                const venc=selected.next_followup_at&&new Date(selected.next_followup_at)<new Date()
                return <FSection title="Seguimiento comercial" icon="📈" accent={P.green}
                  right={<Badge label={TIPO_LABEL[tipo]} color={TIPO_COLOR[tipo]}/>}>

                  {comErr&&<p style={{fontSize:11,color:P.red,margin:'0 0 10px'}}>{comErr}</p>}

                  <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 7px'}}>Tipo de contacto</p>
                  <div style={{display:'flex',gap:6,marginBottom:14}}>
                    {['P2P','B2B'].map(t=>(
                      <button key={t} onClick={()=>patchComercial(selected.id,{contact_type:t},`Tipo de contacto: ${TIPO_LABEL[t]}`)}
                        style={{padding:'5px 12px',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit',
                          background:tipo===t?TIPO_COLOR[t]+'30':'rgba(255,255,255,0.04)',
                          color:tipo===t?TIPO_COLOR[t]:P.muted,
                          border:`1px solid ${tipo===t?TIPO_COLOR[t]+'50':P.border}`}}>
                        {TIPO_LABEL[t]}
                      </button>
                    ))}
                  </div>

                  {tipo==='B2B'&&<div style={{marginBottom:14}}>
                    <FGrid min={200}>
                      <div>
                        <Lbl>Razón social</Lbl>
                        <Input value={selected.company_name||''} onChange={v=>setSelected(p=>({...p,company_name:v}))}
                          onBlur={e=>patchComercial(selected.id,{company_name:e.target.value.trim()||null})}
                          placeholder="Inversiones Andes SpA"/>
                      </div>
                      <div>
                        <Lbl>RUT de la empresa</Lbl>
                        <Input value={rut} onChange={v=>setSelected(p=>({...p,company_tax_id:v}))}
                          onBlur={e=>{const n=normalizaRut(e.target.value);patchComercial(selected.id,{company_tax_id:n||null})}}
                          placeholder="77863269-1"
                          style={!rutOk?{borderColor:P.orange}:{}}/>
                        {/* Aviso, no bloqueo: la columna admite identificadores
                            extranjeros que no cumplen el módulo 11 chileno. */}
                        {!rutOk&&<p style={{fontSize:10,color:P.orange,margin:'4px 0 0'}}>El dígito verificador no cuadra. Se guarda igual.</p>}
                      </div>
                    </FGrid>
                  </div>}

                  <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 7px'}}>Etapa de venta</p>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
                    {SALES_STAGES.map(s=>(
                      <button key={s.id} onClick={()=>patchComercial(selected.id,{sales_stage:s.id},`Etapa de venta: ${s.label}`)}
                        style={{padding:'5px 11px',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit',
                          background:etapa===s.id?s.color+'30':'rgba(255,255,255,0.04)',
                          color:etapa===s.id?s.color:P.muted,
                          border:`1px solid ${etapa===s.id?s.color+'50':P.border}`}}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {/* El status no se toca solo: 'inactivo' lo usan las automatizaciones
                      de WhatsApp para dar de baja al contacto, así que cerrar un negocio
                      no puede sacarlo de las campañas por su cuenta. Se sugiere. */}
                  {etapa==='CERRADO_GANADO'&&selected.status!=='cliente'&&
                    <p style={{fontSize:11,color:P.muted,margin:'0 0 14px'}}>
                      Negocio ganado y el estado sigue en «{selected.status}».{' '}
                      <button onClick={()=>updateStatus(selected.id,'cliente')}
                        style={{background:'none',border:'none',color:P.green,cursor:'pointer',fontSize:11,fontWeight:600,textDecoration:'underline',padding:0,fontFamily:'inherit'}}>
                        Marcar como cliente
                      </button>
                    </p>}

                  <FGrid min={200}>
                    <div>
                      <Lbl>Monto estimado (USD)</Lbl>
                      <Input type="number" value={selected.estimated_value??''} onChange={v=>setSelected(p=>({...p,estimated_value:v}))}
                        onBlur={e=>patchComercial(selected.id,{estimated_value:e.target.value===''?null:Number(e.target.value)})}
                        placeholder="25000"/>
                    </div>
                    <div>
                      <Lbl>Próximo seguimiento</Lbl>
                      <Input type="date" value={(selected.next_followup_at||'').slice(0,10)}
                        onChange={v=>patchComercial(selected.id,{next_followup_at:v?new Date(`${v}T12:00:00`).toISOString():null})}/>
                      {venc&&<p style={{fontSize:10,color:P.red,margin:'4px 0 0'}}>Vencido</p>}
                    </div>
                  </FGrid>

                  {/* Registrar gestión sin salir de la ficha */}
                  <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${P.border}`}}>
                    <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 9px'}}>Registrar gestión</p>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                      {ACTIVIDADES.map(a=>(
                        <button key={a.id} onClick={()=>setActForm(p=>({...p,tipo:a.id}))}
                          style={{padding:'5px 11px',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit',
                            background:actForm.tipo===a.id?P.purpleDim:'rgba(255,255,255,0.04)',
                            color:actForm.tipo===a.id?P.purpleLight:P.muted,
                            border:`1px solid ${actForm.tipo===a.id?P.purpleBorder:P.border}`}}>
                          {a.icon} {a.label}
                        </button>
                      ))}
                    </div>
                    <FGrid min={160}>
                      <div>
                        <Lbl>Cuándo ocurrió</Lbl>
                        <Input type="date" value={actForm.fecha} onChange={v=>setActForm(p=>({...p,fecha:v}))}/>
                      </div>
                      <div>
                        <Lbl>Resultado</Lbl>
                        <Input value={actForm.resultado} onChange={v=>setActForm(p=>({...p,resultado:v}))} placeholder="Contestó, reagendó..."/>
                      </div>
                    </FGrid>
                    <div style={{marginTop:10}}>
                      <Lbl>Nota</Lbl>
                      <textarea value={actForm.notas} onChange={e=>setActForm(p=>({...p,notas:e.target.value}))}
                        rows={2} placeholder="Qué se habló y qué queda comprometido"
                        style={{width:'100%',background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box',resize:'vertical'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
                      <Btn onClick={()=>registrarActividad(selected.id)} disabled={actSaving||!actForm.notas.trim()}>
                        {actSaving?'Guardando...':'Registrar gestión'}
                      </Btn>
                    </div>
                  </div>
                </FSection>
              })()}

              <FSection title="Gestión" icon="⚙️" accent={P.blue}>
                <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 7px'}}>Estado</p>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:isSuperAdmin&&!esSub?16:0}}>
                  {STATUS_OPT.map(s=>(
                    <button key={s.value} onClick={()=>updateStatus(selected.id,s.value)}
                      style={{padding:'5px 12px',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit',
                        background:selected.status===s.value?SCOLOR_MAP[s.value]+'30':'rgba(255,255,255,0.04)',
                        color:selected.status===s.value?SCOLOR_MAP[s.value]:P.muted,
                        border:`1px solid ${selected.status===s.value?SCOLOR_MAP[s.value]+'50':P.border}`}}>
                      {s.label}
                    </button>
                  ))}
                </div>
                {isSuperAdmin&&!esSub&&<div>
                  <p style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:700,margin:'0 0 7px'}}>Asesor asignado</p>
                  <select value={selected.user_id||''} onChange={e=>handleAssigneeChange(selected.id,e.target.value)}
                    style={{width:'100%',padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:`1px solid ${P.purpleBorder}`,color:P.text,fontSize:13,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
                    <option value="">Sin asignar (Web)</option>
                    {staffList.map(s=><option key={s.user_id} value={s.user_id}>{s.display_name}</option>)}
                  </select>
                </div>}
              </FSection>

              {!esSub&&(()=>{
                const resumen=[
                  ['WhatsApp',(f.wa||[]).length],['Tickets',(f.tickets||[]).length],
                  ['Tareas',tareas.length],['Formularios',(f.subs||[]).length],
                  ['Notas',notes.length],['Actividades',activities.length],
                ].filter(([,n])=>n>0)
                return <FSection title={`Historial completo (${linea.length})`} icon="🕘" accent="#f0a500"
                  right={<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {f.lead&&<Badge label="lead de campaña" color={P.blue}/>}
                    {f.cliente&&<Badge label="cuenta de cliente" color={P.purple}/>}
                  </div>}>
                  {resumen.length>0&&<p style={{fontSize:11,color:P.muted,margin:'0 0 10px'}}>
                    {resumen.map(([k,n])=>`${n} ${k.toLowerCase()}`).join(' · ')}
                  </p>}
                  {(loadingActivities||loadingFicha)?<Spinner/>:linea.length===0?(
                    <p style={{fontSize:12,color:P.muted,fontStyle:'italic',margin:0}}>Sin historial registrado aún</p>
                  ):(
                    <div style={{maxHeight:420,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
                      {linea.map((e,i)=>(
                        <div key={i} style={{display:'flex',gap:10,padding:'8px 10px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:'1px solid rgba(255,255,255,0.05)',borderLeft:`3px solid ${e.color}`}}>
                          <span style={{fontSize:15,flexShrink:0,marginTop:1}}>{e.icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:10,color:e.color,margin:'0 0 2px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>{e.tipo}</p>
                            <p style={{fontSize:12,color:P.text,margin:'0 0 2px',lineHeight:1.4,wordBreak:'break-word'}}>{e.titulo}</p>
                            {e.detalle&&<p style={{fontSize:10,color:P.muted,margin:'2px 0 0'}}>{e.detalle}</p>}
                            <p style={{fontSize:10,color:P.muted,margin:'3px 0 0'}}>
                              {new Date(e.ts).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})}
                              {' · '}
                              {new Date(e.ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </FSection>
              })()}
            </div>
          </div>
        </div>

        {/* Edición de los datos de la ficha */}
        {editingContact===selected.id&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={e=>{if(e.target===e.currentTarget)setEditingContact(null)}}>
            <div style={{background:'#0a1628',border:`1px solid ${P.border}`,borderRadius:16,padding:24,maxWidth:620,width:'100%',fontFamily:'inherit',maxHeight:'86vh',overflowY:'auto'}}
              onClick={e=>e.stopPropagation()}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <h3 style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>Editar ficha del cliente</h3>
                <button onClick={()=>setEditingContact(null)} style={{background:'none',border:'none',color:P.muted,fontSize:18,cursor:'pointer'}}>✕</button>
              </div>

              <p style={{fontSize:10,fontWeight:800,color:P.purple,textTransform:'uppercase',letterSpacing:'0.10em',margin:'0 0 10px'}}>Registro del cliente</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:18}}>
                {[['full_name','Nombre completo','text'],['birth_date','Fecha de nacimiento','date'],['email','Email','email'],
                  ['phone','Número móvil','tel'],['profession','Profesión, actividad u oficio','text'],['address','Dirección','text']].map(([field,label,type])=>(
                  <div key={field}>
                    <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4,display:'block'}}>{label}</label>
                    <input type={type} value={editForm[field]||''} onChange={e=>setEditForm(p=>({...p,[field]:e.target.value}))}
                      style={{width:'100%',padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:`1px solid ${P.border}`,color:P.text,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                  </div>
                ))}
              </div>

              <p style={{fontSize:10,fontWeight:800,color:P.blue,textTransform:'uppercase',letterSpacing:'0.10em',margin:'0 0 10px'}}>Cuenta de inversión</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:18}}>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4,display:'block'}}>Realizó apertura de cuenta</label>
                  <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:`1px solid ${P.border}`,cursor:'pointer'}}>
                    <input type="checkbox" checked={!!editForm.account_opened} onChange={e=>setEditForm(p=>({...p,account_opened:e.target.checked}))} style={{cursor:'pointer'}}/>
                    <span style={{fontSize:12,color:P.text}}>{editForm.account_opened?'Sí, cuenta abierta':'Todavía no'}</span>
                  </label>
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4,display:'block'}}>Fecha de apertura</label>
                  <input type="date" value={editForm.account_opened_at||''} onChange={e=>setEditForm(p=>({...p,account_opened_at:e.target.value}))}
                    style={{width:'100%',padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:`1px solid ${P.border}`,color:P.text,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4,display:'block'}}>Demo o real</label>
                  <select value={editForm.account_kind||''} onChange={e=>setEditForm(p=>({...p,account_kind:e.target.value}))}
                    style={{width:'100%',padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:`1px solid ${P.border}`,color:P.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
                    <option value="">Sin definir</option>
                    <option value="demo">Demo</option>
                    <option value="real">Real</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4,display:'block'}}>PAMM o MAM</label>
                  <select value={editForm.managed_type||''} onChange={e=>setEditForm(p=>({...p,managed_type:e.target.value}))}
                    style={{width:'100%',padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:`1px solid ${P.border}`,color:P.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
                    <option value="">Sin definir</option>
                    <option value="PAMM">PAMM</option>
                    <option value="MAM">MAM</option>
                    <option value="ninguno">Ninguno</option>
                  </select>
                </div>
                {[['broker','Broker','text'],['account_number','Número de cuenta','text'],['initial_balance','Equidad o balance inicial (USD)','text']].map(([field,label,type])=>(
                  <div key={field}>
                    <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4,display:'block'}}>{label}</label>
                    <input type={type} value={editForm[field]??''} onChange={e=>setEditForm(p=>({...p,[field]:e.target.value}))}
                      style={{width:'100%',padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:`1px solid ${P.border}`,color:P.text,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:18,maxWidth:260}}>
                <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4,display:'block'}}>Estado</label>
                <select value={editForm.status} onChange={e=>setEditForm(p=>({...p,status:e.target.value}))}
                  style={{width:'100%',padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:`1px solid ${P.border}`,color:P.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
                  {STATUS_OPT.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setEditingContact(null)}
                  style={{flex:1,padding:'10px 0',borderRadius:8,background:'transparent',border:`1px solid ${P.border}`,color:P.muted,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                  Cancelar
                </button>
                <button onClick={()=>saveContactEdit(selected.id)}
                  style={{flex:1,padding:'10px 0',borderRadius:8,background:P.purple,border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    })()}
  </div>
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────
// ─── PIPELINE ─────────────────────────────────────────────────────────────────
function Pipeline({leads,setLeads,isSuperAdmin}){
  const[selected,setSelected]=useState(null)
  const[filterVariant,setFilterVariant]=useState('all')
  const[filterPerfil,setFilterPerfil]=useState('all')

  const VARIANT_COLORS={'navy':'#4a7cdc','bold':'#c8e000','editorial':'#a8451f','minimalist':'#C9A84C','default':P.muted}
  const PERFIL_COLORS={'retail':P.green,'mam':P.purple,'institucional':P.orange}

  // Obtener valores únicos presentes en los leads
  const variants=[...new Set(leads.map(l=>l.variant).filter(Boolean))].sort()
  const perfiles=[...new Set(leads.map(l=>l.perfil).filter(Boolean))].sort()

  const filtered=leads.filter(l=>{
    if(filterVariant!=='all'&&l.variant!==filterVariant)return false
    if(filterPerfil!=='all'&&l.perfil!==filterPerfil)return false
    return true
  })

  const move=async(id,etapa)=>{
    const u={etapa,advisor_contacted:etapa>=2,account_created:etapa>=3,kyc_verified:etapa>=4,deposit_confirmed:etapa>=5}
    await supabase.from('campaign_leads').update(u).eq('id',id)
    setLeads(p=>p.map(l=>l.id===id?{...l,...u}:l))
    if(selected?.id===id)setSelected(p=>({...p,...u}))
  }

  const FilterBtn=({active,onClick,children,color})=>(
    <button onClick={onClick} style={{fontSize:11,padding:'4px 10px',borderRadius:6,cursor:'pointer',fontWeight:active?700:400,
      background:active?(color+'22'):'rgba(255,255,255,0.04)',
      color:active?(color||P.purple):P.muted,
      border:`1px solid ${active?(color||P.purple)+'55':P.border}`,transition:'all 0.15s'}}>
      {children}
    </button>
  )

  return <div>
    <SHdr title="Pipeline" sub={`${filtered.length} de ${leads.length} leads`}/>

    {/* Filtros */}
    {(variants.length>0||perfiles.length>0)&&<div style={{display:'flex',gap:16,marginBottom:20,flexWrap:'wrap',alignItems:'center',padding:'12px 16px',background:P.surface,borderRadius:10,border:`1px solid ${P.border}`}}>
      {variants.length>0&&<div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginRight:2}}>Landing</span>
        <FilterBtn active={filterVariant==='all'} onClick={()=>setFilterVariant('all')} color={P.purple}>Todas</FilterBtn>
        {variants.map(v=><FilterBtn key={v} active={filterVariant===v} onClick={()=>setFilterVariant(v===filterVariant?'all':v)} color={VARIANT_COLORS[v]||P.muted}>
          {v}
        </FilterBtn>)}
      </div>}
      {perfiles.length>0&&<div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginRight:2}}>Perfil</span>
        <FilterBtn active={filterPerfil==='all'} onClick={()=>setFilterPerfil('all')} color={P.purple}>Todos</FilterBtn>
        {perfiles.map(p=><FilterBtn key={p} active={filterPerfil===p} onClick={()=>setFilterPerfil(p===filterPerfil?'all':p)} color={PERFIL_COLORS[p]||P.muted}>
          {p}
        </FilterBtn>)}
      </div>}
      {(filterVariant!=='all'||filterPerfil!=='all')&&<button onClick={()=>{setFilterVariant('all');setFilterPerfil('all')}} style={{fontSize:11,color:P.muted,background:'none',border:'none',cursor:'pointer',marginLeft:'auto'}}>✕ Limpiar</button>}
    </div>}

    <div style={{display:'flex',gap:14,overflowX:'auto',paddingBottom:12}}>
      {STAGES.map(stage=>{
        const etapa=STAGE_ETAPA[stage]
        const staged=filtered.filter(l=>l.etapa===etapa)
        const color=STAGE_COLOR[stage]
        return <div key={stage} style={{minWidth:200,flex:1}}>
          <div style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:6,height:6,borderRadius:'50%',background:color}}/><span style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.06em'}}>{STAGE_LABEL[stage]}</span></div>
            <span style={{fontSize:11,color:P.muted}}>{staged.length}</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {staged.map(lead=><GlassCard key={lead.id} style={{padding:14,borderLeft:`3px solid ${color}`,cursor:'pointer'}} onClick={()=>setSelected(lead)}>
              <p style={{fontSize:13,fontWeight:600,color:P.text,margin:'0 0 2px'}}>{lead.full_name}</p>
              <p style={{fontSize:11,color:P.muted,margin:'0 0 8px',fontFamily:'monospace'}}>{lead.email}</p>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                {lead.investment_range&&<Badge label={lead.investment_range} color={P.green}/>}
                {lead.variant&&lead.variant!=='default'&&<Badge label={lead.variant} color={VARIANT_COLORS[lead.variant]||'#888'}/>}
                {lead.perfil&&<Badge label={lead.perfil} color={PERFIL_COLORS[lead.perfil]||P.muted}/>}
              </div>
              <div style={{background:'rgba(255,255,255,0.07)',borderRadius:2,height:3,margin:'4px 0 8px'}}><div style={{background:color,height:3,borderRadius:2,width:`${(etapa/5)*100}%`}}/></div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {etapa>1&&<button onClick={e=>{e.stopPropagation();move(lead.id,etapa-1)}} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`,cursor:'pointer'}}>← Anterior</button>}
                {etapa<5&&<button onClick={e=>{e.stopPropagation();move(lead.id,etapa+1)}} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:STAGE_COLOR[STAGES[etapa]]+'18',color:STAGE_COLOR[STAGES[etapa]],border:`1px solid ${STAGE_COLOR[STAGES[etapa]]}30`,cursor:'pointer'}}>→ {STAGE_LABEL[STAGES[etapa]]}</button>}
              </div>
            </GlassCard>)}
            {staged.length===0&&<div style={{border:`1px dashed ${P.border}`,borderRadius:12,padding:'20px 14px',textAlign:'center',fontSize:12,color:P.muted}}>{filtered.length<leads.length?'Sin resultados':'Sin leads'}</div>}
          </div>
        </div>
      })}
    </div>
    {selected&&<Modal title={selected.full_name} onClose={()=>setSelected(null)} accent={STAGE_COLOR[ETAPA_STAGE[selected.etapa]]}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={STAGE_LABEL[ETAPA_STAGE[selected.etapa]]} color={STAGE_COLOR[ETAPA_STAGE[selected.etapa]]}/>
          {selected.investment_range&&<Badge label={selected.investment_range} color={P.green}/>}
          {selected.team&&<Badge label={selected.team} color={P.blue}/>}
          {selected.variant&&selected.variant!=='default'&&<Badge label={`landing: ${selected.variant}`} color={VARIANT_COLORS[selected.variant]||'#888'}/>}
          {selected.perfil&&<Badge label={`perfil: ${selected.perfil}`} color={PERFIL_COLORS[selected.perfil]||P.muted}/>}
        </div>
        {[['Email',selected.email],['Teléfono',selected.phone||'—'],['Asesor',selected.advisor_assigned||'Sin asignar'],['Score',selected.score||0],['Registro',fmtDate(selected.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:3,margin:'0 0 3px',fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{String(v)}</p>
          </div>
        ))}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
          {[['Contactado',selected.advisor_contacted],['Cuenta',selected.account_created],['KYC',selected.kyc_verified],['Depósito',selected.deposit_confirmed]].map(([k,v])=>(
            <div key={k} style={{padding:'8px 12px',borderRadius:8,background:v?P.greenDim:'rgba(255,255,255,0.03)',border:`1px solid ${v?P.green+'30':P.border}`}}>
              <p style={{fontSize:10,color:P.muted,margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</p>
              <p style={{fontSize:13,fontWeight:700,color:v?P.green:P.muted,margin:0}}>{v?'✓ Sí':'—'}</p>
            </div>
          ))}
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── CAMPAÑA MODULE ───────────────────────────────────────────────────────────
function CampanaModule({campaign,campaignVariants=[],myReferralCode='',isMyVariant=()=>true,onBack,onManageVariant,onToggleVariantStatus,user,isSuperAdmin,globalLeads,setGlobalLeads}){
  const[myContacts,setMyContacts]=useState([])
  const[tiers,setTiers]=useState([])
  const[loading,setLoading]=useState(true)
  const[campTab,setCampTab]=useState('general')
  const[showAdd,setShowAdd]=useState(false)
  const[addForm,setAddForm]=useState({crm_contact_id:'',full_name:'',email:'',phone:'',investment_range:'',team:'',perfil:'',variant:(campaignVariants[0]?.variant_key)||'navy'})
  const[addSaving,setAddSaving]=useState(false)
  const[selPart,setSelPart]=useState(null)
  const[filterVariant,setFilterVariant]=useState('all')
  const[filterPerfil,setFilterPerfil]=useState('all')

  // Filtra leads de esta campaña — campaign_leads ya tiene campaign_id desde la migración
  const leads=(globalLeads||[]).filter(l=>l.campaign_id===campaign.id)
  const deposited=leads.filter(l=>l.deposit_confirmed)
  const capital=deposited.reduce((s,l)=>s+(Number(l.deposit_amount_usd)||0),0)
  const myLeads=isSuperAdmin?leads:leads.filter(l=>l.advisor_assigned&&l.advisor_assigned.toLowerCase().includes((user?.email||'').split('@')[0].toLowerCase()))
  const sorted=[...leads].sort((a,b)=>b.score-a.score)
  const variants=[...new Set(leads.map(l=>l.variant).filter(Boolean))].sort()
  const perfiles=[...new Set(leads.map(l=>l.perfil).filter(Boolean))].sort()
  const filtered=myLeads.filter(l=>{
    if(filterVariant!=='all'&&l.variant!==filterVariant)return false
    if(filterPerfil!=='all'&&l.perfil!=='all'&&l.perfil!==filterPerfil)return false
    return true
  })

  const etapaColor={1:P.muted,2:P.blue,3:P.orange,4:P.purple,5:P.green}
  const etapaLabel={1:'Registro',2:'Contactado',3:'Cuenta',4:'KYC',5:'Depósito'}
  const teamColor={radex:'#e74c3c',tradeview:'#3498db'}
  const variantColor={navy:'#4a7cdc',bold:'#c8e000',editorial:'#a8451f',minimalist:'#C9A84C'}
  const perfilColor={retail:P.green,mam:P.purple,asesor:P.orange}

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const[{data:myC},{data:t}]=await Promise.all([
        supabase.from('crm_contacts').select('id,full_name,email,phone').eq('user_id',user.id),
        supabase.from('campaign_bonus_tiers').select('*').order('min_referrals'),
      ])
      setMyContacts(myC||[])
      setTiers(t||[])
    }catch(e){console.error('campaign load:',e)}
    finally{setLoading(false)}
  },[user.id])

  useEffect(()=>{load()},[load])

  // Añadir lead directamente a campaign_leads
  const addLead=async()=>{
    if(!addForm.full_name||!addForm.email)return
    setAddSaving(true)
    // Generar referral_code único
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
    const cnt=leads.length
    const payload={
      full_name:addForm.full_name,email:addForm.email,phone:addForm.phone||null,
      investment_range:addForm.investment_range||null,team:addForm.team||null,
      perfil:addForm.perfil||null,variant:addForm.variant||'navy',
      campaign_id:campaign.id,
      referral_code:code,position_in_queue:cnt+1,
      source:'crm_manual',advisor_assigned:user?.email?.split('@')[0]||null,etapa:1,
    }
    const{data,error}=await supabase.from('campaign_leads').insert(payload).select(
      'id,full_name,email,phone,investment_range,etapa,advisor_assigned,advisor_contacted,account_created,kyc_verified,deposit_confirmed,score,team,created_at,variant,perfil,deposit_amount_usd,campaign_id'
    ).single()
    if(data&&!error){
      setGlobalLeads(p=>[data,...p])
      setShowAdd(false)
      setAddForm({crm_contact_id:'',full_name:'',email:'',phone:'',investment_range:'',team:'',perfil:'',variant:'navy'})
    }
    setAddSaving(false)
  }

  // Actualizar lead en campaign_leads
  const updateLead=async(id,updates)=>{
    await supabase.from('campaign_leads').update({...updates}).eq('id',id)
    setGlobalLeads(p=>p.map(l=>l.id===id?{...l,...updates}:l))
    if(selPart?.id===id)setSelPart(p=>({...p,...updates}))
  }

  const FilterBtn=({active,onClick,children,color})=>(
    <button onClick={onClick} style={{fontSize:11,padding:'4px 10px',borderRadius:6,cursor:'pointer',fontWeight:active?700:400,
      background:active?(color+'22'):'rgba(255,255,255,0.04)',color:active?(color||P.purple):P.muted,
      border:`1px solid ${active?(color||P.purple)+'55':P.border}`,transition:'all 0.15s'}}>
      {children}
    </button>
  )

  return <div>
    {onBack&&<button onClick={onBack} style={{marginBottom:12,padding:'6px 12px',background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`,borderRadius:6,fontSize:11,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>← Volver a campañas</button>}
    <SHdr title={campaign.name} sub={`${leads.length} leads · ${deposited.length} depósitos · ${campaign.status}`}/>

    <div style={{display:'flex',gap:8,marginBottom:20}}>
      {[['general','🏆 General'],['landings','🚀 Landings'],['mis_leads','👤 Mis Leads']].map(([id,label])=>(
        <button key={id} onClick={()=>setCampTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',
          background:campTab===id?P.purpleDim:'rgba(255,255,255,0.04)',
          color:campTab===id?P.purple:P.muted,
          border:`1px solid ${campTab===id?P.purpleBorder:P.border}`,fontWeight:campTab===id?600:400}}>{label}</button>
      ))}
      {campTab==='mis_leads'&&<Btn onClick={()=>setShowAdd(true)} style={{marginLeft:'auto'}}>+ Añadir lead</Btn>}
    </div>

    {campTab==='general'&&(loading?<Spinner/>:<div>
      <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
        <StatCard label="Capital levantado" value={capital>0?`$${(capital/1000).toFixed(0)}k`:'$0'} sub={`${deposited.length} depósitos`} accent={P.green} Icon="💵"/>
        <StatCard label="Cupos" value={`${deposited.length}/${campaign.total_spots||50}`} sub={`${(campaign.total_spots||50)-deposited.length} libres`} accent={P.purple} Icon="🎯"/>
        <StatCard label="Leads totales" value={leads.length} accent={P.blue} Icon="👥"/>
        <StatCard label="Estado" value={campaign.status[0].toUpperCase()+campaign.status.slice(1)} accent={campaign.status==='activa'?P.green:P.orange} Icon="📡"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <GlassCard style={{padding:0}}>
          <div style={{padding:'14px 18px',borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',margin:0}}>🏆 Leaderboard</p>
          </div>
          {sorted.length===0&&<p style={{padding:20,color:P.muted,fontSize:13,margin:0}}>Sin leads</p>}
          {sorted.map((lead,i)=>(
            <div key={lead.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 18px',borderBottom:`1px solid ${P.border}`}}>
              <div style={{width:26,height:26,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',
                background:i===0?'rgba(255,215,0,0.2)':i===1?'rgba(192,192,192,0.15)':i===2?'rgba(205,127,50,0.15)':P.purpleDim,
                fontSize:12,fontWeight:800,color:i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':P.purple,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:P.text,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lead.full_name}</p>
                <div style={{display:'flex',gap:4,marginTop:3,flexWrap:'wrap'}}>
                  <Badge label={etapaLabel[lead.etapa]||'—'} color={etapaColor[lead.etapa]||P.muted}/>
                  {lead.variant&&<Badge label={lead.variant} color={variantColor[lead.variant]||P.muted}/>}
                  {lead.team&&<Badge label={lead.team} color={teamColor[lead.team]||P.muted}/>}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:4,background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:8,padding:'4px 10px',flexShrink:0}}>
                <span style={{fontSize:14,fontWeight:800,color:P.purple,fontFamily:'monospace'}}>{lead.score||0}</span>
                <span style={{fontSize:10,color:P.muted}}>pts</span>
              </div>
            </div>
          ))}
        </GlassCard>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {tiers.length>0&&<GlassCard>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>Bonus tiers</p>
            {tiers.map(t=>(
              <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',marginBottom:8,borderRadius:8,background:P.purpleDim,border:`1px solid ${P.purpleBorder}`}}>
                <span style={{fontSize:13,color:P.textSub}}>{t.min_referrals}+ referidos</span>
                <div style={{background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:6,padding:'2px 8px'}}>
                  <span style={{fontSize:13,fontWeight:700,color:P.green}}>+{t.bonus_percentage}%</span>
                </div>
              </div>
            ))}
          </GlassCard>}
          <GlassCard>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>Leads por capital</p>
            {['1k-5k','5k-20k','20k-50k','50k+'].map(r=>{
              const cnt=leads.filter(l=>l.investment_range===r).length
              const dep=leads.filter(l=>l.investment_range===r&&l.deposit_confirmed).length
return <div key={r} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,color:P.textSub}}>{r}</span>
                  <span style={{fontSize:12,color:P.muted}}>{dep}/{cnt}</span>
                </div>
                <div style={{background:'rgba(255,255,255,0.06)',borderRadius:3,height:4}}>
                  <div style={{background:P.green,height:4,borderRadius:3,width:`${leads.length?cnt/leads.length*100:0}%`}}/>
                </div>
              </div>
            })}
          </GlassCard>
        </div>
      </div>
    </div>)}


    {campTab==='landings'&&<div>
      <p style={{fontSize:12,color:P.muted,marginBottom:20}}>Variantes de landing page activas para esta campaña. Haz clic para abrir en nueva pestaña.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,marginBottom:28}}>
        {campaignVariants.map(v=>{
          const cnt=leads.filter(l=>l.variant===v.variant_key).length
          const dep=leads.filter(l=>l.variant===v.variant_key&&l.deposit_confirmed).length
          const top=leads.filter(l=>l.variant===v.variant_key).sort((a,b)=>b.score-a.score).slice(0,1)[0]
          const canUse=isMyVariant(v.id)
          const linkRef=myReferralCode?`?ref=${myReferralCode}`:''
          return <GlassCard key={v.id} style={{borderLeft:`3px solid ${v.color}`,padding:20,opacity:v.status==='activa'?1:0.55}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:v.color,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4}}>{v.label}{v.status!=='activa'&&' · pausada'}</div>
                <div style={{fontSize:12,color:P.muted,lineHeight:1.5}}>{v.description||'—'}</div>
              </div>
              <div style={{background:v.color+'18',border:`1px solid ${v.color}40`,borderRadius:8,padding:'4px 10px',textAlign:'center',flexShrink:0,marginLeft:10}}>
                <div style={{fontSize:18,fontWeight:800,color:v.color}}>{cnt}</div>
                <div style={{fontSize:9,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>leads</div>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <div style={{flex:1,background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                <div style={{fontSize:15,fontWeight:700,color:P.green}}>{dep}</div>
                <div style={{fontSize:9,color:P.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>depósitos</div>
              </div>
              <div style={{flex:1,background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                <div style={{fontSize:15,fontWeight:700,color:P.purple}}>{cnt>0?Math.round(dep/cnt*100):0}%</div>
                <div style={{fontSize:9,color:P.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>conversión</div>
              </div>
            </div>
            {top&&<div style={{fontSize:11,color:P.muted,marginBottom:12,padding:'6px 10px',background:'rgba(255,255,255,0.03)',borderRadius:6}}>
              🏆 Top: <span style={{color:P.text,fontWeight:600}}>{top.full_name}</span> · {top.score} pts
            </div>}
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <a href={`https://pessaro.cl${v.landing_url}`} target="_blank" rel="noopener noreferrer"
                style={{flex:1,minWidth:100,padding:'9px 0',background:v.color,color:'#000',border:'none',borderRadius:8,
                  fontSize:12,fontWeight:700,cursor:'pointer',textAlign:'center',textDecoration:'none',display:'block'}}>
                Ver landing →
              </a>
              {canUse&&myReferralCode&&<button onClick={()=>{navigator.clipboard.writeText(`https://pessaro.cl${v.landing_url}${linkRef}`)}}
                style={{padding:'9px 12px',background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`,
                  borderRadius:8,fontSize:11,cursor:'pointer'}}>
                Copiar mi link
              </button>}
              {isSuperAdmin&&onManageVariant&&<button onClick={()=>onManageVariant(v)}
                style={{padding:'9px 12px',background:P.orange+'15',color:P.orange,border:`1px solid ${P.orange}40`,
                  borderRadius:8,fontSize:11,cursor:'pointer',fontWeight:600}}>
                ⚙ Asesores
              </button>}
              {isSuperAdmin&&onToggleVariantStatus&&<button onClick={()=>onToggleVariantStatus(v)}
                style={{padding:'9px 12px',background:'rgba(255,255,255,0.05)',color:v.status==='activa'?P.orange:P.green,border:`1px solid ${P.border}`,
                  borderRadius:8,fontSize:11,cursor:'pointer'}}>
                {v.status==='activa'?'⏸ Pausar':'▶ Activar'}
              </button>}
            </div>
          </GlassCard>
        })}
      </div>

      {/* Mis links de referido por variante (solo variantes habilitadas) */}
      {myReferralCode&&<GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>Mis links de referido</p>
        {campaignVariants.filter(v=>isMyVariant(v.id)&&v.status==='activa').map(v=>(
          <div key={v.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${P.border}`}}>
            <span style={{fontSize:12,fontWeight:600,color:v.color,minWidth:90}}>{v.label}</span>
            <code style={{flex:1,fontSize:11,color:P.muted,background:'rgba(255,255,255,0.04)',padding:'5px 10px',borderRadius:6,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {`https://pessaro.cl${v.landing_url}?ref=${myReferralCode}`}
            </code>
            <button onClick={()=>navigator.clipboard.writeText(`https://pessaro.cl${v.landing_url}?ref=${myReferralCode}`)}
              style={{padding:'5px 10px',background:'rgba(255,255,255,0.06)',color:P.muted,border:`1px solid ${P.border}`,borderRadius:6,fontSize:11,cursor:'pointer'}}>
              Copiar
            </button>
          </div>
        ))}
        {campaignVariants.filter(v=>isMyVariant(v.id)&&v.status==='activa').length===0&&
          <p style={{fontSize:12,color:P.muted,fontStyle:'italic',padding:'10px 0',margin:0}}>No tienes variantes habilitadas. Solicita acceso al super admin.</p>
        }
      </GlassCard>}
      {!myReferralCode&&<GlassCard style={{padding:14,background:P.orange+'10',border:`1px solid ${P.orange}30`}}>
        <p style={{fontSize:12,color:P.orange,margin:0}}>⚠ No tienes un código de referido asignado. Pide al super admin que te genere uno en «Campañas → Administrar → Links Asesores».</p>
      </GlassCard>}
    </div>}

    {campTab==='mis_leads'&&(loading?<Spinner/>:<div>
      <GlassCard style={{padding:0,marginBottom:16}}>
        <div style={{padding:'12px 18px',borderBottom:`1px solid ${P.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <p style={{fontSize:12,fontWeight:600,color:P.textSub,margin:0}}>{isSuperAdmin?'Todos los leads':'Mis leads'} · {filtered.length}</p>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
            {['Nombre','Email','Capital','Equipo','Contactado','Cuenta','KYC','Depósito'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((p,i)=>(

              <tr key={p.id} style={{borderBottom:i<filtered.length-1?`1px solid ${P.border}`:'none',cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onClick={()=>setSelPart(p)}>
                <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:P.text}}>{p.full_name}</td>
                <td style={{padding:'11px 14px',fontSize:12,color:P.muted,fontFamily:'monospace'}}>{p.email}</td>
                <td style={{padding:'11px 14px'}}>{p.investment_range?<Badge label={p.investment_range} color={P.green}/>:'—'}</td>
                <td style={{padding:'11px 14px'}}>{p.team?<Badge label={p.team} color={teamColor[p.team]||P.muted}/>:'—'}</td>
                {[['advisor_contacted',p.advisor_contacted],['account_created',p.account_created],['kyc_verified',p.kyc_verified],['deposit_confirmed',p.deposit_confirmed]].map(([field,val])=>(
                  <td key={field} style={{padding:'11px 14px'}}>
                    <button onClick={e=>{e.stopPropagation();updatePart(p.id,{[field]:!val})}}
                      style={{padding:'3px 8px',borderRadius:5,fontSize:11,cursor:'pointer',fontWeight:600,
                        background:val?P.greenDim:'rgba(255,255,255,0.04)',color:val?P.green:P.muted,
                        border:`1px solid ${val?P.green+'30':P.border}`}}>{val?'✓ Sí':'— No'}</button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{textAlign:'center',padding:32,color:P.muted,fontSize:13}}>Sin leads. Añade uno con el botón "+ Añadir lead".</div>}
      </GlassCard>
    </div>)}

    {showAdd&&<Modal title="Añadir lead a campaña" onClose={()=>setShowAdd(false)} accent={P.purple}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div><Lbl>Desde mis contactos</Lbl>
          <Sel value={addForm.crm_contact_id} onChange={v=>{
            const c=myContacts.find(x=>x.id===v)
            if(c)setAddForm(p=>({...p,crm_contact_id:v,full_name:c.full_name,email:c.email,phone:c.phone||''}))
            else setAddForm(p=>({...p,crm_contact_id:v}))
          }} options={[{value:'',label:'Ingresar manualmente'},...myContacts.map(c=>({value:c.id,label:`${c.full_name} · ${c.email}`}))]}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Nombre *</Lbl><Input value={addForm.full_name} onChange={v=>setAddForm(p=>({...p,full_name:v}))} placeholder="Nombre completo"/></div>
          <div><Lbl>Email *</Lbl><Input value={addForm.email} onChange={v=>setAddForm(p=>({...p,email:v}))} placeholder="email@ejemplo.com"/></div>
          <div><Lbl>Teléfono</Lbl><Input value={addForm.phone} onChange={v=>setAddForm(p=>({...p,phone:v}))} placeholder="56912345678"/></div>
          <div><Lbl>Capital</Lbl><Sel value={addForm.investment_range} onChange={v=>setAddForm(p=>({...p,investment_range:v}))} options={[{value:'',label:'Seleccionar'},{value:'1k-5k',label:'1k-5k'},{value:'5k-20k',label:'5k-20k'},{value:'20k-50k',label:'20k-50k'},{value:'50k+',label:'50k+'}]}/></div>
          <div><Lbl>Equipo</Lbl><Sel value={addForm.team} onChange={v=>setAddForm(p=>({...p,team:v}))} options={[{value:'',label:'Sin equipo'},{value:'radex',label:'Radex'},{value:'tradeview',label:'Tradeview'}]}/></div>
          <div><Lbl>Landing</Lbl><Sel value={addForm.variant} onChange={v=>setAddForm(p=>({...p,variant:v}))} options={campaignVariants.length>0?campaignVariants.map(v=>({value:v.variant_key,label:v.label})):[{value:'navy',label:'Navy'},{value:'editorial',label:'Editorial'},{value:'bold',label:'Bold'},{value:'minimalist',label:'Minimalist'}]}/></div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn>
          <Btn onClick={addParticipant} disabled={addSaving||!addForm.full_name||!addForm.email}>{addSaving?'Guardando...':'Añadir'}</Btn>
        </div>
      </div>
    </Modal>}

    {selPart&&<Modal title={selPart.full_name} onClose={()=>setSelPart(null)}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={etapaLabel[selPart.etapa]||selPart.etapa} color={etapaColor[selPart.etapa]||P.muted}/>
          {selPart.team&&<Badge label={selPart.team} color={teamColor[selPart.team]||P.muted}/>}
          {selPart.investment_range&&<Badge label={selPart.investment_range} color={P.green}/>}
        </div>
        {[['Email',selPart.email],['Teléfono',selPart.phone||'—'],['Depósito USD',selPart.deposit_amount_usd?`$${Number(selPart.deposit_amount_usd).toLocaleString()}`:'—'],['Registro',fmtDate(selPart.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:3,margin:'0 0 3px',fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{v}</p>
          </div>
        ))}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
          {[['Contactado','advisor_contacted',selPart.advisor_contacted],['Cuenta','account_created',selPart.account_created],['KYC','kyc_verified',selPart.kyc_verified],['Depósito','deposit_confirmed',selPart.deposit_confirmed]].map(([k,field,v])=>(
            <button key={k} onClick={()=>updatePart(selPart.id,{[field]:!v})}
              style={{padding:'10px 12px',borderRadius:8,cursor:'pointer',textAlign:'left',background:v?P.greenDim:'rgba(255,255,255,0.03)',border:`1px solid ${v?P.green+'30':P.border}`}}>
              <p style={{fontSize:10,color:P.muted,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</p>
              <p style={{fontSize:13,fontWeight:700,color:v?P.green:P.muted,margin:0}}>{v?'✓ Sí':'— No'}</p>
            </button>
          ))}
        </div>
      </div>
    </Modal>}
  </div>
}


// ─── CAMPAIGNS HUB — vista unificada para todos los roles ──────────────────
function CampaignsHub({campaigns,setCampaigns,user,isSuperAdmin,staffProfile,globalLeads,setGlobalLeads}){
  const[variants,setVariants]=useState([])
  const[advisors,setAdvisors]=useState([])
  const[loading,setLoading]=useState(true)
  const[selectedCamp,setSelectedCamp]=useState(null)
  const[manageVariant,setManageVariant]=useState(null) // for super admin variant-advisors modal
  const[staffList,setStaffList]=useState([])
  // Canal de la campaña: el módulo unifica los tres orígenes que antes vivían
  // en pantallas distintas (WABA estaba escondido dentro de Mensajes WA).
  const[canal,setCanal]=useState('todas')
  const[waCamps,setWaCamps]=useState([])

  // Load variants and advisor assignments
  useEffect(()=>{(async()=>{
    setLoading(true)
    try{
      const[{data:v},{data:va},{data:sp},{data:wa}]=await Promise.all([
        supabase.from('campaign_variants').select('*').order('variant_key'),
        supabase.from('variant_advisors').select('*'),
        isSuperAdmin?supabase.from('crm_staff_profiles').select('id,display_name,pessaro_email,role').order('display_name'):Promise.resolve({data:[]}),
        supabase.from('whatsapp_campaigns').select('*,whatsapp_templates(template_name)').order('created_at',{ascending:false}),
      ])
      setVariants(v||[])
      setAdvisors(va||[])
      setStaffList(sp||[])
      setWaCamps(wa||[])
    }catch(e){console.error('CampaignsHub load:',e)}
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })()},[]) // run once — isSuperAdmin is stable after auth resolves

  // Filter campaigns a este asesor le sirven (super admin ve todas)
  const myStaffId=staffProfile?.id
  const visibleCampaigns=campaigns.filter(c=>{
    if(c.status!=='activa'&&!isSuperAdmin)return false
    if(isSuperAdmin)return true
    if(!myStaffId)return false
    // El asesor ve campañas donde tiene al menos 1 variante habilitada
    const campVariantIds=variants.filter(v=>v.campaign_id===c.id).map(v=>v.id)
    return advisors.some(a=>a.staff_id===myStaffId&&a.enabled&&campVariantIds.includes(a.variant_id))
  })

  const getVariantsFor=campId=>variants.filter(v=>v.campaign_id===campId)
  const isMyVariant=variantId=>isSuperAdmin?true:advisors.some(a=>a.staff_id===myStaffId&&a.enabled&&a.variant_id===variantId)
  const enabledAdvisorsFor=variantId=>advisors.filter(a=>a.variant_id===variantId&&a.enabled).length
  const myReferralCode=staffProfile?.referral_code||''

  // Toggle de asesor en variante (super admin only)
  const toggleAdvisorOnVariant=async(variantId,staffId)=>{
    const existing=advisors.find(a=>a.variant_id===variantId&&a.staff_id===staffId)
    if(existing){
      const{error}=await supabase.from('variant_advisors').update({enabled:!existing.enabled}).eq('id',existing.id)
      if(!error)setAdvisors(p=>p.map(a=>a.id===existing.id?{...a,enabled:!a.enabled}:a))
    }else{
      const{data,error}=await supabase.from('variant_advisors').insert({variant_id:variantId,staff_id:staffId,enabled:true,granted_by:user?.id}).select().single()
      if(!error&&data)setAdvisors(p=>[...p,data])
    }
  }

  // Toggle status de la variante (activa/pausada) — solo super admin
  const toggleVariantStatus=async(v)=>{
    const newStatus=v.status==='activa'?'pausada':'activa'
    const{error}=await supabase.from('campaign_variants').update({status:newStatus}).eq('id',v.id)
    if(!error)setVariants(p=>p.map(x=>x.id===v.id?{...x,status:newStatus}:x))
  }

  if(loading)return <Spinner/>

  // Vista detalle de una campaña seleccionada
  if(selectedCamp){
    const camp=selectedCamp
    const campVariants=getVariantsFor(camp.id)
    const campLeads=globalLeads.filter(l=>l.campaign_id===camp.id)
    return <CampanaModule
      key={camp.id}
      campaign={camp}
      campaignVariants={campVariants}
      myReferralCode={myReferralCode}
      isMyVariant={isMyVariant}
      onBack={()=>setSelectedCamp(null)}
      onManageVariant={isSuperAdmin?setManageVariant:null}
      onToggleVariantStatus={isSuperAdmin?toggleVariantStatus:null}
      user={user}
      isSuperAdmin={isSuperAdmin}
      globalLeads={globalLeads}
      setGlobalLeads={setGlobalLeads}
    />
  }

  // Clasificación por canal de entrega:
  //  - enlace: la campaña reparte links de referido (tiene variantes con landing)
  //  - waba:   envíos por plantilla de WhatsApp (tabla whatsapp_campaigns)
  //  - otras:  campañas del CRM que sólo agrupan leads, sin link ni envío WABA
  const conEnlace=visibleCampaigns.filter(c=>getVariantsFor(c.id).length>0)
  const otras=visibleCampaigns.filter(c=>getVariantsFor(c.id).length===0)
  const WA_ESTADO={draft:'Borrador',scheduled:'Programada',sending:'Enviando…',completed:'Completada',paused:'Pausada',failed:'Fallida'}
  const WA_COLOR ={draft:P.muted,scheduled:P.blue,sending:P.orange,completed:P.green,paused:P.orange,failed:P.red}

  // Tarjeta de campaña del CRM — se reutiliza en «Todas», «Enlace» y «Otras»
  const tarjetaCampana=c=>{
    const campVariants=getVariantsFor(c.id)
    const myVariants=campVariants.filter(v=>isMyVariant(v.id))
    const activeMyVariants=myVariants.filter(v=>v.status==='activa')
    const totalLeads=globalLeads.filter(l=>l.campaign_id===c.id).length
    const deposits=globalLeads.filter(l=>l.campaign_id===c.id&&l.deposit_confirmed).length
    const statusC=c.status==='activa'?P.green:c.status==='pausada'?P.orange:P.muted
    const esEnlace=campVariants.length>0
    return <GlassCard key={c.id} style={{borderLeft:`3px solid ${statusC}`,padding:18}}>
      <div style={{cursor:'pointer'}} onClick={()=>setSelectedCamp(c)}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
            <p style={{fontSize:9,color:statusC,textTransform:'uppercase',letterSpacing:'0.15em',fontWeight:700,margin:0}}>{c.status}</p>
            <Badge label={esEnlace?'🔗 enlace':'📌 otra'} color={esEnlace?P.blue:P.muted}/>
          </div>
          <p style={{fontSize:15,fontWeight:700,color:P.text,margin:'0 0 4px'}}>{c.name}</p>
          <p style={{fontSize:11,color:P.muted,fontFamily:'monospace',margin:0}}>{c.slug}</p>
        </div>
        <div style={{textAlign:'right',marginLeft:10}}>
          <p style={{fontSize:18,fontWeight:800,color:P.text,margin:0,lineHeight:1}}>{totalLeads}</p>
          <p style={{fontSize:9,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',margin:'4px 0 0'}}>leads</p>
        </div>
      </div>
      {c.description&&<p style={{fontSize:11,color:P.muted,margin:'8px 0',lineHeight:1.5}}>{c.description}</p>}
      <div style={{display:'flex',gap:8,marginTop:12,fontSize:11}}>
        <span style={{color:P.green}}>● {deposits} depósitos</span>
        <span style={{color:P.muted}}>· {totalLeads?Math.round(deposits/totalLeads*100):0}% conv.</span>
      </div>
      <div style={{display:'flex',gap:5,marginTop:12,flexWrap:'wrap'}}>
        {(isSuperAdmin?campVariants:myVariants).map(v=>(
          <span key={v.id} style={{
            fontSize:10,padding:'3px 8px',borderRadius:4,fontWeight:600,letterSpacing:'0.05em',
            background:v.color+'22',color:v.color,border:`1px solid ${v.color}40`,
            opacity:v.status==='activa'?1:0.5,
          }}>{v.label}{v.status!=='activa'&&' · pausada'}</span>
        ))}
        {!isSuperAdmin&&myVariants.length===0&&<span style={{fontSize:10,color:P.muted,fontStyle:'italic'}}>sin variantes habilitadas</span>}
      </div>
      <p style={{fontSize:11,color:P.blue,margin:'12px 0 0',cursor:'pointer'}}>Ver detalle →</p>
      </div>
      {/* ── Referral links para asesores (acceso directo sin entrar al detalle) ── */}
      {!isSuperAdmin&&myReferralCode&&activeMyVariants.length>0&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${P.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
          <span style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>🔗 Mis links de referido</span>
          <span style={{fontSize:10,color:P.purple,background:P.purpleDim,padding:'2px 6px',borderRadius:4,fontFamily:'monospace',fontWeight:700}}>{myReferralCode}</span>
        </div>
        {activeMyVariants.map(v=>{
          const link=`https://pessaro.cl${v.landing_url}?ref=${myReferralCode}`
          return <div key={v.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:600,color:v.color,minWidth:80}}>{v.label}</span>
            <code style={{flex:1,fontSize:10,color:P.muted,background:'rgba(255,255,255,0.04)',padding:'4px 8px',borderRadius:4,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{link}</code>
            <button onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(link).then(()=>{const btn=e.currentTarget;btn.textContent='✓ Copiado';btn.style.color=P.green;btn.style.borderColor=P.green+'40';setTimeout(()=>{btn.textContent='Copiar';btn.style.color=P.muted;btn.style.borderColor=P.border},1500)})}}
              style={{padding:'4px 10px',background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`,borderRadius:5,fontSize:10,cursor:'pointer',flexShrink:0,fontWeight:600}}>
              Copiar
            </button>
          </div>
        })}
      </div>}
      {/* SA: indicador rápido de código de referido */}
      {isSuperAdmin&&myReferralCode&&<div style={{marginTop:10,fontSize:10,color:P.muted}}>📋 Mi código: <span style={{color:P.purple,fontFamily:'monospace',fontWeight:600}}>{myReferralCode}</span></div>}
    </GlassCard>
  }

  const rejilla=(lista,vacio)=>lista.length===0
    ?<GlassCard style={{padding:40,textAlign:'center'}}><p style={{fontSize:13,color:P.muted,margin:0}}>{vacio}</p></GlassCard>
    :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}}>{lista.map(tarjetaCampana)}</div>

  // Fila compacta de campaña WABA para el resumen de «Todas»
  const filaWA=w=>{
    const col=WA_COLOR[w.status]||P.muted
    return <div key={w.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:10,borderLeft:`3px solid ${col}`}}>
      <span style={{fontSize:14,flexShrink:0}}>🚀</span>
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:0,fontSize:12.5,fontWeight:600,color:P.text,wordBreak:'break-word'}}>{w.name}</p>
        <p style={{margin:'2px 0 0',fontSize:10.5,color:P.muted}}>
          {w.whatsapp_templates?.template_name||'—'} · {fmtDate(w.created_at)}
          {w.total_recipients>0?` · ${w.sent_count||0}/${w.total_recipients} enviados`:''}
        </p>
      </div>
      <Badge label={WA_ESTADO[w.status]||w.status} color={col}/>
    </div>
  }

  const CANALES=[
    ['todas','Todas'],
    ...(isSuperAdmin?[['waba','🚀 WhatsApp (WABA)']]:[]),
    ['enlace','🔗 Enlace'],
    ['otras','📌 Otras'],
    ...(isSuperAdmin?[['admin','⚙ Administrar']]:[]),
  ]

  return <div>
    <SHdr title="Campañas"
      sub={`${visibleCampaigns.length} del CRM${isSuperAdmin?` · ${waCamps.length} envío${waCamps.length!==1?'s':''} WABA · super admin`:' · variantes asignadas a ti'}`}/>

    {/* Selector de canal de entrega */}
    <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
      {CANALES.map(([id,label])=>(
        <button key={id} onClick={()=>setCanal(id)}
          style={{padding:'7px 15px',borderRadius:9,fontSize:12.5,cursor:'pointer',fontFamily:'inherit',
            fontWeight:canal===id?700:500,
            background:canal===id?P.purpleDim:'rgba(255,255,255,0.03)',
            color:canal===id?P.purple:P.muted,
            border:`1px solid ${canal===id?P.purpleBorder:P.border}`}}>
          {label}
        </button>
      ))}
    </div>

    {canal==='waba'&&<CampaignSender user={user}/>}

    {canal==='admin'&&isSuperAdmin&&<AdminCampaigns campaigns={campaigns} setCampaigns={setCampaigns} user={user}/>}

    {canal==='enlace'&&rejilla(conEnlace,
      isSuperAdmin?'No hay campañas con links de referido. Crea variantes en la pestaña «Administrar».':'No tienes variantes habilitadas. Solicita acceso al super admin.')}

    {canal==='otras'&&rejilla(otras,'No hay campañas sin canal de entrega definido.')}

    {canal==='todas'&&<div>
      {/* Recuento por canal */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        {[
          ...(isSuperAdmin?[['🚀 WhatsApp (WABA)',waCamps.length,P.green,'waba']]:[]),
          ['🔗 Enlace',conEnlace.length,P.blue,'enlace'],
          ['📌 Otras',otras.length,P.muted,'otras'],
        ].map(([label,n,col,destino])=>(
          <button key={label} onClick={()=>setCanal(destino)}
            style={{background:P.card,border:`1px solid ${P.border}`,borderLeft:`3px solid ${col}`,borderRadius:12,padding:'13px 15px',textAlign:'left',cursor:'pointer',fontFamily:'inherit'}}>
            <p style={{fontSize:22,fontWeight:800,color:col,margin:0,lineHeight:1}}>{n}</p>
            <p style={{fontSize:10.5,color:P.muted,textTransform:'uppercase',letterSpacing:'0.09em',fontWeight:700,margin:'6px 0 0'}}>{label}</p>
          </button>
        ))}
      </div>

      {isSuperAdmin&&<div style={{marginBottom:22}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'}}>
          <p style={{fontSize:11,fontWeight:800,color:P.green,textTransform:'uppercase',letterSpacing:'0.10em',margin:0}}>Envíos por WhatsApp (WABA)</p>
          <Btn variant="ghost" onClick={()=>setCanal('waba')} style={{fontSize:11,padding:'5px 11px'}}>Gestionar →</Btn>
        </div>
        {waCamps.length===0
          ?<p style={{fontSize:12,color:P.muted,fontStyle:'italic',margin:0}}>Aún no hay envíos por plantilla de WhatsApp.</p>
          :<div style={{display:'flex',flexDirection:'column',gap:7}}>{waCamps.slice(0,6).map(filaWA)}</div>}
        {waCamps.length>6&&<p style={{fontSize:11,color:P.muted,margin:'8px 0 0'}}>y {waCamps.length-6} más en la pestaña WABA</p>}
      </div>}

      <p style={{fontSize:11,fontWeight:800,color:P.blue,textTransform:'uppercase',letterSpacing:'0.10em',margin:'0 0 10px'}}>Campañas con enlace de referido</p>
      <div style={{marginBottom:22}}>
        {rejilla(conEnlace,isSuperAdmin?'No hay campañas con links de referido.':'No tienes variantes habilitadas.')}
      </div>

      {otras.length>0&&<>
        <p style={{fontSize:11,fontWeight:800,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',margin:'0 0 10px'}}>Otras campañas</p>
        {rejilla(otras,'')}
      </>}
    </div>}

    {/* Modal: gestión de asesores por variante (super admin only) */}
    {manageVariant&&isSuperAdmin&&<Modal title={`Asesores · ${manageVariant.label}`} onClose={()=>setManageVariant(null)} accent={manageVariant.color}>
      <div>
        <p style={{fontSize:12,color:P.muted,marginBottom:14}}>Habilita qué asesores pueden compartir esta variante con sus contactos.</p>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {staffList.map(sp=>{
            const a=advisors.find(x=>x.variant_id===manageVariant.id&&x.staff_id===sp.id)
            const on=a?.enabled||false
            return <div key={sp.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,background:'rgba(255,255,255,0.03)',border:`1px solid ${on?manageVariant.color+'40':P.border}`}}>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:600,color:P.text,margin:'0 0 2px'}}>{sp.display_name}</p>
                <p style={{fontSize:11,color:P.muted,margin:0}}>{sp.pessaro_email} · {sp.role}</p>
              </div>
              <button onClick={()=>toggleAdvisorOnVariant(manageVariant.id,sp.id)}
                style={{padding:'6px 14px',borderRadius:6,fontSize:11,fontWeight:600,letterSpacing:'0.05em',cursor:'pointer',
                  background:on?manageVariant.color+'22':'rgba(255,255,255,0.04)',
                  color:on?manageVariant.color:P.muted,
                  border:`1px solid ${on?manageVariant.color+'60':P.border}`,
                  textTransform:'uppercase'}}>
                {on?'✓ Habilitado':'Deshabilitado'}
              </button>
            </div>
          })}
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── ADMIN CAMPAÑAS ───────────────────────────────────────────────────────────
function AdminCampaigns({campaigns,setCampaigns,user}){
  const[showNew,setShowNew]=useState(false)
  const[saving,setSaving]=useState(false)
  const[form,setForm]=useState({name:'',slug:'',description:'',total_spots:50,broker:'',historical_return:'+502%',target_capital:'',start_date:'',status:'activa'})
  const[err,setErr]=useState({})
  const[variants,setVariants]=useState({})
  const[staff,setStaff]=useState([])
  const[leadCounts,setLeadCounts]=useState({})
  const[advLeadCounts,setAdvLeadCounts]=useState({})
  const[varAdvisors,setVarAdvisors]=useState({})
  const[managingVar,setManagingVar]=useState(null)
  const[generatingCode,setGeneratingCode]=useState(null)
  const[copiedLink,setCopiedLink]=useState(null)
  const[showReferrals,setShowReferrals]=useState({})
  const STATUS_C={activa:P.green,pausada:P.orange,cerrada:P.muted}
  const VAR_COLORS={navy:'#4a7cdc',editorial:'#a8451f',bold:'#c8e000',minimalist:'#C9A84C'}
  const FALLBACK_VARIANTS=[
    {variant_key:'navy',label:'Navy',color:'#4a7cdc',status:'activa'},
    {variant_key:'editorial',label:'Editorial',color:'#a8451f',status:'activa'},
    {variant_key:'bold',label:'Bold',color:'#c8e000',status:'activa'},
    {variant_key:'minimalist',label:'Minimalist',color:'#C9A84C',status:'activa'},
  ]
  const ROLE_LABEL={super_admin:'Super Admin',admin:'Admin',asesor:'Asesor'}
  const ROLE_COLOR={super_admin:P.orange,admin:P.blue,asesor:P.purple}

  const loadAdminData=useCallback(async()=>{
    try{
      const{data:v}=await supabase.from('campaign_variants').select('*').order('variant_key')
      if(v&&v.length>0){
        const m={}
        v.forEach(x=>{if(!m[x.campaign_id])m[x.campaign_id]=[];m[x.campaign_id].push(x)})
        setVariants(m)
      }
    }catch(e){console.warn('campaign_variants:',e)}
    try{
      const{data:s}=await supabase.from('crm_staff_profiles').select('id,display_name,title,role,referral_code,user_id').order('display_name')
      setStaff(s||[])
    }catch(e){console.warn('staff:',e)}
    try{
      const{data:l}=await supabase.from('campaign_leads').select('variant,advisor_referral_code')
      if(l){
        const vc={},ac={}
        l.forEach(x=>{
          if(x.variant)vc[x.variant]=(vc[x.variant]||0)+1
          if(x.advisor_referral_code)ac[x.advisor_referral_code]=(ac[x.advisor_referral_code]||0)+1
        })
        setLeadCounts(vc)
        setAdvLeadCounts(ac)
      }
    }catch(e){console.warn('leads:',e)}
  },[])

  useEffect(()=>{loadAdminData()},[loadAdminData])

  const getCampVariants=cid=>{
    const v=variants[cid]
    if(v&&v.length>0)return v
    return FALLBACK_VARIANTS.map(f=>({...f,campaign_id:cid,landing_url:`https://pessaro.cl/campana/${f.variant_key}`}))
  }

  const validate=()=>{
    const e={}
    if(!form.name.trim())e.name='Obligatorio'
    if(!form.slug.trim())e.slug='Obligatorio'
    else if(!/^[a-z0-9-]+$/.test(form.slug))e.slug='Solo minúsculas, números y guiones'
    setErr(e);return!Object.keys(e).length
  }

  const create=async()=>{
    if(!validate())return
    setSaving(true)
    const{data,error}=await supabase.from('campaigns').insert({...form,total_spots:Number(form.total_spots)||50,created_by:user.id}).select().single()
    setSaving(false)
    if(error){setErr({slug:error.message});return}
    setCampaigns(p=>[...p,data])
    setShowNew(false)
    setForm({name:'',slug:'',description:'',total_spots:50,broker:'',historical_return:'+502%',target_capital:'',start_date:'',status:'activa'})
    setErr({})
  }

  const updateStatus=async(id,status)=>{
    await supabase.from('campaigns').update({status}).eq('id',id)
    setCampaigns(p=>p.map(c=>c.id===id?{...c,status}:c))
  }

  const updateVariantStatus=async(variant,newStatus)=>{
    if(!variant.id)return
    try{
      await supabase.from('campaign_variants').update({status:newStatus}).eq('id',variant.id)
      setVariants(prev=>{
        const cid=variant.campaign_id
        return{...prev,[cid]:(prev[cid]||[]).map(v=>v.id===variant.id?{...v,status:newStatus}:v)}
      })
    }catch(e){console.error(e)}
  }

  const generateCode=async s=>{
    setGeneratingCode(s.id)
    const name=s.display_name||'USR'
    const prefix=name.replace(/\s+/g,'').slice(0,3).toUpperCase().padEnd(3,'X')
    const suffix=Math.random().toString(36).slice(2,7).toUpperCase()
    const code=prefix+suffix
    try{
      await supabase.from('crm_staff_profiles').update({referral_code:code}).eq('id',s.id)
      setStaff(prev=>prev.map(x=>x.id===s.id?{...x,referral_code:code}:x))
    }catch(e){console.error(e)}
    setGeneratingCode(null)
  }

  const copyLink=async text=>{
    try{await navigator.clipboard.writeText(text);setCopiedLink(text);setTimeout(()=>setCopiedLink(null),2000)}catch(e){}
  }

  const openManageAdvisors=async v=>{
    setManagingVar(v)
    if(!v.id)return
    try{
      const{data}=await supabase.from('variant_advisors').select('*').eq('variant_id',v.id)
      setVarAdvisors(prev=>({...prev,[v.id]:data||[]}))
    }catch(e){console.warn('var_advisors:',e)}
  }

  const toggleAdvisor=async(variantId,staffId)=>{
    const advisors=varAdvisors[variantId]||[]
    const existing=advisors.find(a=>a.staff_id===staffId)
    try{
      if(existing){
        await supabase.from('variant_advisors').update({enabled:!existing.enabled}).eq('id',existing.id)
        setVarAdvisors(prev=>({...prev,[variantId]:prev[variantId].map(a=>a.staff_id===staffId?{...a,enabled:!a.enabled}:a)}))
      }else{
        const{data}=await supabase.from('variant_advisors').insert({variant_id:variantId,staff_id:staffId,enabled:true,granted_by:user.id,granted_at:new Date().toISOString()}).select().single()
        if(data)setVarAdvisors(prev=>({...prev,[variantId]:[...(prev[variantId]||[]),data]}))
      }
    }catch(e){console.error(e)}
  }

  return <div>
    <SHdr title="Gestionar Campañas" sub="Crea y administra campañas · solo super admin"
      action={<Btn onClick={()=>setShowNew(true)}>+ Nueva campaña</Btn>}/>
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      {campaigns.map(c=>{
        const campVariants=getCampVariants(c.id)
        const activeVariants=campVariants.filter(v=>v.status==='activa')
        return <GlassCard key={c.id} style={{borderLeft:`3px solid ${STATUS_C[c.status]}`}}>
          {/* Campaign header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:14}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <Badge label={c.status} color={STATUS_C[c.status]}/>
                <span style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{c.slug}</span>
              </div>
              <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:P.text}}>{c.name}</h3>
              {c.description&&<p style={{margin:'0 0 10px',fontSize:13,color:P.muted}}>{c.description}</p>}
              <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
                {[['Cupos',c.total_spots],['Broker',c.broker||'—'],['Retorno',c.historical_return||'—'],['Capital obj.',c.target_capital||'—']].map(([k,v])=>(
                  <span key={k} style={{fontSize:11,color:P.muted}}><strong style={{color:P.textSub}}>{k}:</strong> {v}</span>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              {['activa','pausada','cerrada'].map(s=>(
                <button key={s} onClick={()=>updateStatus(c.id,s)} disabled={c.status===s}
                  style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:c.status===s?'default':'pointer',
                    background:c.status===s?STATUS_C[s]+'25':'rgba(255,255,255,0.04)',
                    color:c.status===s?STATUS_C[s]:P.muted,
                    border:`1px solid ${c.status===s?STATUS_C[s]+'40':P.border}`,fontWeight:600}}>
                  {s[0].toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:10,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',margin:'0 0 10px'}}>Variantes de landing</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:10}}>
              {campVariants.map(v=>{
                const vc=v.color||VAR_COLORS[v.variant_key]||P.purple
                const leads=leadCounts[v.variant_key]||0
                const url=v.landing_url||`https://pessaro.cl/campana/${v.variant_key}`
                const isHardcoded=!v.id
                return <div key={v.variant_key} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${vc}30`,borderRadius:10,padding:'12px 14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:10,height:10,borderRadius:2,background:vc,flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:P.text}}>{v.label||v.variant_key}</span>
                    </div>
                    <span style={{fontSize:10,fontWeight:600,color:P.muted,background:'rgba(255,255,255,0.05)',padding:'2px 7px',borderRadius:4}}>{leads} leads</span>
                  </div>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    style={{fontSize:10,color:vc,fontFamily:'monospace',display:'block',marginBottom:10,wordBreak:'break-all',textDecoration:'none',lineHeight:1.4}}
                    onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                    onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>
                    {url}
                  </a>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6}}>
                    {!isHardcoded&&<div style={{display:'flex',gap:4}}>
                      {['activa','pausada'].map(s=>(
                        <button key={s} onClick={()=>updateVariantStatus(v,s)} disabled={v.status===s}
                          style={{padding:'3px 8px',borderRadius:5,fontSize:10,cursor:v.status===s?'default':'pointer',
                            background:v.status===s?(s==='activa'?P.greenDim:P.orangeDim):'rgba(255,255,255,0.04)',
                            color:v.status===s?(s==='activa'?P.green:P.orange):P.muted,
                            border:`1px solid ${v.status===s?(s==='activa'?P.green+'40':P.orange+'40'):P.border}`,fontWeight:600}}>
                          {s==='activa'?'Activa':'Pausada'}
                        </button>
                      ))}
                    </div>}
                    {isHardcoded&&<span style={{fontSize:10,color:P.muted,fontStyle:'italic'}}>Fallback local</span>}
                    <Btn variant="ghost" onClick={()=>openManageAdvisors(v)} style={{padding:'3px 8px',fontSize:10}}>Asesores</Btn>
                  </div>
                </div>
              })}
            </div>
          </div>

          {/* Referral codes */}
          <div style={{marginBottom:14}}>
            <button onClick={()=>setShowReferrals(p=>({...p,[c.id]:!p[c.id]}))}
              style={{display:'flex',alignItems:'center',gap:7,background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 14px',cursor:'pointer',width:'100%',textAlign:'left',marginBottom:showReferrals[c.id]?10:0}}>
              <span style={{fontSize:12,fontWeight:600,color:P.textSub}}>🔗 Códigos de referido</span>
              <span style={{fontSize:11,color:P.muted,marginLeft:'auto'}}>{staff.length} asesores · {staff.filter(s=>s.referral_code).length} con código</span>
              <span style={{fontSize:12,color:P.muted,marginLeft:6}}>{showReferrals[c.id]?'▲':'▼'}</span>
            </button>
            {showReferrals[c.id]&&<div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,border:`1px solid ${P.border}`,overflow:'auto'}}>
              <div style={{padding:'9px 14px',borderBottom:`1px solid ${P.border}`,display:'grid',gridTemplateColumns:'1.6fr 0.8fr 1.1fr 3fr 0.5fr',gap:8,minWidth:700}}>
                {['Nombre','Rol','Código','Links por variante','Leads'].map(h=>(
                  <span key={h} style={{fontSize:10,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'0.07em'}}>{h}</span>
                ))}
              </div>
              {staff.length===0&&<p style={{padding:'14px',fontSize:13,color:P.muted,margin:0}}>No hay staff registrado.</p>}
              {staff.map(s=>(
                <div key={s.id} style={{padding:'10px 14px',borderBottom:`1px solid ${P.border}`,display:'grid',gridTemplateColumns:'1.6fr 0.8fr 1.1fr 3fr 0.5fr',gap:8,alignItems:'center',minWidth:700}}>
                  <div style={{fontSize:13,fontWeight:600,color:P.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.display_name||'—'}</div>
                  <div>{s.role&&<Badge label={ROLE_LABEL[s.role]||s.role} color={ROLE_COLOR[s.role]||P.muted}/>}</div>
                  <div>
                    {s.referral_code
                      ?<span style={{fontSize:11,fontFamily:'monospace',color:P.green,background:P.greenDim,padding:'2px 7px',borderRadius:4}}>{s.referral_code}</span>
                      :<Btn variant="ghost" onClick={()=>generateCode(s)} disabled={generatingCode===s.id} style={{padding:'3px 8px',fontSize:11}}>{generatingCode===s.id?'…':'Generar código'}</Btn>
                    }
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {s.referral_code
                      ?activeVariants.map(v=>{
                          const link=`https://pessaro.cl/campana/${v.variant_key}?ref=${s.referral_code}`
                          const vc=v.color||VAR_COLORS[v.variant_key]||P.purple
                          return <div key={v.variant_key} style={{display:'flex',alignItems:'center',gap:5}}>
                            <div style={{width:7,height:7,borderRadius:1,background:vc,flexShrink:0}}/>
                            <span style={{fontSize:10,color:P.muted,fontFamily:'monospace',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{link}</span>
                            <button onClick={()=>copyLink(link)} style={{background:'none',border:`1px solid ${copiedLink===link?P.green:P.border}`,borderRadius:4,padding:'2px 6px',color:copiedLink===link?P.green:P.muted,fontSize:10,cursor:'pointer',flexShrink:0,transition:'all 0.1s'}}>
                              {copiedLink===link?'✓':'Copiar'}
                            </button>
                          </div>
                        })
                      :<span style={{fontSize:11,color:P.muted,fontStyle:'italic'}}>Asigna un código primero</span>
                    }
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:s.referral_code?P.text:P.muted,textAlign:'center'}}>
                    {s.referral_code?(advLeadCounts[s.referral_code]||0):'—'}
                  </div>
                </div>
              ))}
            </div>}
          </div>

          <div style={{padding:'8px 12px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:`1px solid ${P.border}`}}>
            <p style={{fontSize:11,color:P.muted,margin:0}}>
              Los asesores ven <strong style={{color:P.text}}>🚀 {c.name}</strong> en su sidebar {c.status==='activa'?'✓':'· pausada/cerrada = oculta para asesores'}.
            </p>
          </div>
        </GlassCard>
      })}
      {campaigns.length===0&&<GlassCard><p style={{color:P.muted,fontSize:14,textAlign:'center',padding:'20px 0',margin:0}}>No hay campañas. Crea la primera.</p></GlassCard>}
    </div>

    {showNew&&<Modal title="Nueva campaña" onClose={()=>setShowNew(false)} accent={P.green}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Nombre *</Lbl>
            <Input value={form.name} onChange={v=>setForm(p=>({...p,name:v,slug:v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}))} placeholder="Campaña Q3 2026"/>
            {err.name&&<p style={{fontSize:11,color:P.red,margin:'3px 0 0'}}>{err.name}</p>}
          </div>
          <div><Lbl>Slug *</Lbl>
            <Input value={form.slug} onChange={v=>setForm(p=>({...p,slug:v}))} placeholder="q3-2026"/>
            {err.slug&&<p style={{fontSize:11,color:P.red,margin:'3px 0 0'}}>{err.slug}</p>}
          </div>
          <div><Lbl>Broker</Lbl><Input value={form.broker} onChange={v=>setForm(p=>({...p,broker:v}))} placeholder="Radex / Tradeview"/></div>
          <div><Lbl>Cupos</Lbl><Input value={form.total_spots} onChange={v=>setForm(p=>({...p,total_spots:v}))} type="number" placeholder="50"/></div>
          <div><Lbl>Retorno histórico</Lbl><Input value={form.historical_return} onChange={v=>setForm(p=>({...p,historical_return:v}))} placeholder="+502%"/></div>
          <div><Lbl>Capital objetivo</Lbl><Input value={form.target_capital} onChange={v=>setForm(p=>({...p,target_capital:v}))} placeholder="$500,000 USD"/></div>
          <div><Lbl>Fecha inicio</Lbl><Input value={form.start_date} onChange={v=>setForm(p=>({...p,start_date:v}))} type="date"/></div>
          <div><Lbl>Estado</Lbl><Sel value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={[{value:'activa',label:'Activa'},{value:'pausada',label:'Pausada'}]}/></div>
        </div>
        <div><Lbl>Descripción</Lbl>
          <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Descripción..."
            style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:10,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:60,resize:'vertical',fontFamily:'inherit'}}/>
        </div>
        <div style={{padding:'8px 12px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}>
          <p style={{fontSize:12,color:P.green,margin:0}}>✓ Aparecerá automáticamente en el sidebar de todos los asesores.</p>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setShowNew(false)}>Cancelar</Btn>
          <Btn onClick={create} disabled={saving}>{saving?'Creando...':'Crear campaña'}</Btn>
        </div>
      </div>
    </Modal>}

    {managingVar&&<Modal title={`Asesores — ${managingVar.label||managingVar.variant_key}`} onClose={()=>setManagingVar(null)} accent={managingVar.color||P.purple}>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <p style={{fontSize:13,color:P.muted,margin:0}}>Habilita o deshabilita el acceso de cada asesor a esta variante y su link de referido.</p>
        {!managingVar.id&&<div style={{padding:'10px 12px',background:P.orangeDim,border:`1px solid ${P.orange}30`,borderRadius:8}}>
          <p style={{fontSize:12,color:P.orange,margin:0}}>Esta es una variante de fallback sin registro en DB. Guárdala en la tabla campaign_variants para gestionar permisos.</p>
        </div>}
        {managingVar.id&&<div>
          {staff.length===0&&<p style={{fontSize:13,color:P.muted}}>No hay staff registrado.</p>}
          {staff.map(s=>{
            const advisors=varAdvisors[managingVar.id]||[]
            const adv=advisors.find(a=>a.staff_id===s.id)
            const enabled=adv?.enabled??false
            return <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${P.border}`}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:P.text}}>{s.display_name||'—'}</div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                  {s.role&&<Badge label={ROLE_LABEL[s.role]||s.role} color={ROLE_COLOR[s.role]||P.muted}/>}
                  {s.referral_code&&<span style={{fontSize:10,color:P.muted,fontFamily:'monospace'}}>{s.referral_code}</span>}
                </div>
              </div>
              <button onClick={()=>toggleAdvisor(managingVar.id,s.id)}
                style={{padding:'6px 14px',borderRadius:7,fontSize:12,fontWeight:600,cursor:'pointer',
                  background:enabled?P.greenDim:P.redDim,color:enabled?P.green:P.red,
                  border:`1px solid ${enabled?P.green+'40':P.red+'40'}`}}>
                {enabled?'✓ Habilitado':'✗ Desactivado'}
              </button>
            </div>
          })}
        </div>}
        <div style={{display:'flex',justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setManagingVar(null)}>Cerrar</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
function Tasks({contacts,leads,user,isSuperAdmin}){
  const[tasks,setTasks]=useState([])
  const[loading,setLoading]=useState(true)
  const[showAdd,setShowAdd]=useState(false)
  const[filter,setFilter]=useState('pendientes')
  const[staffFilter,setStaffFilter]=useState('todos')
  const[staffList,setStaffList]=useState([])
  const[form,setForm]=useState({title:'',priority:'media',due_date:'',contact_id:'',task_type:'otro',description:'',assigned_to:'',reminder:false})
  const[continueTask,setContinueTask]=useState(null)
  const[updates,setUpdates]=useState([])
  const[loadingUpdates,setLoadingUpdates]=useState(false)
  const[updateNote,setUpdateNote]=useState('')
  const[updateStatus,setUpdateStatus]=useState('')
  const[savingUpdate,setSavingUpdate]=useState(false)
  const[namesByUid,setNamesByUid]=useState({})

  const load=useCallback(async()=>{
    setLoading(true)
    try{const{data}=await supabase.from('crm_tasks').select('*').order('due_date',{ascending:true,nullsFirst:false});setTasks(data||[])}
    catch(e){console.error(e)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])
  useEffect(()=>{
    if(!isSuperAdmin)return
    ;(async()=>{const{data}=await supabase.from('crm_staff_profiles').select('user_id,display_name').order('display_name');setStaffList(data||[])})()
  },[isSuperAdmin])

  const todayStr=new Date().toISOString().split('T')[0]
  const isOverdue=t=>!t.done&&t.status!=='completada'&&t.status!=='cancelada'&&t.due_date&&t.due_date<todayStr
  const isToday=t=>!t.done&&t.status!=='completada'&&t.due_date===todayStr
  const isPending=t=>!t.done&&t.status!=='completada'&&t.status!=='cancelada'
  const isDone=t=>t.done||t.status==='completada'

  const byStaff=(()=>{
    if(!isSuperAdmin||staffFilter==='todos')return tasks
    return tasks.filter(t=>t.assigned_to===staffFilter)
  })()

  const filtered=(()=>{
    switch(filter){
      case 'hoy':return byStaff.filter(t=>isToday(t))
      case 'vencidas':return byStaff.filter(t=>isOverdue(t))
      case 'completadas':return byStaff.filter(t=>isDone(t))
      case 'todas':return byStaff
      default:return byStaff.filter(t=>isPending(t))
    }
  })()
  const pendingCount=byStaff.filter(t=>isPending(t)&&!isOverdue(t)).length
  const todayCount=byStaff.filter(t=>isToday(t)).length
  const overdueCount=byStaff.filter(t=>isOverdue(t)).length
  const doneCount=byStaff.filter(t=>isDone(t)).length

  const TASK_TYPE_ICONS={enviar_invitacion_wafinance:'💹',llamar_cliente:'📞',enviar_correo:'📧',seguimiento_whatsapp:'💬',reunion:'📅',revisar_documentos:'📄',otro:'📌'}
  const TASK_TYPE_OPT=[
    {value:'enviar_invitacion_wafinance',label:'Enviar invitación WAFinance'},
    {value:'llamar_cliente',label:'Llamar cliente'},
    {value:'enviar_correo',label:'Enviar correo'},
    {value:'seguimiento_whatsapp',label:'Seguimiento WhatsApp'},
    {value:'reunion',label:'Reunión'},
    {value:'revisar_documentos',label:'Revisar documentos'},
    {value:'otro',label:'Otro'},
  ]
  const STATUS_OPT=[
    {value:'',label:'Sin cambio de estado'},
    {value:'en_progreso',label:'Marcar en progreso'},
    {value:'completada',label:'Marcar completada'},
    {value:'cancelada',label:'Marcar cancelada'},
    {value:'pendiente',label:'Reabrir como pendiente'},
  ]

  const addTask=async()=>{
    if(!form.title)return
    const payload={
      title:form.title,priority:form.priority,due_date:form.due_date||null,
      done:false,status:'pendiente',task_type:form.task_type||'otro',
      description:form.description||'',
      assigned_to:form.assigned_to||user?.id||null,
      created_by:user?.id,
    }
    if(form.contact_id)payload.contact_id=form.contact_id
    if(form.reminder&&form.due_date)payload.reminder_at=new Date(new Date(form.due_date).getTime()-86400000).toISOString()
    const{data,error}=await supabase.from('crm_tasks').insert(payload).select().single()
    if(data&&!error){
      setTasks(p=>[data,...p])
      setShowAdd(false)
      setForm({title:'',priority:'media',due_date:'',contact_id:'',task_type:'otro',description:'',assigned_to:'',reminder:false})
      try{
        const{data:{session}}=await supabase.auth.getSession()
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/task_notifications`,{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token}`},
          body:JSON.stringify({action:'notify_new_task',task_id:data.id})
        }).catch(e=>console.warn('notify_new_task:',e))
      }catch(e){console.warn('notify_new_task session:',e)}
    }
  }
  const completeTask=async id=>{
    await supabase.from('crm_tasks').update({done:true,status:'completada',completed_at:new Date().toISOString()}).eq('id',id)
    setTasks(p=>p.map(t=>t.id===id?{...t,done:true,status:'completada',completed_at:new Date().toISOString()}:t))
  }
  const cancelTask=async id=>{
    await supabase.from('crm_tasks').update({status:'cancelada'}).eq('id',id)
    setTasks(p=>p.map(t=>t.id===id?{...t,status:'cancelada'}:t))
  }
  const deleteTask=async id=>{await supabase.from('crm_tasks').delete().eq('id',id);setTasks(p=>p.filter(t=>t.id!==id))}
  const getContactName=t=>{
    if(t.contact_id)return contacts.find(c=>c.id===t.contact_id)?.full_name||''
    if(t.contact_submission_id)return contacts.find(c=>c.id===t.contact_submission_id)?.full_name||''
    if(t.campaign_lead_id)return leads.find(l=>l.id===t.campaign_lead_id)?.full_name||''
    return''
  }
  const getAdvisorName=uid=>staffList.find(s=>s.user_id===uid)?.display_name||''
  const taskCode=t=>t.task_number?`TSK-${String(t.task_number).padStart(5,'0')}`:`TSK-${t.id.slice(0,5).toUpperCase()}`

  // ── Bitácora / continuación de tarea ──────────────────────────────────────
  const openContinue=async t=>{
    setContinueTask(t)
    setUpdateNote('')
    setUpdateStatus('')
    setLoadingUpdates(true)
    try{
      const{data}=await supabase.from('crm_task_updates').select('*').eq('task_id',t.id).order('created_at',{ascending:false})
      setUpdates(data||[])
      const uids=[...new Set((data||[]).map(u=>u.created_by).filter(Boolean))]
      const missing=uids.filter(uid=>!namesByUid[uid])
      if(missing.length){
        const{data:profiles}=await supabase.from('crm_staff_profiles').select('user_id,display_name').in('user_id',missing)
        if(profiles?.length)setNamesByUid(p=>({...p,...Object.fromEntries(profiles.map(pr=>[pr.user_id,pr.display_name]))}))
      }
    }catch(e){console.error(e)}
    finally{setLoadingUpdates(false)}
  }
  const closeContinue=()=>{setContinueTask(null);setUpdates([]);setUpdateNote('');setUpdateStatus('')}

  const saveUpdate=async()=>{
    if(!continueTask||!updateNote.trim())return
    setSavingUpdate(true)
    try{
      const payload={task_id:continueTask.id,note:updateNote.trim(),status_change:updateStatus||null,created_by:user?.id}
      const{data,error}=await supabase.from('crm_task_updates').insert(payload).select().single()
      if(error)throw error
      setUpdates(p=>[data,...p])
      setUpdateNote('')
      if(updateStatus){
        const patch=updateStatus==='completada'
          ?{status:'completada',done:true,completed_at:new Date().toISOString()}
          :{status:updateStatus,done:false,completed_at:null}
        await supabase.from('crm_tasks').update(patch).eq('id',continueTask.id)
        setTasks(p=>p.map(t=>t.id===continueTask.id?{...t,...patch}:t))
        setContinueTask(p=>p?{...p,...patch}:p)
      }
      setUpdateStatus('')
    }catch(e){console.error(e);alert('No se pudo guardar la actualización')}
    finally{setSavingUpdate(false)}
  }

  const FilterBtn=({id,label,count,color})=>(
    <button onClick={()=>setFilter(id)} style={{padding:'6px 14px',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:filter===id?700:400,background:filter===id?(color||P.purple)+'22':'rgba(255,255,255,0.04)',color:filter===id?(color||P.purple):P.muted,border:`1px solid ${filter===id?(color||P.purple)+'50':P.border}`}}>
      {label}{count>0&&<span style={{marginLeft:5,background:color||P.purple,color:'#fff',borderRadius:8,fontSize:9,padding:'1px 5px',fontWeight:700}}>{count}</span>}
    </button>
  )

  return <div>
    <SHdr title="Tareas" sub={`${pendingCount} pendientes · ${overdueCount} vencidas`} action={<Btn onClick={()=>setShowAdd(true)}>+ Nueva tarea</Btn>}/>
    <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
      <FilterBtn id="pendientes" label="Pendientes" count={pendingCount} color={P.orange}/>
      <FilterBtn id="hoy" label="Hoy" count={todayCount} color={P.purple}/>
      <FilterBtn id="vencidas" label="Vencidas" count={overdueCount} color={P.red}/>
      <FilterBtn id="completadas" label="Completadas" count={doneCount} color={P.green}/>
      <FilterBtn id="todas" label="Todas" count={byStaff.length} color={P.muted}/>
      {isSuperAdmin&&staffList.length>0&&<Sel value={staffFilter} onChange={setStaffFilter} style={{maxWidth:200,marginLeft:'auto'}}
        options={[{value:'todos',label:'Ver por asesor: Todos'},...staffList.map(s=>({value:s.user_id,label:s.display_name}))]}/>}
    </div>
    {loading?<Spinner/>:<div>
      {filtered.length===0&&<div style={{textAlign:'center',padding:'40px 0',color:P.muted,fontSize:13}}>
        {filter==='pendientes'?'¡Todo al día! No hay tareas pendientes.':filter==='hoy'?'No hay tareas para hoy.':filter==='vencidas'?'Sin tareas vencidas.':'Sin tareas completadas.'}
      </div>}
      {filtered.map(t=>{
        const overdue=isOverdue(t),done=isDone(t),icon=TASK_TYPE_ICONS[t.task_type]||'📌',cName=getContactName(t),advisorName=isSuperAdmin?getAdvisorName(t.assigned_to):''
        return <GlassCard key={t.id} style={{marginBottom:10,display:'flex',gap:12,alignItems:'flex-start',borderLeft:`3px solid ${done?P.green:overdue?P.red:PRIO_COLOR[t.priority]||P.orange}`,opacity:done?0.5:1}}>
          <div style={{paddingTop:2,flexShrink:0}}>
            {done?<div style={{width:20,height:20,borderRadius:6,background:P.green,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',fontSize:10,fontWeight:700}}>✓</div>
            :<button onClick={()=>completeTask(t.id)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${PRIO_COLOR[t.priority]||P.orange}`,background:'transparent',cursor:'pointer'}} title="Completar"/>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
              <span style={{fontSize:13}}>{icon}</span>
              <span style={{fontSize:10,color:P.muted,fontFamily:'monospace',background:'rgba(255,255,255,0.05)',borderRadius:4,padding:'1px 6px'}}>{taskCode(t)}</span>
              <p style={{fontSize:14,fontWeight:500,color:done?P.muted:P.text,margin:0,textDecoration:done?'line-through':'none'}}>{t.title}</p>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {cName&&<span style={{fontSize:11,color:P.purple,background:P.purpleDim,borderRadius:4,padding:'1px 6px'}}>{cName}</span>}
              {advisorName&&<span style={{fontSize:11,color:P.blue,background:P.blue+'1a',borderRadius:4,padding:'1px 6px'}}>👤 {advisorName}</span>}
              <Badge label={t.priority||'media'} color={PRIO_COLOR[t.priority]||P.orange}/>
              {t.due_date&&<span style={{fontSize:11,color:overdue?P.red:P.muted,fontWeight:overdue?600:400}}>{overdue?'⚠ ':''}{fmtDate(t.due_date)}</span>}
            </div>
            {t.description&&<p style={{fontSize:11,color:P.muted,margin:'4px 0 0',lineHeight:1.5}}>{t.description}</p>}
          </div>
          <div style={{display:'flex',gap:4,flexShrink:0,alignItems:'center'}}>
            <Btn variant="ghost" style={{padding:'3px 8px',fontSize:11}} onClick={()=>openContinue(t)}>Continuar →</Btn>
            {!done&&t.status!=='cancelada'&&<Btn variant="ghost" style={{padding:'3px 8px',fontSize:11}} onClick={()=>completeTask(t.id)}>✓</Btn>}
            {!done&&t.status!=='cancelada'&&<button onClick={()=>cancelTask(t.id)} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:14,padding:'2px 4px'}} title="Cancelar">✕</button>}
            {(done||t.status==='cancelada')&&<button onClick={()=>deleteTask(t.id)} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:12,padding:'2px 4px'}} title="Eliminar">🗑</button>}
          </div>
        </GlassCard>
      })}
    </div>}
    {showAdd&&<Modal title="Nueva Tarea" onClose={()=>setShowAdd(false)} accent={P.orange}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div><Lbl>Título *</Lbl><Input value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Ej: Llamar a Gabriel Rojas"/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Tipo de tarea</Lbl><Sel value={form.task_type} onChange={v=>setForm(p=>({...p,task_type:v}))} options={TASK_TYPE_OPT}/></div>
          <div><Lbl>Prioridad</Lbl><Sel value={form.priority} onChange={v=>setForm(p=>({...p,priority:v}))} options={[{value:'alta',label:'Alta'},{value:'media',label:'Media'},{value:'baja',label:'Baja'}]}/></div>
        </div>
        <div><Lbl>Contacto vinculado</Lbl><Sel value={form.contact_id} onChange={v=>setForm(p=>({...p,contact_id:v}))} options={[{value:'',label:'Sin contacto'},...contacts.filter(c=>!c.id.startsWith('sub_')).map(c=>({value:c.id,label:c.full_name||c.email}))]}/></div>
        {isSuperAdmin&&staffList.length>0&&<div><Lbl>Asignar a</Lbl><Sel value={form.assigned_to} onChange={v=>setForm(p=>({...p,assigned_to:v}))} options={[{value:'',label:'A mí mismo'},...staffList.map(s=>({value:s.user_id,label:s.display_name}))]}/></div>}
        <div><Lbl>Fecha límite</Lbl><Input value={form.due_date} onChange={v=>setForm(p=>({...p,due_date:v}))} type="date"/></div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input type="checkbox" id="task-reminder" checked={form.reminder} onChange={e=>setForm(p=>({...p,reminder:e.target.checked}))} style={{width:14,height:14,cursor:'pointer'}}/>
          <label htmlFor="task-reminder" style={{fontSize:12,color:P.textSub,cursor:'pointer'}}>Enviar recordatorio por email 1 día antes</label>
        </div>
        <div><Lbl>Descripción</Lbl><Input value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="Detalles adicionales..."/></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn>
          <Btn onClick={addTask} disabled={!form.title}>Crear Tarea</Btn>
        </div>
      </div>
    </Modal>}
    {continueTask&&<Modal title={`${taskCode(continueTask)} · ${continueTask.title}`} onClose={closeContinue} accent={P.blue}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <Badge label={continueTask.status||'pendiente'} color={continueTask.status==='completada'?P.green:continueTask.status==='cancelada'?P.red:P.orange}/>
          {isSuperAdmin&&getAdvisorName(continueTask.assigned_to)&&<span style={{fontSize:11,color:P.blue,background:P.blue+'1a',borderRadius:4,padding:'1px 6px'}}>👤 {getAdvisorName(continueTask.assigned_to)}</span>}
          {getContactName(continueTask)&&<span style={{fontSize:11,color:P.purple,background:P.purpleDim,borderRadius:4,padding:'1px 6px'}}>{getContactName(continueTask)}</span>}
        </div>

        <div>
          <Lbl>Agregar actualización</Lbl>
          <textarea value={updateNote} onChange={e=>setUpdateNote(e.target.value)} placeholder="Ej: Contacté al cliente, quedó de confirmar el jueves..."
            rows={3} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',resize:'vertical'}}/>
        </div>
        <div><Lbl>Cambio de estado (opcional)</Lbl><Sel value={updateStatus} onChange={setUpdateStatus} options={STATUS_OPT}/></div>
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <Btn onClick={saveUpdate} disabled={!updateNote.trim()||savingUpdate}>{savingUpdate?'Guardando...':'Guardar actualización'}</Btn>
        </div>

        <div style={{borderTop:`1px solid ${P.border}`,paddingTop:14}}>
          <Lbl>Bitácora</Lbl>
          {loadingUpdates?<Spinner/>:updates.length===0?
            <p style={{fontSize:12,color:P.muted}}>Sin actualizaciones todavía.</p>:
            <div style={{display:'flex',flexDirection:'column',gap:10,maxHeight:280,overflowY:'auto'}}>
              {updates.map(u=><div key={u.id} style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'10px 12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:600,color:P.text}}>{namesByUid[u.created_by]||(u.created_by===user?.id?'Tú':'Asesor')}</span>
                  <span style={{fontSize:10,color:P.muted}}>{new Date(u.created_at).toLocaleString('es-CL')}</span>
                </div>
                {u.status_change&&<Badge label={`→ ${u.status_change}`} color={P.blue}/>}
                <p style={{fontSize:12,color:P.textSub,margin:'6px 0 0',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{u.note}</p>
              </div>)}
            </div>}
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── EMAILS ───────────────────────────────────────────────────────────────────
function Emails({contacts,leads,staffProfile,user,isSuperAdmin}){
  const[emails,setEmails]=useState([])
  const[loading,setLoading]=useState(true)
  const[tab,setTab]=useState('historial')
  const[showModal,setShowModal]=useState(false)
  const[sending,setSending]=useState(false)
  const[sent,setSent]=useState(null)
  const[form,setForm]=useState({template:'bienvenida_lead',source_id:'',extra_text:'',custom_subject:'',teams_url:''})
  const[recipientSearch,setRecipientSearch]=useState('')
  const[recipientOpen,setRecipientOpen]=useState(false)
  const[files,setFiles]=useState([])
  const[dragOver,setDragOver]=useState(false)

  const loadHistory=useCallback(async()=>{
    setLoading(true)
    try{
      let q=supabase.from('email_tracking').select('*').order('sent_at',{ascending:false}).limit(60)
      if(!isSuperAdmin)q=q.eq('sent_by',user.id)
      const{data}=await q
      setEmails(data||[])
    }
    catch(e){console.error(e)}
    finally{setLoading(false)}
  },[isSuperAdmin,user.id])
  useEffect(()=>{loadHistory()},[loadHistory])

  const sc={sent:P.blue,delivered:P.blue,opened:P.green,clicked:P.green,bounced:P.red,complained:P.red,delayed:P.orange}
  const teamName=staffProfile?.crm_teams?.name||''
  // Invitación Radex/Tradeview: visible solo para su equipo (o Pessaro Capital, que ve todo). El resto de plantillas queda libre.
  const visibleTemplates=TEMPLATES.filter(t=>{
    if(t.id==='accesos_crm')return isSuperAdmin
    if(t.id==='invitacion_radex')return isSuperAdmin||teamName==='Pessaro Capital'||teamName==='Radex'
    if(t.id==='invitacion_tradeview')return isSuperAdmin||teamName==='Pessaro Capital'||teamName==='Tradeview'
    return true
  })
  const allRecipients=[
    ...contacts.map(c=>({id:c.id,name:c.full_name,email:c.email,type:'contact'})),
    ...leads.filter(l=>!contacts.find(c=>c.email===l.email)).map(l=>({id:l.id,name:l.full_name,email:l.email,type:'lead'}))
  ].filter(r=>r.email)
  const selectedRecipient=allRecipients.find(r=>r.id===form.source_id)
  const selectedTpl=TEMPLATES.find(t=>t.id===form.template)||TEMPLATES[0]
  const needsSubject=form.template==='personalizado'
  const canSend=!!selectedRecipient&&!!form.template&&(!needsSubject||form.custom_subject)&&(form.template!=='personalizado'||form.extra_text)

  const handleFiles=async fileList=>{
    const arr=[]
    for(const f of fileList){
      if(f.size>5*1024*1024){alert(`${f.name} supera 5MB`);continue}
      const b64=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.readAsDataURL(f)})
      arr.push({filename:f.name,content:b64,size:f.size})
    }
    setFiles(p=>[...p,...arr])
  }

  const send=async()=>{
    if(!canSend)return
    setSending(true);setSent(null)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm_send_email`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({to:selectedRecipient.email,name:selectedRecipient.name,template_id:form.template,custom_subject:form.custom_subject,extra_text:form.extra_text,teams_url:form.teams_url,attachments:files.map(f=>({filename:f.filename,content:f.content}))})
      })
      const data=await res.json()
      if(data.ok){setSent({ok:true,msg:`✓ Enviado a ${selectedRecipient.email} · desde ${staffProfile?.pessaro_email||'info@pessaro.cl'}`});setForm({template:'bienvenida_lead',source_id:'',extra_text:'',custom_subject:'',teams_url:''});setRecipientSearch('');setRecipientOpen(false);setFiles([]);loadHistory()}
      else setSent({ok:false,msg:data.error||'Error al enviar'})
    }catch(e){setSent({ok:false,msg:e.message})}
    setSending(false)
  }

  const openModal=(tplId)=>{setSent(null);if(tplId)setForm(p=>({...p,template:tplId}));setShowModal(true)}

  return <div>
    <SHdr title="Emails" sub={`${emails.length} enviados · ${staffProfile?.pessaro_email||'info@pessaro.cl'}`}
      action={<Btn variant="blue" onClick={()=>openModal()}>✉ Redactar</Btn>}/>
    <div style={{display:'flex',gap:8,marginBottom:20}}>
      {[['historial','📋 Historial'],['plantillas','🗂 Plantillas']].map(([id,label])=>(
        <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',background:tab===id?P.purpleDim:'rgba(255,255,255,0.04)',color:tab===id?P.purple:P.muted,border:`1px solid ${tab===id?P.purpleBorder:P.border}`,fontWeight:tab===id?600:400}}>{label}</button>
      ))}
    </div>
    {tab==='historial'&&(loading?<Spinner/>:<GlassCard style={{padding:0}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
          {['Destinatario','Plantilla','Estado','Enviado','Abierto'].map(h=><th key={h} style={{padding:'12px 18px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {emails.map((e,i)=><tr key={e.id} style={{borderBottom:i<emails.length-1?`1px solid ${P.border}`:'none'}}>
            <td style={{padding:'12px 18px'}}><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{e.recipient_name||e.recipient_email}</p><p style={{fontSize:11,color:P.muted,margin:0,fontFamily:'monospace'}}>{e.recipient_email}</p></td>
            <td style={{padding:'12px 18px'}}><Badge label={e.email_type||'—'} color={TEMPLATES.find(t=>t.id===e.email_type)?.color||P.muted}/></td>
            <td style={{padding:'12px 18px'}}><Badge label={e.status} color={sc[e.status]||P.muted}/></td>
            <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>{fmtDate(e.sent_at)}</td>
            <td style={{padding:'12px 18px',color:e.opened_at?P.green:P.muted,fontSize:12}}>{e.opened_at?fmtDate(e.opened_at):'—'}</td>
          </tr>)}
        </tbody>
      </table>
      {emails.length===0&&<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin emails enviados</div>}
    </GlassCard>)}
    {tab==='plantillas'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
      {visibleTemplates.map(t=><GlassCard key={t.id} style={{borderLeft:`3px solid ${t.color}`}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><div style={{width:8,height:8,borderRadius:'50%',background:t.color}}/><span style={{fontSize:14,fontWeight:600,color:P.text}}>{t.label}</span></div>
        <p style={{fontSize:12,color:P.muted,margin:'0 0 12px'}}>{t.desc}</p>
        <button onClick={()=>openModal(t.id)} style={{width:'100%',padding:'7px',borderRadius:6,fontSize:12,cursor:'pointer',background:t.color+'18',color:t.color,border:`1px solid ${t.color}30`,fontWeight:600}}>Usar plantilla →</button>
      </GlassCard>)}
    </div>}

    {showModal&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,width:'100%',maxWidth:620,maxHeight:'92vh',overflow:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:`1px solid ${P.border}`}}>
          <div><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:selectedTpl.color}}/><h3 style={{margin:0,fontSize:16,fontWeight:700,color:P.text}}>Redactar email</h3></div>
            {staffProfile&&<p style={{margin:'2px 0 0',fontSize:11,color:P.purple}}>Enviando como: <strong>{staffProfile.pessaro_email}</strong></p>}
          </div>
          <button onClick={()=>{setShowModal(false);setRecipientSearch('');setRecipientOpen(false)}} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:20}}>✕</button>
        </div>
        <div style={{padding:24,display:'flex',flexDirection:'column',gap:16}}>
          <div>
            <Lbl>Plantilla</Lbl>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {visibleTemplates.map(t=><button key={t.id} onClick={()=>setForm(p=>({...p,template:t.id}))}
                style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,background:form.template===t.id?t.color+'25':'rgba(255,255,255,0.04)',color:form.template===t.id?t.color:P.muted,border:`1px solid ${form.template===t.id?t.color+'60':P.border}`}}>{t.label}</button>)}
            </div>
          </div>
          <div style={{position:'relative'}}>
            <Lbl>Destinatario *</Lbl>
            <input value={recipientSearch} onChange={e=>{setRecipientSearch(e.target.value);setForm(p=>({...p,source_id:''}));setRecipientOpen(true)}}
              onFocus={()=>setRecipientOpen(true)}
              placeholder="Buscar contacto o lead..." autoComplete="off"
              style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${selectedRecipient?P.purple:P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',boxSizing:'border-box'}}/>
            {selectedRecipient&&<p style={{fontSize:11,color:P.purple,marginTop:4,margin:'4px 0 0',fontFamily:'monospace'}}>✓ {selectedRecipient.email}</p>}
            {recipientOpen&&recipientSearch.length>0&&(()=>{
              const q=recipientSearch.toLowerCase()
              const hits=allRecipients.filter(r=>(r.name||'').toLowerCase().includes(q)||(r.email||'').toLowerCase().includes(q)).slice(0,12)
              return hits.length>0?<div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:999,background:P.surface,border:`1px solid ${P.border}`,borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,0.5)',maxHeight:220,overflowY:'auto',marginTop:2}}>
                {hits.map(r=><div key={r.id} onMouseDown={e=>{e.preventDefault();setForm(p=>({...p,source_id:r.id}));setRecipientSearch(r.name||r.email);setRecipientOpen(false)}}
                  style={{padding:'9px 14px',cursor:'pointer',borderBottom:`1px solid ${P.border}`,display:'flex',flexDirection:'column',gap:2}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(108,92,231,0.12)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{fontSize:13,fontWeight:600,color:P.text}}>{r.name||r.email}</span>
                  <span style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{r.email} · <span style={{color:r.type==='contact'?P.blue:P.orange}}>{r.type==='contact'?'contacto':'lead'}</span></span>
                </div>)}
              </div>:null
            })()}
          </div>
          {needsSubject&&<div><Lbl>Asunto *</Lbl><Input value={form.custom_subject} onChange={v=>setForm(p=>({...p,custom_subject:v}))} placeholder="Asunto del email"/></div>}
          <div>
            <Lbl>{form.template==='personalizado'?'Mensaje *':form.template==='accesos_crm'?'Contraseña provisional *':'Texto adicional (opcional)'}</Lbl>
            {form.template==='accesos_crm'&&<div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
              <div style={{flex:1,background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'7px 12px',fontFamily:'monospace',fontSize:13,color:form.extra_text?P.text:P.muted,letterSpacing:'0.08em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{form.extra_text||'Haz clic en Generar →'}</div>
              <button onClick={()=>{
                const upper='ABCDEFGHJKLMNPQRSTUVWXYZ',lower='abcdefghjkmnpqrstuvwxyz',digits='23456789',specials='@#!&$';
                const pick=(s)=>s[Math.floor(Math.random()*s.length)];
                const pool=upper+lower+digits+specials;
                let pwd=[pick(upper),pick(upper),pick(lower),pick(lower),pick(digits),pick(digits),pick(specials),...Array.from({length:5},()=>pick(pool))];
                for(let i=pwd.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pwd[i],pwd[j]]=[pwd[j],pwd[i]]}
                setForm(p=>({...p,extra_text:pwd.join('')}))
              }} style={{padding:'7px 14px',borderRadius:8,fontSize:12,cursor:'pointer',background:'rgba(37,99,235,0.15)',color:'#60a5fa',border:'1px solid rgba(37,99,235,0.3)',fontWeight:600,whiteSpace:'nowrap'}}>⚡ Generar</button>
              {form.extra_text&&<button onClick={()=>navigator.clipboard.writeText(form.extra_text).then(()=>alert('Contraseña copiada al portapapeles'))} style={{padding:'7px 10px',borderRadius:8,fontSize:12,cursor:'pointer',background:'rgba(255,255,255,0.04)',color:P.muted,border:`1px solid ${P.border}`}}>⎘</button>}
            </div>}
            <textarea value={form.extra_text} onChange={e=>setForm(p=>({...p,extra_text:e.target.value}))} placeholder={form.template==='personalizado'?'Escribe el mensaje completo...':form.template==='accesos_crm'?'O escribe una contraseña manualmente...':'Añade un párrafo personalizado que se insertará en la plantilla...'}
              style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${form.template==='accesos_crm'&&!form.extra_text?P.red:P.border}`,borderRadius:8,padding:12,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:form.template==='accesos_crm'?52:100,resize:'vertical',fontFamily:form.template==='accesos_crm'?'monospace':'inherit',letterSpacing:form.template==='accesos_crm'?'0.08em':'normal'}}/>
          </div>
          <div>
            <Lbl>Link reunión Teams (opcional)</Lbl>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:18}}>🎥</span>
              <Input value={form.teams_url} onChange={v=>setForm(p=>({...p,teams_url:v}))} placeholder="https://teams.microsoft.com/l/meetup-join/..."/>
            </div>
            {form.teams_url&&<p style={{fontSize:11,color:'#60a5fa',marginTop:4,margin:'4px 0 0'}}>✓ Se añadirá botón "Unirse a la reunión" en el email</p>}
          </div>
          <div>
            <Lbl>Adjuntos (PDF, imágenes · máx. 5MB c/u)</Lbl>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files)}}
              style={{border:`2px dashed ${dragOver?P.purple:P.border}`,borderRadius:10,padding:'16px',textAlign:'center',background:dragOver?P.purpleDim:'rgba(255,255,255,0.02)',cursor:'pointer'}}
              onClick={()=>document.getElementById('fileInput').click()}>
              <p style={{fontSize:13,color:P.muted,margin:0}}>📎 Arrastra o <span style={{color:P.purple,fontWeight:600}}>haz clic</span></p>
              <input id="fileInput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx" style={{display:'none'}} onChange={e=>handleFiles(e.target.files)}/>
            </div>
            {files.length>0&&<div style={{marginTop:8}}>
              {files.map((f,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:6,marginBottom:4}}>
                <span style={{flex:1,fontSize:12,color:P.text}}>{f.filename}</span>
                <span style={{fontSize:11,color:P.muted}}>{(f.size/1024).toFixed(0)}KB</span>
                <button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:14}}>✕</button>
              </div>)}
            </div>}
          </div>
          {sent&&<div style={{padding:'10px 14px',borderRadius:8,background:sent.ok?P.greenDim:P.redDim,border:`1px solid ${sent.ok?P.green+'40':P.red+'40'}`,color:sent.ok?P.green:P.red,fontSize:13}}>{sent.msg}</div>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:4}}>
            <div style={{display:'flex',alignItems:'center',gap:6,background:selectedTpl.color+'15',border:`1px solid ${selectedTpl.color}30`,borderRadius:6,padding:'5px 12px'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:selectedTpl.color}}/><span style={{fontSize:11,color:selectedTpl.color,fontWeight:600}}>{selectedTpl.label}</span>
              {files.length>0&&<span style={{fontSize:11,color:P.muted}}>· {files.length} adj.</span>}
            </div>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancelar</Btn>
              <Btn variant="blue" onClick={send} disabled={sending||!canSend}>{sending?'Enviando...':'Enviar ✉'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>}
  </div>
}


// ─── REPORT EXPORTS ───────────────────────────────────────────────────────────
// ─── EXPORT CONTACTOS (super admin only) ──────────────────────────────────────
// Historial de movimientos entre grupos, tal como se ve en pantalla
const ACCION_LABEL={mover:'Traspaso',copiar:'Copia',alta:'Alta',baja:'Baja'}
function exportTransfersCSV(rows){
  const e=v=>`"${String(v??'').replace(/"/g,'""')}"`
  const linea=[
    ['Fecha','Hora','Contacto','Email','Teléfono','Grupo origen','Grupo destino','Acción','Nota'].map(e).join(','),
    ...rows.map(t=>{
      const f=new Date(t.moved_at)
      return [
        f.toLocaleDateString('es-CL'),
        f.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}),
        t.crm_contacts?.full_name||'',
        t.crm_contacts?.email||'',
        t.crm_contacts?.phone||'',
        t.from_group_name||'—',
        t.to_group_name||'—',
        ACCION_LABEL[t.action]||t.action,
        t.note||'',
      ].map(e).join(',')
    })
  ]
  const a=document.createElement('a')
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(linea.join('\n'))
  a.download=`Pessaro_Traspasos_${new Date().toISOString().slice(0,10)}.csv`;a.click()
}

function exportContactsCSV(contacts){
  const e=v=>`"${String(v||'').replace(/"/g,'""')}"`
  const rows=[
    ['Nombre','Email','Teléfono','Dirección','Estado','Origen','Capital USD','Asesor','Fecha'].map(e).join(','),
    ...contacts.map(c=>[
      c.full_name,c.email,c.phone||c.mobile||'',c.address||'',
      c.status,c.source||'crm',c._capital||c.investment_capital||'',
      c.user_id||'Web',c.created_at||c.submitted_at||''
    ].map(e).join(','))
  ]
  const a=document.createElement('a')
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(rows.join('\n'))
  a.download=`Pessaro_Contactos_${new Date().toISOString().slice(0,10)}.csv`;a.click()
}

function exportContactsExcel(contacts){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const row=cells=>`<Row>${cells.map(c=>`<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`
  const rows=[
    row(['Nombre','Email','Teléfono','Dirección','Estado','Origen','Capital USD','Asesor','Fecha']),
    ...contacts.map(c=>row([
      c.full_name,c.email,c.phone||c.mobile||'',c.address||'',
      c.status,c.source||'crm',c._capital||c.investment_capital||'',
      c.user_id||'Web',c.created_at||c.submitted_at||''
    ]))
  ].join('')
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Contactos"><Table>${rows}</Table></Worksheet></Workbook>`
  const a=document.createElement('a')
  a.href='data:application/vnd.ms-excel,'+encodeURIComponent(xml)
  a.download=`Pessaro_Contactos_${new Date().toISOString().slice(0,10)}.xls`;a.click()
}

function exportContactsHTML(contacts){
  const now=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})
  const fmtUSD=n=>n?new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):''
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const sColor={activo:'#00d084',prospecto:'#ffa502',cliente:'#6c5ce7',inactivo:'#636e72'}
  const rows=contacts.map(c=>`
    <tr>
      <td><strong>${esc(c.full_name)}</strong></td>
      <td style="font-family:monospace;font-size:12px">${esc(c.email)}</td>
      <td>${esc(c.phone||c.mobile||'—')}</td>
      <td><span style="background:${sColor[c.status]||'#888'}22;color:${sColor[c.status]||'#888'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${esc(c.status)}</span></td>
      <td style="font-size:11px;color:#64748b">${esc(c.source||'crm')}</td>
      <td style="font-family:monospace;color:#059669;font-weight:600">${fmtUSD(c._capital||c.investment_capital)}</td>
      <td style="font-size:11px;color:#94a3b8">${esc(c.created_at||c.submitted_at||'').slice(0,10)}</td>
    </tr>`).join('')
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Contactos — Pessaro Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;padding:32px}
.header{background:linear-gradient(135deg,#050816,#1e3a8a);padding:24px 32px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between;margin-bottom:0}
.header h1{color:#fff;font-size:18px;font-weight:700}.header small{color:#94a3b8;font-size:11px}
.meta{background:#1e3a8a;padding:10px 32px;border-bottom:3px solid #f0a500;margin-bottom:0}
.meta span{color:#e2e8f0;font-size:12px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:0 0 12px 12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
th{background:#f1f5f9;color:#475569;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:11px 16px;text-align:left;border-bottom:2px solid #e2e8f0}
td{padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:middle}
tr:last-child td{border-bottom:none}tr:hover td{background:#f8fafc}
.foot{margin-top:16px;text-align:right;font-size:11px;color:#94a3b8}
.btn{display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;margin-bottom:16px;font-family:'Inter',sans-serif}
@media print{.btn{display:none}body{padding:0}}</style></head><body>
<button class="btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
<div class="header"><div><h1>📋 Contactos — Pessaro Capital</h1><small>CRM Interno · Uso confidencial</small></div><div style="text-align:right"><small style="color:#94a3b8">${now}</small><br><strong style="color:#f0a500;font-size:20px">${contacts.length}</strong><small style="color:#e2e8f0"> contactos</small></div></div>
<div class="meta"><span>Total: <strong>${contacts.length}</strong> · CRM + formularios web · Generado ${now}</span></div>
<table><thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Estado</th><th>Origen</th><th>Capital USD</th><th>Fecha</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="foot">Pessaro Capital SpA · crm.pessaro.cl · Confidencial — No distribuir</div>
</body></html>`
  const w=window.open('','_blank');w.document.write(html);w.document.close()
}

function exportContactsPDF(contacts,logoUri){
  const now=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})
  const fmtUSD=n=>n?new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):''
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const sColor={activo:'#00d084',prospecto:'#ffa502',cliente:'#6c5ce7',inactivo:'#636e72'}
  const totalCap=contacts.reduce((s,c)=>s+(Number(c._capital||c.investment_capital)||0),0)
  const byStatus=Object.fromEntries(['activo','prospecto','cliente','inactivo'].map(s=>[s,contacts.filter(c=>c.status===s).length]))
  const rows=contacts.map(c=>`
    <tr>
      <td><strong>${esc(c.full_name)}</strong><br><span style="font-size:10px;color:#64748b;font-family:monospace">${esc(c.email)}</span></td>
      <td style="font-size:12px">${esc(c.phone||c.mobile||'—')}</td>
      <td><span style="background:${sColor[c.status]||'#888'}22;color:${sColor[c.status]||'#888'};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600">${esc(c.status)}</span></td>
      <td style="font-size:11px;color:#64748b">${esc(c.source||'crm')}</td>
      <td style="font-family:monospace;color:#059669;font-weight:600;font-size:12px">${fmtUSD(c._capital||c.investment_capital)}</td>
      <td style="font-size:10px;color:#94a3b8">${esc(c.created_at||c.submitted_at||'').slice(0,10)}</td>
    </tr>`).join('')
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe Contactos — Pessaro Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#f0f4f8;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{background:#050816;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:36px;height:36px;border-radius:8px}
.brand strong{color:#fff;font-size:14px;display:block}.brand small{color:#94a3b8;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
.btns{display:flex;gap:10px}.btn{border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;padding:9px 18px;border-radius:9px}
.btn-p{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.35)}
.btn-g{background:rgba(255,255,255,.06);color:#e6ecff;border:1px solid rgba(255,255,255,.14)}
@media print{.toolbar{display:none!important}body{background:#fff}.wrap{margin:0;padding:0}}
.wrap{max-width:960px;margin:24px auto 48px;padding:0 20px}
.card{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.18);overflow:hidden}
.band{background:linear-gradient(135deg,#050816 0%,#0a1f5c 40%,#1e3a8a 70%,#2563eb 100%);padding:24px 40px;display:flex;align-items:center;gap:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.band-logo{width:48px;height:48px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.2)}
.band-logo img{width:100%;height:100%;object-fit:cover}
.band h1{font-size:18px;font-weight:700;color:#fff}.band-sub{color:#b9c5e6;font-size:12px;margin-top:2px}
.band-right{margin-left:auto;text-align:right}
.band-right .val{color:#f0a500;font-size:28px;font-weight:800}.band-right small{color:#b9c5e6;font-size:11px}
.gold{height:4px;background:linear-gradient(135deg,#b8860b,#d4af37,#fbbf24);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:28px 40px 24px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
.kpi-lbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;color:#64748b;margin-bottom:4px}
.kpi-val{font-size:18px;font-weight:800;color:#0a1f5c}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f1f5f9;color:#475569;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:9px 12px;text-align:left;border-bottom:2px solid #e2e8f0}
td{padding:9px 12px;border-bottom:1px solid #f8fafc;vertical-align:middle}
tr:last-child td{border-bottom:none}
.disc{margin-top:20px;padding:10px 14px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;font-size:10px;color:#78350f;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.foot{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.foot-brand{display:flex;align-items:center;gap:8px}.foot-brand img{width:22px;height:22px;border-radius:4px}
.foot-brand span{font-size:11px;color:#94a3b8}.foot-note{font-size:10px;color:#cbd5e1;text-align:right;line-height:1.6}
</style></head><body>
<div class="toolbar">
  <div class="brand"><img src="${logoUri}" alt="Pessaro"><div><strong>Pessaro Capital</strong><small>CRM Interno</small></div></div>
  <div class="btns"><button class="btn btn-p" onclick="window.print()">🖨 Imprimir / Guardar PDF</button><button class="btn btn-g" onclick="window.close()">✕ Cerrar</button></div>
</div>
<div class="wrap"><div class="card">
  <div class="band">
    <div class="band-logo"><img src="${logoUri}" alt="Pessaro"></div>
    <div><h1>Informe de Contactos</h1><div class="band-sub">Pessaro Capital SpA · CRM Interno · ${now}</div></div>
    <div class="band-right"><div class="val">${contacts.length}</div><small>contactos totales</small></div>
  </div>
  <div class="gold"></div>
  <div class="body">
    <div class="kpis">
      <div class="kpi"><div class="kpi-lbl">Total</div><div class="kpi-val">${contacts.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Activos</div><div class="kpi-val" style="color:#00d084">${byStatus.activo||0}</div></div>
      <div class="kpi"><div class="kpi-lbl">Prospectos</div><div class="kpi-val" style="color:#ffa502">${byStatus.prospecto||0}</div></div>
      <div class="kpi"><div class="kpi-lbl">Clientes</div><div class="kpi-val" style="color:#6c5ce7">${byStatus.cliente||0}</div></div>
      <div class="kpi"><div class="kpi-lbl">Capital total</div><div class="kpi-val" style="color:#059669;font-size:13px">${fmtUSD(totalCap)}</div></div>
    </div>
    <table><thead><tr><th>Contacto</th><th>Teléfono</th><th>Estado</th><th>Origen</th><th>Capital USD</th><th>Fecha</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="disc">⚠️ <strong>Confidencial:</strong> Este informe es de uso interno exclusivo de Pessaro Capital SpA. Contiene datos personales protegidos. No distribuir.</div>
    <div class="foot">
      <div class="foot-brand"><img src="${logoUri}" alt="Pessaro"><span>Pessaro Capital SpA · pessaro.cl</span></div>
      <div class="foot-note">CRM Interno · ${now}<br>Confidencial — No distribuir</div>
    </div>
  </div>
</div></div></body></html>`
  const w=window.open('','_blank');w.document.write(html);w.document.close()
}

const RLOGO="data:image/webp;base64,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RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5mYXZpY29uLTI1NiAtIEljb25vIFBlc3Nhcm8gQ2FwaXRhbCA8L3JkZjpsaT4KICAgPC9yZGY6QWx0PgogIDwvZGM6dGl0bGU+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgPHBkZjpBdXRob3I+RnJhbmNpc2NvIFJvamFzPC9wZGY6QXV0aG9yPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczp4bXA9J2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8nPgogIDx4bXA6Q3JlYXRvclRvb2w+Q2FudmEgZG9jPURBSEJDSFZaZ0xVIHVzZXI9VUFDZHdIZFdBRjAgYnJhbmQ9VmVydGljMyB0ZW1wbGF0ZT1CbHVlIE1vZGVybiBQcm9mZXNzaW9uYWwgTGV0dGVyIEsgTG9nbzwveG1wOkNyZWF0b3JUb29sPgogPC9yZGY6RGVzY3JpcHRpb24+CjwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cjw/eHBhY2tldCBlbmQ9J3InPz4A"

function exportCSV(contacts,leads){
  const e=v=>`"${String(v||'').replace(/"/g,'""')}"`
  const rows=[
    ['FORMULARIOS','','','','','',''].join(','),
    ['Nombre','Email','Teléfono','Capital USD','Gestión','Estado','Fecha'].map(e).join(','),
    ...contacts.map(c=>[c.full_name,c.email,c.mobile||c.phone||'',c.investment_capital||c._capital||'',c.management_type||'',c.status,c.submitted_at||c.created_at||''].map(e).join(',')),
    '',
    ['PIPELINE LEADS','','','','','','','','','',''].join(','),
    ['Nombre','Email','Capital','Etapa','Equipo','Contactado','Cuenta','KYC','Depósito','Score','Fecha'].map(e).join(','),
    ...leads.map(l=>[l.full_name,l.email,l.investment_range||'',l.etapa,l.team||'',l.advisor_contacted?'Sí':'No',l.account_created?'Sí':'No',l.kyc_verified?'Sí':'No',l.deposit_confirmed?'Sí':'No',l.score||0,l.created_at||''].map(e).join(','))
  ]
  const a=document.createElement('a')
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(rows.join('\n'))
  a.download=`Pessaro_CRM_${new Date().toISOString().slice(0,10)}.csv`;a.click()
}

function exportExcel(contacts,leads){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const row=cells=>`<Row>${cells.map(c=>`<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`
  const s1=[row(['Nombre','Email','Teléfono','Capital USD','Gestión','Estado','Fecha']),...contacts.map(c=>row([c.full_name,c.email,c.mobile||c.phone||'',c.investment_capital||c._capital||'',c.management_type||'',c.status,c.submitted_at||c.created_at||'']))].join('')
  const s2=[row(['Nombre','Email','Capital','Etapa','Equipo','Contactado','Cuenta','KYC','Depósito','Score','Fecha']),...leads.map(l=>row([l.full_name,l.email,l.investment_range||'',l.etapa,l.team||'',l.advisor_contacted?'Sí':'No',l.account_created?'Sí':'No',l.kyc_verified?'Sí':'No',l.deposit_confirmed?'Sí':'No',l.score||0,l.created_at||'']))].join('')
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Formularios"><Table>${s1}</Table></Worksheet><Worksheet ss:Name="Pipeline"><Table>${s2}</Table></Worksheet></Workbook>`
  const a=document.createElement('a')
  a.href='data:application/vnd.ms-excel,'+encodeURIComponent(xml)
  a.download=`Pessaro_CRM_${new Date().toISOString().slice(0,10)}.xls`;a.click()
}

function openPDF(contacts,leads){
  const now=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})
  const fmtUSD=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0)
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital||c._capital)||0),0)
  const closed=leads.filter(l=>l.etapa===5).length
  const pct=(n,t)=>t?Math.round(n/t*100):0
  const etapaRows=[['Lead',1],['Contactado',2],['Propuesta',3],['Negociación',4],['Cerrado',5]].map(([lbl,e])=>{
    const n=leads.filter(l=>l.etapa===e).length
    return `<tr><td>${lbl}</td><td>${n}</td><td>${pct(n,leads.length)}%</td></tr>`
  }).join('')
  const statusRows=[['Sin leer','new','#f59e0b'],['Leídos','read','#3b82f6'],['Respondidos','replied','#10b981'],['Archivados','archived','#6b7280']].map(([lbl,s,col])=>{
    const n=contacts.filter(c=>c.status===s).length
    return `<tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:7px"></span>${lbl}</td><td>${n}</td><td>${pct(n,contacts.length)}%</td></tr>`
  }).join('')
  const convRows=[['Contactados',leads.filter(l=>l.advisor_contacted).length],['Cuenta creada',leads.filter(l=>l.account_created).length],['KYC verificado',leads.filter(l=>l.kyc_verified).length],['Depósito confirmado',leads.filter(l=>l.deposit_confirmed).length]].map(([lbl,n])=>`<tr><td>${lbl}</td><td>${n}</td><td>${pct(n,leads.length)}%</td></tr>`).join('')
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe CRM Pessaro Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#f0f4f8;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{background:#050816;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}
.brand{display:flex;align-items:center;gap:12px}
.brand img{width:38px;height:38px;border-radius:8px}
.brand strong{color:#fff;font-size:14px;display:block}
.brand small{color:#94a3b8;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
.btns{display:flex;gap:10px}
.btn{border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;padding:9px 18px;border-radius:9px}
.btn-p{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.35)}
.btn-g{background:rgba(255,255,255,.06);color:#e6ecff;border:1px solid rgba(255,255,255,.14)}
@media print{.toolbar{display:none!important}body{background:#fff}.wrap{margin:0;padding:0}.card{border-radius:0;box-shadow:none}}
.wrap{max-width:900px;margin:24px auto 48px;padding:0 20px}
.card{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.28);overflow:hidden}
.band{background:linear-gradient(135deg,#050816 0%,#0a1f5c 35%,#1e3a8a 70%,#2563eb 100%);padding:28px 44px 22px;display:flex;align-items:center;gap:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.band-logo{width:54px;height:54px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);overflow:hidden;flex-shrink:0}
.band-logo img{width:100%;height:100%;object-fit:cover}
.band-lbl{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#6190ff;font-weight:600;margin-bottom:4px}
.band h1{font-size:19px;font-weight:700;color:#fff}
.band-sub{color:#b9c5e6;font-size:12px;margin-top:3px}
.band-date{margin-left:auto;text-align:right}
.band-date .val{color:#e6ecff;font-size:13px;font-weight:600}
.gold{height:4px;background:linear-gradient(135deg,#b8860b,#d4af37,#fbbf24);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:34px 44px 30px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:15px;text-align:center}
.kpi.dk{background:linear-gradient(135deg,#0a1f5c,#1e3a8a);border-color:#2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi-lbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;margin-bottom:6px}
.kpi .kpi-lbl{color:#64748b}.kpi.dk .kpi-lbl{color:#93c5fd}
.kpi-val{font-size:20px;font-weight:800}
.kpi .kpi-val{color:#0a1f5c}.kpi.dk .kpi-val{color:#fff}
.kpi-sub{font-size:10px;margin-top:3px}
.kpi .kpi-sub{color:#94a3b8}.kpi.dk .kpi-sub{color:#7dd3fc}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
.sec{margin-bottom:24px}
.sec-title{font-size:10px;font-weight:700;color:#2563eb;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:7px;border-bottom:2px solid #e2e8f0}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f1f5f9;color:#64748b;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:9px 12px;text-align:left}
td{padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#1f2937}
tr:last-child td{border-bottom:none}
.disc{margin-top:22px;padding:11px 15px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;font-size:11px;color:#78350f;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.foot{margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.foot-brand{display:flex;align-items:center;gap:8px}
.foot-brand img{width:24px;height:24px;border-radius:5px}
.foot-brand span{font-size:11px;color:#94a3b8}
.foot-note{font-size:10px;color:#cbd5e1;text-align:right;line-height:1.6}
</style></head><body>
<div class="toolbar">
  <div class="brand"><img src="${RLOGO}" alt="Pessaro"><div><strong>Pessaro Capital</strong><small>CRM Interno</small></div></div>
  <div class="btns"><button class="btn btn-p" onclick="window.print()">🖨 Imprimir / Guardar PDF</button><button class="btn btn-g" onclick="window.close()">✕ Cerrar</button></div>
</div>
<div class="wrap"><div class="card">
  <div class="band">
    <div class="band-logo"><img src="${RLOGO}" alt="Pessaro"></div>
    <div><div class="band-lbl">Informe de Gestión</div><h1>Reporte CRM — Pessaro Capital</h1><div class="band-sub">Generado automáticamente · Supabase</div></div>
    <div class="band-date"><div class="band-lbl">Fecha</div><div class="val">${now}</div></div>
  </div>
  <div class="gold"></div>
  <div class="body">
    <div class="kpis">
      <div class="kpi dk"><div class="kpi-lbl">Formularios</div><div class="kpi-val">${contacts.length}</div><div class="kpi-sub">Desde pessaro.cl</div></div>
      <div class="kpi dk"><div class="kpi-lbl">Capital declarado</div><div class="kpi-val">${fmtUSD(totalCap)}</div><div class="kpi-sub">Total acumulado</div></div>
      <div class="kpi"><div class="kpi-lbl">Leads pipeline</div><div class="kpi-val">${leads.length}</div><div class="kpi-sub">${closed} cerrados</div></div>
      <div class="kpi"><div class="kpi-lbl">Tasa de cierre</div><div class="kpi-val">${pct(closed,leads.length)}%</div><div class="kpi-sub">Conversión total</div></div>
    </div>
    <div class="two">
      <div class="sec"><div class="sec-title">Pipeline por etapa</div><table><thead><tr><th>Etapa</th><th>Leads</th><th>%</th></tr></thead><tbody>${etapaRows}</tbody></table></div>
      <div class="sec"><div class="sec-title">Estado formularios</div><table><thead><tr><th>Estado</th><th>Cantidad</th><th>%</th></tr></thead><tbody>${statusRows}</tbody></table></div>
    </div>
    <div class="sec"><div class="sec-title">Conversión del pipeline</div><table><thead><tr><th>Hito</th><th>Leads</th><th>% del total</th></tr></thead><tbody>${convRows}</tbody></table></div>
    <div class="disc">⚠️ <strong>Aviso de riesgo:</strong> Este informe es de uso interno exclusivo de Pessaro Capital SpA. La rentabilidad pasada no garantiza resultados futuros. Toda inversión implica riesgo de pérdida.</div>
    <div class="foot"><div class="foot-brand"><img src="${RLOGO}" alt="Pessaro"><span>Pessaro Capital SpA · pessaro.cl</span></div><div class="foot-note">CRM Interno · ${now}<br>Confidencial — No distribuir</div></div>
  </div>
</div></div></body></html>`
  const w=window.open('','_blank')
  w.document.write(html)
  w.document.close()
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
// ─── FICHA DEL CONTACTO: documento exportable ────────────────────────────────
// Arma el objeto que alimenta tanto la descarga HTML como la vista de impresión,
// para que ambos salgan idénticos a lo que se ve en pantalla.
function buildFichaDoc(c,groups,memberships,notes,activities,ficha,getAdvisorName,movs){
  const f=ficha||{}
  const misGrupos=(groups||[]).filter(g=>(memberships[c.id]||[]).includes(g.id))
  return {
    contacto:{
      nombre:c.full_name||'—', email:c.email||'—', telefono:c.phone||'—',
      direccion:c.address||'—', estado:c.status||'—', origen:c.source||'crm',
      creado:c.created_at||null, asesor:c.user_id?getAdvisorName(c.user_id):'Sin asignar',
      nacimiento:c.birth_date||null, profesion:c.profession||'',
    },
    cuenta:{
      apertura:c.account_opened?'Sí':(c.broker||c.account_number?'No':''),
      apertura_fecha:c.account_opened_at||null,
      tipo:c.account_kind==='real'?'Real':c.account_kind==='demo'?'Demo':'',
      broker:c.broker||'', numero:c.account_number||'',
      gestion:c.managed_type||'',
      balance_inicial:c.initial_balance!==null&&c.initial_balance!==undefined&&c.initial_balance!==''?fmtUSD(c.initial_balance):'',
    },
    movimientos:(movs||[]).map(m=>({kind:m.kind,amount:Number(m.amount||0),fecha:m.movement_date,note:m.note||''})),
    grupos:misGrupos.map(g=>({name:g.name,color:g.color})),
    resumen:{
      whatsapp:(f.wa||[]).length, tickets:(f.tickets||[]).length, tareas:(f.tasks||[]).length,
      formularios:(f.subs||[]).length, notas:(notes||[]).length, actividades:(activities||[]).length,
    },
    lead:f.lead||null, cliente:f.cliente||null,
    linea:buildTimeline(notes,activities,ficha),
  }
}

function fichaHTMLDoc(doc,logoUri,standalone){
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const now=new Date().toLocaleString('es-CL',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})
  // Mismo cuidado que en fmtDate: nacimiento, apertura y fechas de movimiento
  // son días de calendario, y parsearlos como UTC los dejaba un día atrás.
  const fd=v=>v?new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v))?`${v}T00:00:00`:v)
    .toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}):'—'
  const fdt=v=>v?`${new Date(v).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})} · ${new Date(v).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}`:''
  const k=doc.contacto
  const datos=[['Email',k.email],['Número móvil',k.telefono],['Fecha de nacimiento',k.nacimiento?fd(k.nacimiento):''],
    ['Profesión, actividad u oficio',k.profesion],['Dirección',k.direccion],['Estado',k.estado],
    ['Origen',k.origen],['Asesor',k.asesor],['Registro',fd(k.creado)]]
    .filter(([,v])=>v!==null&&v!==undefined&&v!=='')
    .map(([l,v])=>`<div class="d"><div class="d-l">${esc(l)}</div><div class="d-v">${esc(v)}</div></div>`).join('')
  const chips=doc.grupos.length
    ?doc.grupos.map(g=>`<span class="chip" style="background:${esc(g.color)}22;color:${esc(g.color)};border-color:${esc(g.color)}55">${esc(g.name)}</span>`).join('')
    :'<span class="none">Sin grupos asignados</span>'
  const kpis=Object.entries(doc.resumen).filter(([,n])=>n>0)
    .map(([l,n])=>`<div class="kpi"><div class="kpi-lbl">${esc(l)}</div><div class="kpi-val">${n}</div></div>`).join('')
  const eventos=doc.linea.length
    ?doc.linea.map(e=>`<div class="ev" style="border-left-color:${esc(e.color)}">
        <div class="ev-i">${e.icon}</div>
        <div class="ev-b">
          <div class="ev-t" style="color:${esc(e.color)}">${esc(e.tipo)}</div>
          <div class="ev-x">${esc(e.titulo)}</div>
          ${e.detalle?`<div class="ev-d">${esc(e.detalle)}</div>`:''}
          <div class="ev-f">${esc(fdt(e.ts))}</div>
        </div></div>`).join('')
    :'<p class="none">Sin historial registrado.</p>'
  const bloque=(titulo,pares)=>{
    const items=pares.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([l,v])=>`<div class="d"><div class="d-l">${esc(l)}</div><div class="d-v">${esc(v)}</div></div>`).join('')
    return items?`<h2>${esc(titulo)}</h2><div class="grid">${items}</div>`:''
  }
  const lead=doc.lead?bloque('Lead de campaña',[['Etapa',doc.lead.etapa],['Capital declarado',doc.lead.investment_range],
    ['Variante',doc.lead.variant],['Perfil',doc.lead.perfil],['Equipo',doc.lead.team],['Origen',doc.lead.source],
    ['Cupo',doc.lead.cupo_confirmed?`#${doc.lead.cupo_number||''}`:null],['Registro',fd(doc.lead.created_at)]]):''
  const q=doc.cuenta||{}
  const cuenta=bloque('Cuenta de inversión',[['Realizó apertura de cuenta',q.apertura],['Fecha de apertura',q.apertura_fecha?fd(q.apertura_fecha):''],
    ['Demo o real',q.tipo],['Broker',q.broker],['Número de cuenta',q.numero],
    ['PAMM o MAM',q.gestion==='ninguno'?'Ninguno':q.gestion],['Equidad o balance inicial',q.balance_inicial]])
  const movimientos=(()=>{
    const ms=doc.movimientos||[]
    if(!ms.length)return ''
    const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n||0)
    const tot=t=>ms.filter(m=>m.kind===t).reduce((s,m)=>s+m.amount,0)
    const filas=ms.map(m=>`<div class="ev" style="border-left-color:${m.kind==='deposito'?'#00a86b':'#e11d48'}">
        <div class="ev-i">${m.kind==='deposito'?'↓':'↑'}</div>
        <div class="ev-b">
          <div class="ev-t" style="color:${m.kind==='deposito'?'#00a86b':'#e11d48'}">${m.kind==='deposito'?'Depósito':'Retiro'}</div>
          <div class="ev-x">${esc(money(m.amount))}</div>
          ${m.note?`<div class="ev-d">${esc(m.note)}</div>`:''}
          <div class="ev-f">${esc(fd(m.fecha))}</div>
        </div></div>`).join('')
    return `<h2>Depósitos y retiros (${ms.length})</h2>
      <div class="kpis" style="margin-bottom:10px">
        <div class="kpi"><div class="kpi-lbl">Depósitos</div><div class="kpi-val">${esc(money(tot('deposito')))}</div></div>
        <div class="kpi"><div class="kpi-lbl">Retiros</div><div class="kpi-val">${esc(money(tot('retiro')))}</div></div>
        <div class="kpi"><div class="kpi-lbl">Neto</div><div class="kpi-val">${esc(money(tot('deposito')-tot('retiro')))}</div></div>
      </div>${filas}`
  })()
  const cli=doc.cliente?bloque('Cuenta de cliente',[['Estado',doc.cliente.account_status],['Tipo',doc.cliente.account_type],
    ['Tolerancia al riesgo',doc.cliente.risk_tolerance],['Experiencia',doc.cliente.experience_level],
    ['Capital',doc.cliente.investment_capital],['Horizonte',doc.cliente.investment_horizon],
    ['País',doc.cliente.country],['Alta',fd(doc.cliente.created_at)]]):''
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Ficha — ${esc(k.nombre)} — Pessaro Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#f0f4f8;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{background:#050816;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:36px;height:36px;border-radius:8px}
.brand strong{color:#fff;font-size:14px;display:block}.brand small{color:#94a3b8;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
.btns{display:flex;gap:10px}.btn{border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;padding:9px 18px;border-radius:9px}
.btn-p{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.35)}
.btn-g{background:rgba(255,255,255,.06);color:#e6ecff;border:1px solid rgba(255,255,255,.14)}
@media print{.toolbar{display:none!important}body{background:#fff}.wrap{margin:0;padding:0}.card{border-radius:0;box-shadow:none}.ev{break-inside:avoid}}
.wrap{max-width:900px;margin:24px auto 48px;padding:0 20px}
.card{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.18);overflow:hidden}
.band{background:linear-gradient(135deg,#050816 0%,#0a1f5c 40%,#1e3a8a 70%,#2563eb 100%);padding:24px 40px;display:flex;align-items:center;gap:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.band-logo{width:48px;height:48px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.2)}
.band-logo img{width:100%;height:100%;object-fit:cover}
.band h1{font-size:20px;font-weight:700;color:#fff}.band-sub{color:#b9c5e6;font-size:12px;margin-top:2px}
.gold{height:4px;background:linear-gradient(135deg,#b8860b,#d4af37,#fbbf24);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:28px 40px 24px}
h2{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;font-weight:700;margin:24px 0 10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
h2:first-of-type{margin-top:0}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.d{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
.d-l{font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:3px}
.d-v{font-size:13px;color:#1e293b;font-weight:500;word-break:break-word}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid}
.none{font-size:12px;color:#94a3b8;font-style:italic}
.kpis{display:flex;gap:10px;flex-wrap:wrap}
.kpi{flex:1;min-width:90px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
.kpi-lbl{font-size:9px;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;color:#64748b;margin-bottom:4px}
.kpi-val{font-size:20px;font-weight:800;color:#0a1f5c}
.ev{display:flex;gap:12px;padding:10px 14px;background:#fff;border:1px solid #f1f5f9;border-left:3px solid #cbd5e1;border-radius:8px;margin-bottom:6px}
.ev-i{font-size:16px;flex-shrink:0}
.ev-b{flex:1;min-width:0}
.ev-t{font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:2px}
.ev-x{font-size:13px;color:#1e293b;line-height:1.5;word-break:break-word}
.ev-d{font-size:11px;color:#64748b;margin-top:2px}
.ev-f{font-size:10px;color:#94a3b8;margin-top:4px}
.disc{margin-top:20px;padding:10px 14px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;font-size:10px;color:#78350f;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.foot{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.foot-brand{display:flex;align-items:center;gap:8px}.foot-brand img{width:22px;height:22px;border-radius:4px}
.foot-brand span{font-size:11px;color:#94a3b8}.foot-note{font-size:10px;color:#cbd5e1;text-align:right;line-height:1.6}
</style></head><body>
<div class="toolbar">
  <div class="brand"><img src="${logoUri}" alt="Pessaro"><div><strong>Pessaro Capital</strong><small>CRM Interno</small></div></div>
  <div class="btns"><button class="btn btn-p" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>${standalone?'':'<button class="btn btn-g" onclick="window.close()">✕ Cerrar</button>'}</div>
</div>
<div class="wrap"><div class="card">
  <div class="band">
    <div class="band-logo"><img src="${logoUri}" alt="Pessaro"></div>
    <div><h1>${esc(k.nombre)}</h1><div class="band-sub">Ficha de contacto · ${esc(k.estado)} · Generada ${esc(now)}</div></div>
  </div>
  <div class="gold"></div>
  <div class="body">
    <h2>Registro completo del cliente</h2><div class="grid">${datos}</div>
    <h2>Grupos</h2><div class="chips">${chips}</div>
    ${cuenta}
    ${movimientos}
    ${kpis?`<h2>Resumen del historial</h2><div class="kpis">${kpis}</div>`:''}
    ${lead}
    ${cli}
    <h2>Historial completo (${doc.linea.length})</h2>
    ${eventos}
    <div class="disc"><strong>Confidencial.</strong> Este documento contiene datos personales de un contacto de Pessaro Capital SpA y su historial comercial. Su uso está restringido al personal autorizado del CRM. No lo distribuyas fuera de la organización.</div>
    <div class="foot">
      <div class="foot-brand"><img src="${logoUri}" alt="Pessaro"><span>Pessaro Capital SpA · pessaro.cl</span></div>
      <div class="foot-note">Generado desde el CRM el ${esc(now)}<br>Asesor responsable: ${esc(k.asesor)}</div>
    </div>
  </div>
</div></div>
</body></html>`
}

function exportFichaHTML(doc){
  const html=fichaHTMLDoc(doc,LOGO_URI,true)
  const slug=String(doc.contacto.nombre||'contacto').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')
  const a=document.createElement('a')
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
  a.href=url;a.download=`Ficha_${slug}_${new Date().toISOString().slice(0,10)}.html`;a.click()
  URL.revokeObjectURL(url)
}

function exportFichaPDF(doc,logoUri){
  const w=window.open('','_blank')
  if(!w)return
  w.document.write(fichaHTMLDoc(doc,logoUri,false));w.document.close()
}

function Reports({contacts,leads,isSuperAdmin}){
  const closed=leads.filter(l=>l.etapa===5).length
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital||c._capital)||0),0)
  const pipeData=STAGES.map(s=>({name:STAGE_LABEL[s],v:leads.filter(l=>ETAPA_STAGE[l.etapa]===s).length}))
  const capData=['1k-5k','5k-20k','20k-50k','50k+'].map(r=>({name:r,v:leads.filter(l=>l.investment_range===r).length}))
  const isMobR=useWindowSize()<768
  return <div>
    <SHdr title="Reportes" sub={isSuperAdmin?'Analíticas en tiempo real':'Mis analíticas'}
      action={<div style={{display:'flex',gap:8}}>
        <Btn variant="ghost" onClick={()=>exportCSV(contacts,leads)} style={{fontSize:12}}>⬇ CSV</Btn>
        <Btn variant="ghost" onClick={()=>exportExcel(contacts,leads)} style={{fontSize:12}}>⬇ Excel</Btn>
        <Btn onClick={()=>openPDF(contacts,leads)} style={{fontSize:12,background:'linear-gradient(135deg,#0a1f5c,#2563eb)',color:'#fff',border:'none',boxShadow:'0 4px 14px rgba(37,99,235,.35)'}}>🖨 PDF corporativo</Btn>
      </div>}/>
    <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
      <StatCard label={isSuperAdmin?'Formularios':'Mis contactos'} value={contacts.length} accent={P.purple} Icon="📋"/>
      <StatCard label="Capital declarado" value={fmt(totalCap)} accent={P.green} Icon="💵"/>
      <StatCard label={isSuperAdmin?'Leads totales':'Mis leads'} value={leads.length} accent={P.blue} Icon="◈"/>
      <StatCard label="Cerrados" value={closed} accent={P.orange} Icon="✓"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:isMobR?'1fr':'1fr 1fr',gap:18,marginBottom:18}}>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Leads por etapa</p>
        <ErrorBoundary><ResponsiveContainer width="100%" height={190}><BarChart data={pipeData} barSize={24}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.purple} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ErrorBoundary>
      </GlassCard>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Leads por capital</p>
        <ErrorBoundary><ResponsiveContainer width="100%" height={190}><BarChart data={capData} barSize={24}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.blue} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ErrorBoundary>
      </GlassCard>
    </div>
    <GlassCard>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Conversión del pipeline</p>
      <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
        {[['Contactados',leads.filter(l=>l.advisor_contacted).length,P.blue],['Cuenta',leads.filter(l=>l.account_created).length,P.purple],['KYC',leads.filter(l=>l.kyc_verified).length,P.orange],['Depósito',leads.filter(l=>l.deposit_confirmed).length,P.green]].map(([k,v,c])=>(
          <div key={k} style={{flex:1,minWidth:110,textAlign:'center',padding:'18px 10px',borderRadius:12,background:`${c}10`,border:`1px solid ${c}25`}}>
            <div style={{fontSize:30,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</div>
            <div style={{fontSize:11,color:P.muted,marginTop:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>{k}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  </div>
}


// ─── EQUIPO ───────────────────────────────────────────────────────────────────
// ─── EQUIPO UNIFICADO (Equipo + TeamAdmin fusionados) ────────────────────────
function Equipo({user,isSuperAdmin,teamId}){
  const isMobE=useWindowSize()<768
  // ── State ────────────────────────────────────────────────────────────────
  const[staff,setStaff]         =useState([])
  const[teams,setTeams]         =useState([])
  const[modules,setModules]     =useState([])
  const[teamTools,setTeamTools] =useState({})
  const[loading,setLoading]     =useState(true)
  const[tab,setTab]             =useState('miembros') // 'miembros' | 'equipos'
  const[showInvite,setShowInvite]=useState(false)
  const[editMember,setEditMember]=useState(null)
  const[selTeam,setSelTeam]     =useState(null)
  const[showNewTeam,setShowNewTeam]=useState(false)
  const[newTeamName,setNewTeamName]=useState('')
  const[sending,setSending]     =useState(false)
  const[saving,setSaving]       =useState(false)
  const[flash,setFlash]         =useState(null)
  const[search,setSearch]       =useState('')
  const[filterRole,setFilterRole]=useState('todos')
  const[form,setForm]=useState({email:'',display_name:'',title:'Asesor · Pessaro Capital',pessaro_email:'',phone:'',role:'asesor',team_id:''})
  const[editForm,setEditForm]   =useState({})

  const showMsg=(msg,ok=true)=>{setFlash({msg,ok});setTimeout(()=>setFlash(null),3500)}

  // ── Load ─────────────────────────────────────────────────────────────────
  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const queries=[
        supabase.from('crm_staff_profiles').select('*,crm_teams(id,name)').order('display_name'),
        supabase.from('crm_teams').select('*').order('name'),
        supabase.from('crm_modules').select('*').order('sort_order'),
        supabase.from('team_tools').select('*'),
      ]
      if(!isSuperAdmin && teamId){
        queries[0]=supabase.from('crm_staff_profiles').select('*,crm_teams(id,name)').eq('team_id',teamId).order('display_name')
      }
      const[{data:s},{data:t},{data:m},{data:tt}]=await Promise.all(queries)
      // Dedup por user_id: si la query trae filas duplicadas (p.ej. múltiples joins), nos quedamos solo con una
      const dedup=Array.from(new Map((s||[]).map(r=>[r.user_id,r])).values())
      setStaff(dedup)
      setTeams(t||[])
      setModules(m||[])
      const map={}
      ;(tt||[]).forEach(r=>{
        if(!map[r.team_id]) map[r.team_id]=new Set()
        if(r.enabled) map[r.team_id].add(r.module_id)
      })
      setTeamTools(map)
      if(!selTeam && t?.length>0) setSelTeam(t[0].id)
    }catch(e){console.error('equipo load:',e)}
    finally{setLoading(false)}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  useEffect(()=>{load()},[load])

  // ── Invite ────────────────────────────────────────────────────────────────
  const invite=async()=>{
    if(!form.email||!form.display_name)return
    setSending(true)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm_invite_user`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({...form,team_id:form.team_id||teamId||null})
      })
      const d=await res.json()
      if(d.ok){showMsg('Invitación enviada ✓');setShowInvite(false);setForm({email:'',display_name:'',title:'Asesor · Pessaro Capital',pessaro_email:'',phone:'',role:'asesor',team_id:''});await load()}
      else showMsg(d.error||'Error al invitar',false)
    }catch(e){showMsg(e.message,false)}
    setSending(false)
  }

  // ── Edit member ───────────────────────────────────────────────────────────
  const openEdit=(s)=>{
    setEditMember(s)
    setEditForm({display_name:s.display_name,title:s.title||'',pessaro_email:s.pessaro_email||'',phone:s.phone||'',role:s.role||'asesor',team_id:s.team_id||''})
  }

  const saveMember=async()=>{
    if(!editMember)return
    setSaving(true)
    try{
      const {data,error}=await supabase.from('crm_staff_profiles').update({
        display_name:editForm.display_name,
        title:editForm.title,
        pessaro_email:editForm.pessaro_email,
        phone:editForm.phone,
        role:editForm.role,
        team_id:editForm.team_id||null,
      }).eq('user_id',editMember.user_id).select()
      if(error){showMsg('Error: '+error.message,false);setSaving(false);return}
      if(!data||data.length===0){
        showMsg('No se pudo guardar (sin permisos o usuario no encontrado)',false)
        setSaving(false);return
      }
      showMsg('Miembro actualizado ✓')
      setEditMember(null)
      await load()
    }catch(e){showMsg('Error: '+e.message,false)}
    setSaving(false)
  }

  // ── Team tools ────────────────────────────────────────────────────────────
  const toggleTool=async(teamId,moduleId,current)=>{
    const enabled=!current
    try{
      await supabase.from('team_tools').upsert(
        {team_id:teamId,module_id:moduleId,enabled,updated_by:user.id},
        {onConflict:'team_id,module_id'}
      )
      setTeamTools(prev=>{
        const m=new Set(prev[teamId]||[])
        enabled?m.add(moduleId):m.delete(moduleId)
        return{...prev,[teamId]:m}
      })
    }catch(e){showMsg('Error al guardar',false)}
  }

  // ── Create team ───────────────────────────────────────────────────────────
  const createTeam=async()=>{
    if(!newTeamName.trim())return
    setSaving(true)
    try{
      const{data,error}=await supabase.from('crm_teams').insert({name:newTeamName.trim(),created_by:user.id}).select().single()
      if(error) throw error
      const rows=modules.map(m=>({team_id:data.id,module_id:m.id,enabled:true,updated_by:user.id}))
      if(rows.length) await supabase.from('team_tools').insert(rows)
      setNewTeamName('');setShowNewTeam(false)
      await load()
      setSelTeam(data.id)
      showMsg('Equipo creado ✓')
    }catch(e){showMsg('Error: '+e.message,false)}
    setSaving(false)
  }

  // ── Assign advisor to team ────────────────────────────────────────────────
  const assignAdvisor=async(userId,newTeamId)=>{
    try{
      // .select() devuelve las filas afectadas → si es 0, RLS bloqueó o no encontró
      const {data,error}=await supabase.from('crm_staff_profiles')
        .update({team_id:newTeamId||null})
        .eq('user_id',userId)
        .select()
      if(error){showMsg('Error al asignar: '+error.message,false);return}
      if(!data||data.length===0){
        showMsg('No se pudo guardar (sin permisos o usuario no encontrado)',false)
        return
      }
      setStaff(prev=>prev.map(s=>s.user_id===userId?{...s,team_id:newTeamId||null,crm_teams:teams.find(t=>t.id===newTeamId)||null}:s))
      showMsg('Asignación actualizada ✓')
    }catch(e){showMsg('Error al asignar: '+e.message,false)}
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered=staff.filter(s=>{
    const q=search.toLowerCase()
    const matchQ=!q||(s.display_name||'').toLowerCase().includes(q)||(s.pessaro_email||'').toLowerCase().includes(q)
    // Normalizar role: lowercase + trim para evitar mismatches por capitalización o espacios
    const role=(s.role||'').toLowerCase().trim()
    const matchR=filterRole==='todos'||role===filterRole
    return matchQ&&matchR
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const roleLabel={super_admin:'Super Admin',broker:'Administrador',asesor:'Asesor'}
  const roleColor={super_admin:P.orange,broker:P.blue,asesor:P.purple}
  const roleBg   ={super_admin:P.orangeDim,broker:P.blueDim,asesor:P.purpleDim}
  const RoleBadge=({role})=>{
    const r=role||'asesor'
    return <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,
      background:roleBg[r]||P.purpleDim,color:roleColor[r]||P.purple,
      border:`1px solid ${(roleColor[r]||P.purple)}30`}}>{roleLabel[r]||r}</span>
  }

  const selTeamData =teams.find(t=>t.id===selTeam)
  const selTeamStaff=staff.filter(s=>s.team_id===selTeam)
  const unassigned  =staff.filter(s=>!s.team_id)
  const enabledMods =teamTools[selTeam]||new Set()

  // ── Tabs (solo super admin ve ambos tabs) ─────────────────────────────────
  const TABS=isSuperAdmin
    ?[{id:'miembros',label:'👥 Miembros'},{id:'equipos',label:'⬡ Equipos'}]
    :[{id:'miembros',label:'👥 Mi Equipo'}]

  return <div>
    {/* Header */}
    <SHdr
      title={isSuperAdmin?'Gestión de Equipo':'Mi Equipo'}
      sub={`${staff.length} miembro${staff.length!==1?'s':''} · ${teams.length} equipo${teams.length!==1?'s':''}`}
      action={<div style={{display:'flex',gap:8}}>
        {tab==='equipos'&&isSuperAdmin&&<Btn onClick={()=>setShowNewTeam(true)}>+ Nuevo equipo</Btn>}
        {tab==='miembros'&&<Btn onClick={()=>setShowInvite(true)}>✉ Invitar miembro</Btn>}
      </div>}/>

    {/* Flash */}
    {flash&&<div style={{marginBottom:16,padding:'10px 16px',borderRadius:8,fontSize:13,
      background:flash.ok?P.greenDim:P.redDim,
      border:`1px solid ${flash.ok?P.green:P.red}30`,
      color:flash.ok?P.green:P.red}}>{flash.msg}</div>}

    {/* Tabs */}
    {isSuperAdmin&&<div style={{display:'flex',gap:4,marginBottom:20,borderBottom:`1px solid ${P.border}`,paddingBottom:0}}>
      {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)}
        style={{padding:'9px 18px',fontSize:13,fontWeight:tab===t.id?700:400,cursor:'pointer',
          background:'none',border:'none',borderBottom:tab===t.id?`2px solid ${P.purple}`:'2px solid transparent',
          color:tab===t.id?P.purple:P.muted,marginBottom:-1,transition:'all 0.1s'}}>
        {t.label}
      </button>)}
    </div>}

    {loading?<Spinner/>:<>

    {/* ══ TAB: MIEMBROS ══ */}
    {tab==='miembros'&&<>

      {/* KPIs super admin */}
      {isSuperAdmin&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        {(()=>{
          // Helper: normalizar role para conteo consistente
          const r=s=>(s.role||'').toLowerCase().trim()
          return[
            ['Total miembros',staff.length,P.purple],
            ['Super Admins',staff.filter(s=>r(s)==='super_admin').length,P.orange],
            ['Administradores',staff.filter(s=>r(s)==='broker'||r(s)==='admin').length,P.blue],
            ['Asesores',staff.filter(s=>r(s)==='asesor').length,P.green],
            ['Equipos',teams.length,P.muted],
          ]
        })().map(([l,v,c])=><div key={l} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:'14px 16px'}}>
          <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
          <div style={{fontSize:11,color:P.muted,marginTop:3}}>{l}</div>
        </div>)}
      </div>}

      {/* Filtros */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o email..."
          style={{flex:1,minWidth:200,background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:13,outline:'none'}}/>
        {isSuperAdmin&&<div style={{display:'flex',gap:6}}>
          {['todos','asesor','broker','super_admin'].map(r=><button key={r} onClick={()=>setFilterRole(r)}
            style={{padding:'7px 12px',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:filterRole===r?600:400,
              background:filterRole===r?P.purpleDim:'rgba(255,255,255,0.04)',
              color:filterRole===r?P.purple:P.muted,
              border:`1px solid ${filterRole===r?P.purpleBorder:P.border}`}}>
            {r==='todos'?'Todos':r==='broker'?'Admins':r==='super_admin'?'Super Admin':'Asesores'}
          </button>)}
        </div>}
      </div>

      {/* Tabla miembros */}
      {filtered.length===0
        ?<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin miembros encontrados</div>
        :<div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${P.border}`}}>
                {['Miembro','Cargo','Rol','Equipo',isSuperAdmin?'Acciones':''].filter(Boolean).map(h=>
                  <th key={h} style={{padding:'11px 16px',textAlign:'left',fontSize:10,color:P.muted,
                    textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s,i)=><tr key={s.user_id}
                style={{borderBottom:i<filtered.length-1?`1px solid ${P.border}`:'none'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(108,92,231,0.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>

                {/* Avatar + nombre */}
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:36,height:36,borderRadius:9,background:roleBg[s.role]||P.purpleDim,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:14,fontWeight:700,color:roleColor[s.role]||P.purple,flexShrink:0}}>
                      {(s.display_name||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:P.text}}>{s.display_name||'Sin nombre'}</div>
                      <div style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{s.pessaro_email||'—'}</div>
                    </div>
                  </div>
                </td>

                <td style={{padding:'12px 16px',fontSize:12,color:P.textSub}}>{s.title||'—'}</td>
                <td style={{padding:'12px 16px'}}><RoleBadge role={s.role}/></td>

                {/* Equipo — con selector inline si es super admin */}
                <td style={{padding:'12px 16px'}}>
                  {isSuperAdmin
                    ?<select
                        value={s.team_id||''}
                        onChange={e=>assignAdvisor(s.user_id,e.target.value||null)}
                        style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:6,
                          padding:'4px 8px',color:s.team_id?P.blue:P.muted,fontSize:12,outline:'none',cursor:'pointer'}}>
                        <option value="">Sin equipo</option>
                        {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    :s.crm_teams?.name
                      ?<span style={{fontSize:12,padding:'3px 8px',borderRadius:5,background:P.blueDim,color:P.blue,border:`1px solid ${P.blue}30`}}>{s.crm_teams.name}</span>
                      :<span style={{fontSize:12,color:P.muted}}>Sin equipo</span>
                  }
                </td>

                {/* Editar — solo super admin */}
                {isSuperAdmin&&<td style={{padding:'12px 16px'}}>
                  <button onClick={()=>openEdit(s)}
                    style={{padding:'5px 12px',borderRadius:6,fontSize:12,cursor:'pointer',
                      background:P.purpleDim,color:P.purple,border:`1px solid ${P.purpleBorder}`,fontWeight:600}}>
                    ✎ Editar
                  </button>
                </td>}
              </tr>)}
            </tbody>
          </table>
        </div>
      }
    </>}

    {/* ══ TAB: EQUIPOS ══ */}
    {tab==='equipos'&&isSuperAdmin&&<>

      {/* Nuevo equipo form */}
      {showNewTeam&&<GlassCard style={{marginBottom:16,padding:16}}>
        <p style={{fontSize:13,fontWeight:600,color:P.text,margin:'0 0 12px'}}>Nuevo equipo</p>
        <div style={{display:'flex',gap:8}}>
          <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)}
            placeholder="Nombre del equipo..."
            style={{flex:1,background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:13,outline:'none'}}/>
          <Btn onClick={createTeam} disabled={saving}>{saving?'Creando...':'Crear'}</Btn>
          <Btn variant="ghost" onClick={()=>{setShowNewTeam(false);setNewTeamName('')}}>Cancelar</Btn>
        </div>
      </GlassCard>}

      {teams.length===0
        ?<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin equipos aún</div>
        :<div style={{display:'grid',gridTemplateColumns:isMobE?'1fr':'220px 1fr',gap:16}}>

          {/* Lista de equipos */}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {teams.map(t=><button key={t.id} onClick={()=>setSelTeam(t.id)}
              style={{padding:'10px 14px',borderRadius:8,textAlign:'left',cursor:'pointer',
                background:selTeam===t.id?P.purpleDim:'rgba(255,255,255,0.03)',
                border:`1px solid ${selTeam===t.id?P.purpleBorder:P.border}`,
                color:selTeam===t.id?P.purple:P.text,fontSize:13,fontWeight:selTeam===t.id?600:400}}>
              <div>{t.name}</div>
              <div style={{fontSize:11,color:P.muted,marginTop:2}}>{staff.filter(s=>s.team_id===t.id).length} miembro{staff.filter(s=>s.team_id===t.id).length!==1?'s':''}</div>
            </button>)}
          </div>

          {/* Detalle del equipo seleccionado */}
          {selTeamData?<div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* Herramientas habilitadas */}
            <GlassCard>
              <p style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 14px'}}>🔧 Herramientas habilitadas</p>
              {modules.length===0
                ?<p style={{fontSize:12,color:P.muted}}>Sin módulos configurados</p>
                :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
                  {modules.map(m=>{
                    const on=enabledMods.has(m.id)
                    return <button key={m.id} onClick={()=>toggleTool(selTeam,m.id,on)}
                      style={{padding:'8px 12px',borderRadius:8,cursor:'pointer',textAlign:'left',
                        background:on?P.purpleDim:'rgba(255,255,255,0.03)',
                        border:`1px solid ${on?P.purpleBorder:P.border}`,
                        color:on?P.purple:P.muted,fontSize:12,fontWeight:on?600:400,
                        display:'flex',alignItems:'center',gap:6}}>
                      <span>{on?'✓':'○'}</span>
                      <span>{m.icon} {m.label}</span>
                    </button>
                  })}
                </div>
              }
            </GlassCard>

            {/* Miembros del equipo */}
            <GlassCard>
              <p style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 14px'}}>👥 Miembros del equipo ({selTeamStaff.length})</p>
              {selTeamStaff.length===0
                ?<p style={{fontSize:13,color:P.muted}}>Sin miembros asignados</p>
                :selTeamStaff.map(s=><div key={s.user_id}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:`1px solid ${P.border}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:30,height:30,borderRadius:7,background:roleBg[s.role]||P.purpleDim,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:roleColor[s.role]||P.purple}}>
                      {(s.display_name||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:P.text}}>{s.display_name}</div>
                      <div style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{s.pessaro_email}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <RoleBadge role={s.role}/>
                    <button onClick={()=>assignAdvisor(s.user_id,null)}
                      style={{fontSize:11,padding:'3px 10px',borderRadius:6,cursor:'pointer',background:P.redDim,border:`1px solid ${P.red}30`,color:P.red}}>
                      Quitar
                    </button>
                  </div>
                </div>)
              }
            </GlassCard>

            {/* Sin equipo — para asignar al equipo seleccionado */}
            {unassigned.length>0&&<GlassCard>
              <p style={{fontSize:11,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 14px'}}>⚠ Sin equipo asignado ({unassigned.length})</p>
              {unassigned.map(s=><div key={s.user_id}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:`1px solid ${P.border}`}}>
                <div>
                  <span style={{fontSize:13,fontWeight:600,color:P.text}}>{s.display_name}</span>
                  <span style={{fontSize:11,color:P.muted,marginLeft:8,fontFamily:'monospace'}}>{s.pessaro_email}</span>
                </div>
                <button onClick={()=>assignAdvisor(s.user_id,selTeam)}
                  style={{fontSize:11,padding:'3px 10px',borderRadius:6,cursor:'pointer',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,color:P.purple}}>
                  + Asignar a {selTeamData.name}
                </button>
              </div>)}
            </GlassCard>}

          </div>:<p style={{color:P.muted,fontSize:13}}>Selecciona un equipo</p>}
        </div>
      }
    </>}

    </>}

    {/* ── Modal: Invitar nuevo miembro ── */}
    {showInvite&&<Modal title="Invitar nuevo miembro" onClose={()=>setShowInvite(false)} accent={P.green}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{padding:'10px 14px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}>
          <p style={{fontSize:12,color:P.green,margin:0}}>Se enviará un email de invitación. El usuario establece su contraseña y accede al CRM.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Email personal *</Lbl><Input value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} placeholder="usuario@gmail.com" type="email"/></div>
          <div><Lbl>Nombre completo *</Lbl><Input value={form.display_name} onChange={v=>setForm(p=>({...p,display_name:v}))} placeholder="Juan García"/></div>
          <div><Lbl>Email @pessaro.cl</Lbl><Input value={form.pessaro_email} onChange={v=>setForm(p=>({...p,pessaro_email:v}))} placeholder="juan@pessaro.cl" type="email"/></div>
          <div><Lbl>Teléfono</Lbl><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="56912345678"/></div>
          <div style={{gridColumn:'1/-1'}}><Lbl>Cargo</Lbl><Input value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Asesor · Pessaro Capital"/></div>
          {isSuperAdmin&&<>
            <div><Lbl>Rol en el sistema</Lbl>
              <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}
                style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none'}}>
                <option value="asesor">Asesor</option>
                <option value="broker">Administrador</option>
              </select>
            </div>
            <div><Lbl>Equipo</Lbl>
              <select value={form.team_id} onChange={e=>setForm(p=>({...p,team_id:e.target.value}))}
                style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none'}}>
                <option value="">Sin equipo</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </>}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowInvite(false)}>Cancelar</Btn>
          <Btn onClick={invite} disabled={sending||!form.email||!form.display_name}>{sending?'Enviando...':'Enviar invitación ✉'}</Btn>
        </div>
      </div>
    </Modal>}

    {/* ── Modal: Editar miembro ── */}
    {editMember&&<Modal title={`Editar · ${editMember.display_name}`} onClose={()=>setEditMember(null)} accent={P.purple}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{gridColumn:'1/-1'}}><Lbl>Nombre completo</Lbl><Input value={editForm.display_name} onChange={v=>setEditForm(p=>({...p,display_name:v}))} placeholder="Nombre completo"/></div>
          <div><Lbl>Email @pessaro.cl</Lbl><Input value={editForm.pessaro_email} onChange={v=>setEditForm(p=>({...p,pessaro_email:v}))} type="email"/></div>
          <div><Lbl>Teléfono</Lbl><Input value={editForm.phone} onChange={v=>setEditForm(p=>({...p,phone:v}))}/></div>
          <div style={{gridColumn:'1/-1'}}><Lbl>Cargo</Lbl><Input value={editForm.title} onChange={v=>setEditForm(p=>({...p,title:v}))}/></div>
          <div>
            <Lbl>Rol del sistema</Lbl>
            <select value={editForm.role} onChange={e=>setEditForm(p=>({...p,role:e.target.value}))}
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none'}}>
              <option value="asesor">Asesor</option>
              <option value="broker">Administrador</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <Lbl>Equipo asignado</Lbl>
            <select value={editForm.team_id} onChange={e=>setEditForm(p=>({...p,team_id:e.target.value}))}
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none'}}>
              <option value="">Sin equipo</option>
              {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{padding:'10px 14px',background:P.orangeDim,border:`1px solid ${P.orange}30`,borderRadius:8}}>
          <p style={{fontSize:11,color:P.orange,margin:0}}>⚠ Cambiar el rol actualiza los permisos de acceso inmediatamente.</p>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:4}}>
          <Btn variant="ghost" onClick={()=>setEditMember(null)}>Cancelar</Btn>
          <Btn onClick={saveMember} disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── BROKER VIEW ─────────────────────────────────────────────────────────────
function BrokerView({user,campaigns,leads,isSuperAdmin}){
  const[assignments,setAssignments]=useState([])
  const[loading,setLoading]=useState(true)
  const[tab,setTab]=useState('campanas')

  useEffect(()=>{
    const load=async()=>{
      setLoading(true)
      try{
        const{data}=await supabase.from('broker_assignments')
          .select('*,campaigns(id,name),crm_staff_profiles!advisor_user_id(display_name,pessaro_email)')
          .eq('broker_user_id',user.id)
        setAssignments(data||[])
      }catch(e){console.error('broker load:',e)}
      finally{setLoading(false)}
    }
    load()
  },[user.id])

  const assignedCampaignIds=new Set(assignments.filter(a=>a.campaign_id).map(a=>a.campaign_id))
  const assignedAdvisorIds=new Set(assignments.filter(a=>a.advisor_user_id).map(a=>a.advisor_user_id))
  const myCampaigns=campaigns.filter(c=>assignedCampaignIds.has(c.id))
  const myLeads=leads.filter(l=>assignedAdvisorIds.has(l.advisor_assigned)||assignedCampaignIds.size===0)

  const etapaLabel={1:'Registro',2:'Contactado',3:'Cuenta',4:'KYC',5:'Depósito'}
  const etapaColor={1:P.muted,2:P.blue,3:P.orange,4:P.purple,5:P.green}

  return <div style={{minHeight:'100vh',background:P.bg,padding:'28px 32px'}}>
    <div style={{marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
      <div>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:P.text}}>Panel Broker</h1>
        <p style={{margin:'4px 0 0',fontSize:13,color:P.muted}}>Vista supervisora — Pessaro Capital</p>
      </div>
      <div style={{padding:'4px 12px',background:P.orangeDim,border:`1px solid ${P.orange}30`,borderRadius:8}}>
        <span style={{fontSize:11,color:P.orange,fontWeight:700}}>⬡ Broker</span>
      </div>
    </div>

    {/* KPIs */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:24}}>
      {[
        ['Campañas asignadas', myCampaigns.length, P.purple],
        ['Asesores supervisados', assignedAdvisorIds.size, P.blue],
        ['Leads totales', myLeads.length, P.green],
        ['Con depósito', myLeads.filter(l=>l.deposit_confirmed).length, P.orange],
      ].map(([label,val,color])=>(
        <div key={label} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:'16px 18px'}}>
          <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
          <div style={{fontSize:12,color:P.muted,marginTop:4}}>{label}</div>
        </div>
      ))}
    </div>

    {/* Tabs */}
    <div style={{display:'flex',gap:8,marginBottom:20}}>
      {[['campanas','🚀 Campañas'],['leads','👥 Leads'],['asesores','🧑‍💼 Asesores']].map(([id,label])=>(
        <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',
          background:tab===id?P.purpleDim:'rgba(255,255,255,0.04)',color:tab===id?P.purple:P.muted,
          border:`1px solid ${tab===id?P.purpleBorder:P.border}`,fontWeight:tab===id?600:400}}>{label}</button>
      ))}
    </div>

    {loading?<div style={{textAlign:'center',padding:48,color:P.muted}}>Cargando...</div>:(<>

      {tab==='campanas'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
        {myCampaigns.length===0?<p style={{color:P.muted,fontSize:13}}>Sin campañas asignadas aún.</p>:
        myCampaigns.map(c=>{
          const campLeads=myLeads.filter(l=>l.team||true) // all for now
          const deposited=campLeads.filter(l=>l.deposit_confirmed).length
          return <div key={c.id} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:18}}>
            <div style={{fontWeight:700,color:P.text,marginBottom:6}}>{c.name}</div>
            <div style={{fontSize:12,color:P.muted,marginBottom:12}}>Estado: <span style={{color:P.green}}>{c.status}</span></div>
            <div style={{display:'flex',gap:8,fontSize:12}}>
              <div style={{flex:1,background:P.purpleDim,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700,color:P.purple}}>{campLeads.length}</div>
                <div style={{color:P.muted}}>Leads</div>
              </div>
              <div style={{flex:1,background:P.greenDim,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700,color:P.green}}>{deposited}</div>
                <div style={{color:P.muted}}>Depósitos</div>
              </div>
            </div>
          </div>
        })}
      </div>}

      {tab==='leads'&&<div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
            {['Nombre','Email','Etapa','Asesor','Depósito'].map(h=><th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {myLeads.slice(0,50).map((l,i)=><tr key={l.id} style={{borderBottom:i<myLeads.length-1?`1px solid ${P.border}`:'none'}}>
              <td style={{padding:'10px 16px',fontSize:13,color:P.text,fontWeight:600}}>{l.full_name||'—'}</td>
              <td style={{padding:'10px 16px',fontSize:12,color:P.muted,fontFamily:'monospace'}}>{l.email}</td>
              <td style={{padding:'10px 16px'}}><span style={{fontSize:11,padding:'3px 8px',borderRadius:5,background:(etapaColor[l.etapa]||P.muted)+'20',color:etapaColor[l.etapa]||P.muted,fontWeight:600}}>{etapaLabel[l.etapa]||'—'}</span></td>
              <td style={{padding:'10px 16px',fontSize:12,color:P.muted}}>{l.advisor_assigned||'—'}</td>
              <td style={{padding:'10px 16px'}}>{l.deposit_confirmed?<span style={{color:P.green,fontSize:12,fontWeight:700}}>✓ ${l.deposit_amount_usd||0}</span>:<span style={{color:P.muted,fontSize:12}}>—</span>}</td>
            </tr>)}
          </tbody>
        </table>
        {myLeads.length===0&&<p style={{textAlign:'center',padding:32,color:P.muted,fontSize:13}}>Sin leads asignados</p>}
      </div>}

      {tab==='asesores'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
        {assignments.filter(a=>a.advisor_user_id).length===0?<p style={{color:P.muted,fontSize:13}}>Sin asesores asignados aún.</p>:
        assignments.filter(a=>a.advisor_user_id).map(a=>{
          const advisorLeads=myLeads.filter(l=>l.advisor_assigned===a.advisor_user_id)
          const profile=a.crm_staff_profiles
          return <div key={a.id} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:18}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{width:34,height:34,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:P.purple}}>
                {(profile?.display_name||'?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{fontWeight:700,color:P.text,fontSize:13}}>{profile?.display_name||'Asesor'}</div>
                <div style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{profile?.pessaro_email||'—'}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,fontSize:12}}>
              <div style={{flex:1,background:P.purpleDim,borderRadius:8,padding:'7px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700,color:P.purple}}>{advisorLeads.length}</div>
                <div style={{color:P.muted,fontSize:11}}>Leads</div>
              </div>
              <div style={{flex:1,background:P.greenDim,borderRadius:8,padding:'7px 10px',textAlign:'center'}}>
                <div style={{fontWeight:700,color:P.green}}>{advisorLeads.filter(l=>l.deposit_confirmed).length}</div>
                <div style={{color:P.muted,fontSize:11}}>Depósitos</div>
              </div>
            </div>
          </div>
        })}
      </div>}
    </>)}
  </div>
}

// ─── WHATSAPP MESSAGES MODULE ────────────────────────────────────────────────
function WhatsAppMessages({ user, staffProfile, isSuperAdmin, waAssignments, setWaAssignments, navPhone, onNavConsumed, onPhoneChange }) {
  const [selectedPhone, setSelectedPhone] = useState(null)
  const [selectedName, setSelectedName]   = useState(null)
  const [subTab, setSubTab]               = useState('chat')
  const [staffList, setStaffList]         = useState([])
  const [myContacts, setMyContacts]       = useState([])  // contactos personales del usuario (para "Iniciar chat")
  const [mobileView, setMobileView]       = useState('inbox') // 'inbox' | 'chat'
  const isMob = useWindowSize() < 768

  // Load all staff profiles for assignment UI
  useEffect(()=>{
    ;(async()=>{
      const{data}=await supabase.from('crm_staff_profiles').select('id,user_id,display_name,role').order('display_name')
      setStaffList(data||[])
    })()
  },[])

  // Cargar contactos personales del usuario (para iniciar chats vía plantilla)
  useEffect(()=>{
    if(!user?.id)return
    ;(async()=>{
      const{data}=await supabase
        .from('crm_contacts')
        .select('id,full_name,phone,email')
        .eq('user_id',user.id)
        .not('phone','is',null)
        .order('full_name')
      setMyContacts(data||[])
    })()
  },[user?.id])

  useEffect(()=>{
    if(navPhone?.phone){
      setSelectedPhone(navPhone.phone)
      setSelectedName(navPhone.name||navPhone.phone)
      setSubTab('chat')
      setMobileView('chat')
      onPhoneChange?.(navPhone.phone)
      onNavConsumed?.()
    }
  },[navPhone])

  function handleSelect(phone, name) {
    setSelectedPhone(phone)
    setSelectedName(name)
    setSubTab('chat')
    setMobileView('chat')
    onPhoneChange?.(phone)
  }

  async function handleAssign(phone, assignedToId) {
    // Optimistic update
    setWaAssignments(prev=>[...prev.filter(a=>a.client_phone!==phone),{client_phone:phone,assigned_to:assignedToId}])
    await supabase.from('whatsapp_assignments').upsert(
      {client_phone:phone,assigned_to:assignedToId,assigned_by:staffProfile?.id},
      {onConflict:'client_phone'}
    )
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:P.text, margin:'0 0 4px' }}>WhatsApp</h2>
          <p style={{ fontSize:13, color:P.muted, margin:0 }}>
            Bandeja de mensajes · los envíos masivos viven ahora en el módulo <strong style={{color:P.textSub}}>Campañas → WhatsApp (WABA)</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {[['chat','💬 Mensajes'],['wafinance','💹 WAFinance']].map(([id, label]) => (
            <button key={id} onClick={() => setSubTab(id)}
              style={{
                padding:'7px 14px', borderRadius:8, fontSize:12, cursor:'pointer',
                fontWeight: subTab === id ? 700 : 400,
                background: subTab === id ? (id==='wafinance'?'rgba(108,92,231,0.15)':P.greenDim) : 'rgba(255,255,255,0.03)',
                color: subTab === id ? (id==='wafinance'?P.purple:P.green) : P.muted,
                border: subTab === id ? `1px solid ${id==='wafinance'?P.purple+'40':P.green+'40'}` : `1px solid ${P.border}`,
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'chat' && (
        <div style={{ display:'flex', height: isMob ? 'calc(100vh - 160px)' : 'calc(100vh - 180px)', borderRadius:14, overflow:'hidden', border:`1px solid ${P.border}` }}>
          {(!isMob || mobileView==='inbox') && (
            <div style={{ width: isMob ? '100%' : 280, flexShrink:0 }}>
              <WhatsAppInbox
                selectedPhone={selectedPhone}
                onSelect={handleSelect}
                isSuperAdmin={isSuperAdmin}
                staffProfile={staffProfile}
                assignments={waAssignments}
                staffList={staffList}
                myContacts={myContacts}
                currentUserId={user?.id}
              />
            </div>
          )}
          {(!isMob || mobileView==='chat') && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', position:'relative', minWidth:0 }}>
              {isMob && (
                <button onClick={()=>setMobileView('inbox')}
                  style={{background:P.surface,border:`1px solid ${P.border}`,borderBottom:'none',borderRadius:'8px 8px 0 0',color:P.text,cursor:'pointer',fontSize:13,padding:'10px 14px',display:'flex',alignItems:'center',gap:6,minHeight:44,width:'100%',justifyContent:'flex-start',fontWeight:600}}>
                  ← Volver a la bandeja
                </button>
              )}
              <ChatWindow
                clientPhone={selectedPhone}
                clientName={selectedName}
                staffId={staffProfile?.id}
                isSuperAdmin={isSuperAdmin}
                assignments={waAssignments}
                staffList={staffList}
                onAssign={handleAssign}
                currentUserId={user?.id}
              />
            </div>
          )}
        </div>
      )}

      {subTab === 'wafinance' && (
        <WAFinanceChatInbox user={user} staffProfile={staffProfile} isSuperAdmin={isSuperAdmin} />
      )}

    </div>
  )
}

export default function App(){
  const[user,setUser]          =useState(null)
  const[checking,setChecking]  =useState(true)
  const[isSuperAdmin,setSA]    =useState(false)
  const[isBroker,setIsBroker]  =useState(false)
  const[teamId,setTeamId]      =useState(null)
  const[tools,setTools]        =useState([])   // módulos habilitados para este usuario
  const[module,setModule]      =useState('dashboard')
  const[showPasswordReset,setShowPasswordReset]=useState(false)
  const[contacts,setContacts]  =useState([])
  const[leads,setLeads]        =useState([])
  const[staffProfile,setSP]    =useState(null)
  const[campaigns,setCampaigns]=useState([])
  const[loading,setLoading]    =useState(true)
  const[waUnread,setWaUnread]  =useState(0)
  const[taskBadge,setTaskBadge]=useState(0)
  const[waToasts,setWaToasts]  =useState([])
  const[waNavPhone,setWaNavPhone]=useState(null)
  const[waViewingPhone,setWaViewingPhone]=useState(null)
  const[waAssignments,setWaAssignments]=useState([])
  const[installPrompt,setInstallPrompt]=useState(null)
  const[pwaDismissed,setPwaDismissed]=useState(()=>localStorage.getItem('pwa-dismissed')==='1')
  const[menuOpen,setMenuOpen]=useState(false)
  const[tabletExpanded,setTabletExpanded]=useState(false)
  const screenW=useWindowSize()
  const isMobile=screenW<768
  const isTablet=screenW>=768&&screenW<1024

  // ── Helpers de rol ────────────────────────────────────────────────────────
  // canAccess: true si el módulo está en tools[] o el usuario es super_admin
  const canAccess=(mod)=>isSuperAdmin||tools.includes(mod)

  // ── Estado para mostrar error de acceso no autorizado ─────────────────────
  const[noStaffError,setNoStaffError]=useState(false)

  // ── Auth + perfil RBAC ────────────────────────────────────────────────────
  useEffect(()=>{
    // loadProfile: valida que el usuario sea staff CRM + carga rol/tools
    // Retorna true si OK, false si NO es staff (cliente del portal pessaro.cl)
    const loadProfile=async(u)=>{
      if(!u){setSA(false);setIsBroker(false);setTeamId(null);setTools([]);return true}
      try{
        const{data}=await supabase.rpc('get_my_profile')
        const role=data?.role
        // RESTRICCIÓN: solo staff CRM puede entrar
        // Si role==='no_staff' → es cliente del portal pessaro.cl, NO debe acceder al CRM
        if(role==='no_staff'){
          console.warn('[auth] Acceso denegado: usuario no registrado como staff CRM')
          setNoStaffError(true)
          // signOut limpio
          try{await supabase.auth.signOut({scope:'local'})}catch{}
          try{localStorage.clear();sessionStorage.clear()}catch{}
          setUser(null);setSA(false);setIsBroker(false);setTeamId(null);setTools([])
          return false
        }
        const finalRole=role||'asesor'
        const tid=data?.team_id||null
        const t=data?.tools||[]
        setSA(finalRole==='super_admin')
        setIsBroker(finalRole==='broker')
        setTeamId(tid)
        setTools(t)
        setNoStaffError(false)
        return true
      }catch(e){
        console.warn('get_my_profile fallback:',e)
        const role=u?.user_metadata?.role||'asesor'
        setSA(role==='super_admin')
        setIsBroker(role==='broker')
        setTools(['dashboard','contacts','pipeline','emails','tasks'])
        return true
      }
    }
    supabase.auth.getSession().then(async({data:{session},error})=>{
      // Si getSession falla con error de auth (token expirado), limpiar y volver al login
      if(error){
        console.warn('getSession error:',error.message)
        localStorage.clear();sessionStorage.clear()
        setChecking(false);return
      }
      const u=session?.user??null
      setUser(u)
      await loadProfile(u)
      setChecking(false)
    }).catch(()=>setChecking(false))
    // IMPORTANTE: el handler de onAuthStateChange NO debe ser async ni tener awaits.
    // Si lo es, el SDK de Supabase queda bloqueado esperando que termine,
    // y operaciones como updateUser() (cambio de contraseña) se cuelgan.
    // Solución: ejecutar loadProfile sin await (fire-and-forget).
    const{data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){setShowPasswordReset(true);return}

      // ── Detección de sesión inválida ─────────────────────────────────────
      // SIGNED_OUT: logout explícito O refresh_token expirado (400 Bad Request)
      // TOKEN_REFRESHED con session=null: refresh falló silenciosamente
      // USER_UPDATED con session=null: caso edge
      if((event==='SIGNED_OUT'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED')&&!session){
        console.warn('[auth] Sesión expirada o invalidada. event:',event)
        // Limpiar todo el estado de auth + storage
        try{localStorage.clear();sessionStorage.clear()}catch{}
        setUser(null);setSA(false);setIsBroker(false);setTeamId(null);setTools([])
        // Si no estamos ya en el login screen, redirigir
        // (evita el loop de spinners cuando los queries fallan con 401)
        if(window.location.pathname!=='/'){
          window.location.replace('/')
        }
        return
      }

      const u=session?.user??null
      setUser(prev=>{
        if(prev?.id===u?.id) return prev
        return u
      })
      // Fire-and-forget: NO bloquear el callback con await
      loadProfile(u).catch(e=>console.warn('[auth] loadProfile error:',e))
    })

    // ── Watchdog de sesión: detecta token muerto que onAuthStateChange no captura ──
    // Cubre el caso refresh_token 400 después de inactividad larga (PWA escritorio que queda abierta)
    // ── Watchdog ultra-conservador contra falsos positivos ─────────────────
    // Resistente a:
    //  - Apertura de DevTools (sin focus listener)
    //  - Cambio entre pestañas/ventanas (grace period)
    //  - Errores transient de red (3 fallos consecutivos + sólo errores AUTH explícitos)
    //  - Sesión aún no hidratada del localStorage al iniciar (INITIAL_GRACE 90s)
    //  - Token en localStorage pero getSession devuelve null transient
    let lastCheck=0
    let lastOkAt=Date.now()
    let consecutiveFails=0
    const startedAt=Date.now()
    const INITIAL_GRACE=90000      // 90s de gracia inicial al montar la app
    const CHECK_DEBOUNCE=10000     // Mínimo 10s entre checks
    const GRACE_PERIOD=30000       // 30s desde último OK → ignora visibility events
    const MAX_FAILS=3              // 3 fallos consecutivos antes de desloguear

    // Solo desloguear si el error es explícitamente de auth (no por timeout/red)
    const isAuthError=(error)=>{
      if(!error?.message)return false
      const m=error.message.toLowerCase()
      return m.includes('refresh')||m.includes('expired')||m.includes('invalid')||m.includes('jwt')||m.includes('unauthorized')
    }

    // Verifica si HAY token en localStorage (aunque la session no esté hidratada aún)
    const hasLocalToken=()=>{
      try{
        const SUPABASE_REF='ldlflxujrjihiybrcree'
        const raw=localStorage.getItem(`sb-${SUPABASE_REF}-auth-token`)
        if(!raw)return false
        const parsed=JSON.parse(raw)
        return !!(parsed?.access_token||parsed?.refresh_token)
      }catch{return false}
    }

    const checkSession=async(source)=>{
      const now=Date.now()
      // Grace inicial al montar: no desloguear en los primeros 90s aunque session sea null
      if(now-startedAt<INITIAL_GRACE){
        return
      }
      if(now-lastCheck<CHECK_DEBOUNCE)return
      // Grace period: si recién verificamos OK, ignorar visibility events
      if(source==='visibility'&&now-lastOkAt<GRACE_PERIOD){
        return
      }
      lastCheck=now
      try{
        const{data:{session},error}=await supabase.auth.getSession()
        if(error&&isAuthError(error)){
          // Error explícito de auth (token expirado) → ahora sí desloguear
          consecutiveFails++
          console.warn(`[auth-watchdog:${source}] auth error ${consecutiveFails}/${MAX_FAILS}:`,error.message)
          if(consecutiveFails>=MAX_FAILS){
            try{localStorage.clear();sessionStorage.clear()}catch{}
            if(window.location.pathname!=='/'){
              window.location.replace('/')
            }else{
              setUser(null);setChecking(false)
            }
          }
        }else if(!session){
          // Session null sin error AUTH → verificar si localStorage TIENE token (es transient)
          if(hasLocalToken()){
            // localStorage tiene token → session se está re-hidratando, NO contar como fallo
            console.debug(`[auth-watchdog:${source}] session null pero localStorage OK, ignorando`)
            return
          }
          consecutiveFails++
          console.debug(`[auth-watchdog:${source}] session null sin storage ${consecutiveFails}/${MAX_FAILS+2}`)
          // Solo desloguear si MUCHOS intentos seguidos sin sesión Y sin storage
          if(consecutiveFails>=MAX_FAILS+2){
            try{localStorage.clear();sessionStorage.clear()}catch{}
            if(window.location.pathname!=='/'){window.location.replace('/')}
            else{setUser(null);setChecking(false)}
          }
        }else{
          // Sesión OK
          if(consecutiveFails>0)console.debug('[auth-watchdog] recuperado tras fallos')
          consecutiveFails=0
          lastOkAt=now
        }
      }catch(e){console.error('[auth-watchdog] error:',e)}
    }
    // Verificar cada 60s
    const watchdog=setInterval(()=>checkSession('interval'),60000)
    // Verificar al volver al foreground (NO usamos focus listener: muy ruidoso con DevTools)
    const onVisibility=()=>{if(document.visibilityState==='visible')checkSession('visibility')}
    document.addEventListener('visibilitychange',onVisibility)

    return()=>{
      subscription.unsubscribe()
      clearInterval(watchdog)
      document.removeEventListener('visibilitychange',onVisibility)
    }
  },[])

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!user)return
    const load=async()=>{
      setLoading(true)
      try{
        // SA → contact_submissions (formularios web); asesor → crm_contacts (sus propios contactos)
        const contactsQuery=isSuperAdmin
          ?supabase.from('contact_submissions').select('id,full_name,email,mobile,investment_capital,management_type,comments,form_type,status,submitted_at').order('submitted_at',{ascending:false}).limit(200)
          :supabase.from('crm_contacts').select('id,full_name,email,phone,address,notes,status,source,created_at,user_id').eq('user_id',user.id).order('created_at',{ascending:false})
        const[r1,r2,r3,r4]=await Promise.all([
          contactsQuery,
          supabase.from('campaign_leads').select('id,full_name,email,phone,investment_range,etapa,advisor_assigned,advisor_contacted,account_created,kyc_verified,deposit_confirmed,score,team,created_at,variant,perfil,campaign_id,advisor_referral_code').order('created_at',{ascending:false}),
          supabase.from('crm_staff_profiles').select('*,crm_teams(id,name)').eq('user_id',user.id).maybeSingle(),
          supabase.from('campaigns').select('*').eq('status','activa').order('created_at'),
        ])
        setContacts(r1.data||[])
        const allLeads=r2.data||[]
        const sp=r3.data||null
        // SA ve todos los leads; asesor ve solo SUS leads (por advisor_assigned o referral_code)
        if(isSuperAdmin){
          setLeads(allLeads)
        }else{
          const emailPrefix=(user.email||'').split('@')[0].toLowerCase()
          const refCode=sp?.referral_code||''
          setLeads(allLeads.filter(l=>
            (l.advisor_assigned&&l.advisor_assigned.toLowerCase().includes(emailPrefix))
            ||(refCode&&l.advisor_referral_code&&l.advisor_referral_code===refCode)
          ))
        }
        setSP(sp)
        setCampaigns(r4.data||[])
      }catch(e){console.error('data load:',e)}
      finally{setLoading(false)}
    }
    load()
  },[user?.id,isSuperAdmin])

  // ── CSS ───────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const s=document.createElement('style')
    s.textContent=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{background:${P.bg};color:${P.text};font-family:'Inter',sans-serif;}input,select,textarea{font-family:'Inter',sans-serif!important;}::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}input::placeholder,textarea::placeholder{color:${P.muted}!important;}select option{background:${P.surface};}input:focus,select:focus,textarea:focus{border-color:rgba(108,92,231,0.5)!important;}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`
    document.head.appendChild(s)
    return()=>document.head.removeChild(s)
  },[])

  // ── WA Notification refs (stale-closure-safe for subscription) ─────────────
  const _moduleRef=useRef(module)
  const _waPhoneRef=useRef(waViewingPhone)
  const _staffProfileRef=useRef(staffProfile)
  const _isSuperAdminRef=useRef(isSuperAdmin)
  const _waAssignmentsRef=useRef(waAssignments)
  // Map<phone, {phone, name, preview, onClick, native, addedAt}>
  const _pendingNotifsRef=useRef(new Map())
  useEffect(()=>{_moduleRef.current=module},[module])
  useEffect(()=>{_waPhoneRef.current=waViewingPhone},[waViewingPhone])
  useEffect(()=>{_staffProfileRef.current=staffProfile},[staffProfile])
  useEffect(()=>{_isSuperAdminRef.current=isSuperAdmin},[isSuperAdmin])
  useEffect(()=>{_waAssignmentsRef.current=waAssignments},[waAssignments])

  // Cancelar notificación pendiente cuando el user abre el chat manualmente
  useEffect(()=>{
    if(module==='mensajes'&&waViewingPhone&&window.__crmAckNotif){
      window.__crmAckNotif(waViewingPhone)
    }
  },[module,waViewingPhone])

  // ── WA Global Realtime Notifications ──────────────────────────────────────
  // Sistema completo: sonido + vibración + notification nativa + auto-repeat cada 30s
  useEffect(()=>{
    if(!user)return

    // ── Helpers ──────────────────────────────────────────────────────────
    // Sonido (1 o 2 beeps)
    const playBeep=(count=1)=>{
      try{
        const ctx=new(window.AudioContext||window.webkitAudioContext)()
        const playOne=offset=>{
          const osc=ctx.createOscillator(),gain=ctx.createGain()
          osc.connect(gain);gain.connect(ctx.destination)
          osc.frequency.value=880;osc.type='sine'
          gain.gain.setValueAtTime(0.3,ctx.currentTime+offset)
          gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+offset+0.4)
          osc.start(ctx.currentTime+offset);osc.stop(ctx.currentTime+offset+0.4)
        }
        for(let i=0;i<count;i++)playOne(i*0.5)
      }catch{}
    }
    // Vibración (móviles compatibles)
    const vibrate=()=>{try{navigator.vibrate?.([200,100,200])}catch{}}
    // Notification nativa del SO
    const showNativeNotif=(title,body,tag,onClick)=>{
      if(typeof Notification==='undefined'||Notification.permission!=='granted')return null
      try{
        const n=new Notification(title,{
          body,tag,
          icon:'https://pessaro.cl/images/logo-256.webp',
          badge:'https://pessaro.cl/images/logo-256.webp',
          requireInteraction:true,renotify:true,
        })
        n.onclick=()=>{try{window.focus()}catch{};try{n.close()}catch{};onClick?.()}
        return n
      }catch{return null}
    }
    // Ack: marca una notificación como vista (cancela repetición)
    const ackNotif=phone=>{
      const e=_pendingNotifsRef.current.get(phone)
      if(e?.native)try{e.native.close()}catch{}
      _pendingNotifsRef.current.delete(phone)
    }
    // Expuesto globalmente para que otros componentes (WaToast.onView, ChatWindow al abrir) lo llamen
    window.__crmAckNotif=ackNotif

    // ── Pedir permiso de notificaciones (defer al primer click del user) ──
    if(typeof Notification!=='undefined'&&Notification.permission==='default'){
      const askOnce=()=>{Notification.requestPermission().catch(()=>{});document.removeEventListener('click',askOnce)}
      document.addEventListener('click',askOnce,{once:true})
    }

    // ── Auto-repeat cada 30s mientras haya pendientes ────────────────────
    const repeatTimer=setInterval(()=>{
      if(_pendingNotifsRef.current.size===0)return
      // Si la pestaña tiene foco Y el user está en módulo Mensajes, asumir que ya las ve
      if(document.hasFocus()&&_moduleRef.current==='mensajes'){
        Array.from(_pendingNotifsRef.current.keys()).forEach(p=>ackNotif(p))
        return
      }
      // Re-disparar TODAS las pendientes (sonido + vibración + notif)
      _pendingNotifsRef.current.forEach(e=>{
        playBeep(1);vibrate()
        showNativeNotif(`🔔 Sin leer: ${e.name||e.phone}`,e.preview||'Tienes mensajes pendientes',`wa-repeat-${e.phone}`,e.onClick)
      })
    },30000)

    // ── Realtime listener: nuevos mensajes inbound ───────────────────────
    const ch=supabase.channel('wa-global-notifs')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'whatsapp_messages'},payload=>{
        const msg=payload.new
        if(msg.direction!=='inbound')return
        const phone=msg.client_phone
        if(_moduleRef.current==='mensajes'&&_waPhoneRef.current===phone)return
        // Assignment filter (sin cambios)
        const _asgn=_waAssignmentsRef.current.find(a=>a.client_phone===phone)
        const _myId=_staffProfileRef.current?.id
        const _amSA=_isSuperAdminRef.current
        if(_asgn){if(_asgn.assigned_to!==_myId)return}
        else{if(!_amSA)return}
        setWaUnread(n=>n+1)
        // Disparar combo: sonido + vibración
        playBeep(2);vibrate()
        const id=uid()
        const preview=(()=>{
          const c=msg.content
          if(c?.text)return c.text.slice(0,60)
          if(msg.message_type==='image')return'🖼 Imagen'
          if(msg.message_type==='document')return'📄 Documento'
          if(msg.message_type==='audio')return'🎵 Audio'
          return''
        })()
        const name=msg.client_name||phone
        const goToChat=()=>{setModule('mensajes');setWaNavPhone({phone,name});ackNotif(phone)}
        // Toast in-app (existente)
        setWaToasts(prev=>[...prev,{id,phone,name,preview}])
        setTimeout(()=>setWaToasts(prev=>prev.filter(t=>t.id!==id)),8000)
        // Notification nativa + registrar para repeat
        const native=showNativeNotif(`💬 ${name}`,preview||'Nuevo mensaje',`wa-${phone}`,goToChat)
        _pendingNotifsRef.current.set(phone,{phone,name,preview,onClick:goToChat,native,addedAt:Date.now()})
      })
      .subscribe()
    return()=>{
      clearInterval(repeatTimer)
      supabase.removeChannel(ch)
      _pendingNotifsRef.current.forEach((_,p)=>ackNotif(p))
      delete window.__crmAckNotif
    }
  },[user?.id])

  // ── Web Push Subscription ─────────────────────────────────────────────────
  // Suscribe el dispositivo al servicio de push del navegador (FCM/Mozilla autopush)
  // POST la subscription al endpoint para que el webhook de WhatsApp pueda enviarle push
  // cuando la PWA está cerrada. Funciona en paralelo con el sistema local de realtime.
  useEffect(()=>{
    if(!user)return
    if(!('serviceWorker' in navigator)||!('PushManager' in window))return
    const VAPID_PUBLIC=import.meta.env.VITE_VAPID_PUBLIC_KEY
    if(!VAPID_PUBLIC){console.warn('[push] VITE_VAPID_PUBLIC_KEY no configurada — saltando subscription');return}

    // Helper: convertir base64url a Uint8Array (requerido por pushManager.subscribe)
    const urlBase64ToUint8Array=(b64)=>{
      const padding='='.repeat((4-b64.length%4)%4)
      const base64=(b64+padding).replace(/-/g,'+').replace(/_/g,'/')
      const raw=window.atob(base64)
      const arr=new Uint8Array(raw.length)
      for(let i=0;i<raw.length;++i)arr[i]=raw.charCodeAt(i)
      return arr
    }

    let cancelled=false

    const setupPush=async()=>{
      try{
        if(typeof Notification==='undefined')return
        if(Notification.permission!=='granted'){
          console.log('[push] permission no concedido aún:',Notification.permission)
          return
        }
        const reg=await navigator.serviceWorker.ready
        let sub=await reg.pushManager.getSubscription()
        if(!sub){
          sub=await reg.pushManager.subscribe({
            userVisibleOnly:true,
            applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC),
          })
          console.log('[push] nueva subscription creada')
        }
        if(cancelled)return
        const {data:{session}}=await supabase.auth.getSession()
        if(!session?.access_token){console.warn('[push] sin access_token');return}
        const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://ldlflxujrjihiybrcree.supabase.co'
        const res=await fetch(`${SUPABASE_URL}/functions/v1/push_notifications_2026_02_27`,{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'Authorization':`Bearer ${session.access_token}`,
          },
          body:JSON.stringify({action:'subscribe',subscription:sub.toJSON()}),
        })
        const result=await res.json()
        if(result.success){console.log('[push] ✅ subscription registrada en servidor')}
        else{console.warn('[push] error registrando subscription:',result)}
      }catch(e){console.error('[push] setup error:',e)}
    }

    // Intentar inmediatamente si ya hay permission
    setupPush()
    // Reintentar cuando el usuario otorgue permission (después del primer click)
    const retryTimer=setInterval(()=>{
      if(cancelled){clearInterval(retryTimer);return}
      if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
        setupPush()
        clearInterval(retryTimer)
      }
    },3000)

    // Escuchar mensajes del SW (click en notif → navegar al chat)
    const onSWMessage=(e)=>{
      if(e.data?.type==='NOTIFICATION_CLICK'&&e.data?.phone){
        setModule('mensajes')
        setWaNavPhone({phone:e.data.phone,name:''})
      }
      if(e.data?.type==='PUSH_SUBSCRIPTION_CHANGED'){
        console.log('[push] subscription cambió, re-suscribiendo...')
        setupPush()
      }
    }
    navigator.serviceWorker.addEventListener('message',onSWMessage)

    return()=>{
      cancelled=true
      clearInterval(retryTimer)
      navigator.serviceWorker.removeEventListener('message',onSWMessage)
    }
  },[user?.id])

  // ── WA Assignments: load + realtime for notification filtering ────────────
  useEffect(()=>{
    if(!user)return
    ;(async()=>{
      const{data}=await supabase.from('whatsapp_assignments').select('client_phone,assigned_to')
      setWaAssignments(data||[])
    })()
    const ch=supabase.channel('wa-assign-sync')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'whatsapp_assignments'},payload=>{
        const{client_phone,assigned_to}=payload.new
        setWaAssignments(prev=>[...prev.filter(a=>a.client_phone!==client_phone),{client_phone,assigned_to}])
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'whatsapp_assignments'},payload=>{
        const{client_phone,assigned_to}=payload.new
        setWaAssignments(prev=>prev.map(a=>a.client_phone===client_phone?{client_phone,assigned_to}:a))
      })
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[user?.id])

  // ── PWA install prompt ────────────────────────────────────────────────────
  useEffect(()=>{
    const handler=e=>{e.preventDefault();setInstallPrompt(e)}
    window.addEventListener('beforeinstallprompt',handler)
    return()=>window.removeEventListener('beforeinstallprompt',handler)
  },[])

  // ── Task badge count ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(!user)return
    ;(async()=>{
      try{
        const{data}=await supabase.from('crm_tasks').select('id,status,done')
        setTaskBadge((data||[]).filter(t=>!t.done&&t.status!=='completada'&&t.status!=='cancelada').length)
      }catch{}
    })()
  },[user])

  // Public route: /chat/:referralCode — render without CRM shell
  if(window.location.pathname.startsWith('/chat/'))return<WAFinanceChat/>

  // Public routes: /soporte — portal de tickets de soporte (sin CRM shell)
  // Orden importa: /soporte/ticket/:n debe evaluarse antes que el genérico /soporte*
  if(window.location.pathname.startsWith('/soporte/ticket/'))return<SupportTicketView/>
  if(window.location.pathname==='/soporte'||window.location.pathname.startsWith('/soporte/'))return<SupportPortal/>

  // Sala de documentos de una reunión. Pública a propósito: el invitado no
  // tiene cuenta. El control de acceso es el OTP contra la lista de invitados.
  if(window.location.pathname.startsWith('/documento/'))return<DocumentoSala/>

  if(checking)return<div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,border:`3px solid ${P.border}`,borderTop:`3px solid ${P.purple}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>
  if(showPasswordReset)return<PasswordReset onDone={()=>{setShowPasswordReset(false);supabase.auth.signOut();window.location.href='/'}}/>
  if(noStaffError)return<NoStaffScreen onBackToLogin={()=>{setNoStaffError(false)}}/>
  if(!user)return<Login onLogin={setUser}/>

  // Logout robusto: funciona aunque supabase.auth.signOut() falle (token expirado)
  // PWA escritorio: desregistrar SW + hard reload (replace + backup con reload)
  const logout=async()=>{
    console.log('[logout] iniciando...')
    // 1. Limpiar storage PRIMERO (siempre funciona, incluso sin red)
    try{localStorage.clear();sessionStorage.clear()}catch{}
    // 2. Desregistrar service workers (fuerza estado fresh próxima carga)
    if('serviceWorker' in navigator){
      try{
        const regs=await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r=>r.unregister().catch(()=>{})))
      }catch{}
    }
    // 3. Limpiar caches del SW
    if('caches' in window){
      try{
        const keys=await caches.keys()
        await Promise.all(keys.map(k=>caches.delete(k).catch(()=>{})))
      }catch{}
    }
    // 4. SignOut con scope:local (NO requiere red, funciona con token expirado)
    try{
      await Promise.race([
        supabase.auth.signOut({scope:'local'}).catch(()=>{}),
        new Promise(resolve=>setTimeout(resolve,1500)),
      ])
    }catch{}
    // 5. Redirect limpio + backup reload por si replace falla en PWA standalone
    try{window.location.replace('/')}catch{window.location.href='/'}
    setTimeout(()=>{try{window.location.reload()}catch{}},300)
  }

  // ── Modules ───────────────────────────────────────────────────────────────
  // campMods removed — lazy rendering via renderModule()

  const validMods=isBroker?['broker']:[
    'dashboard',
    'soporte',
    ...(canAccess('contacts') ?['contacts']:[]),
    ...(canAccess('pipeline') ?['pipeline']:[]),
    ...(canAccess('tasks')    ?['tasks']:[]),
    ...(canAccess('emails')   ?['emails']:[]),
    ...(canAccess('reports')  ?['reports']:[]),
    ...(canAccess('equipo')   ?['equipo']:[]),
    ...(canAccess('campaigns')?['campaigns']:[]),
    // Las salas de documentos las arma cualquier miembro del staff: quien
    // convoca la reunión es quien reparte el material.
    'documentos',
    ...(isSuperAdmin          ?['webcontent']:[]),
    ...((isSuperAdmin||staffProfile?.role==='admin')?['education']:[]),
    ...(canAccess('mensajes') ?['mensajes']:[]),
    ...(canAccess('mensajes') ?['wafinance']:[]),
  ]

  // NAV filtrado por herramientas habilitadas (canAccess) — broker ve panel propio
  const NAV=isBroker?[]:[
    {id:'dashboard',label:'Dashboard',icon:'⊞'},
    {id:'soporte',label:'Soporte',icon:'🎫',color:P.blue},
    canAccess('contacts') ?{id:'contacts', label:'Contactos', icon:'📋'}:null,
    canAccess('pipeline') ?{id:'pipeline', label:'Pipeline',  icon:'◈'}:null,
    canAccess('campaigns')?{id:'campaigns',label:'Campañas',  icon:'🚀', color:P.green}:null,
    canAccess('tasks')    ?{id:'tasks',    label:'Tareas',    icon:'✓'}:null,
    canAccess('emails')   ?{id:'emails',   label:'Emails',    icon:'✉'}:null,
    canAccess('reports')  ?{id:'reports',  label:'Reportes',  icon:'▦'}:null,
    canAccess('equipo')   ?{id:'equipo',   label:'Equipo',    icon:'👥'}:null,
    {id:'documentos',label:'Documentos',icon:'📁',color:P.orange},
    ...(isSuperAdmin?[{id:'webcontent',label:'Contenido Web',icon:'🌐',color:P.blue}]:[]),
    ...((isSuperAdmin||staffProfile?.role==='admin')?[{id:'education',label:'Educación',icon:'🎓',color:P.green}]:[]),
    canAccess('mensajes')?{id:'mensajes',label:'Mensajes WA',icon:'💬',color:P.green}:null,
    canAccess('mensajes')?{id:'wafinance',label:'WAFinance',icon:'💹',color:'#f0a500'}:null,
  ].filter(Boolean)

  const currentMod=validMods.includes(module)?module:'dashboard'

  const dismissPWA=()=>{localStorage.setItem('pwa-dismissed','1');setPwaDismissed(true)}
  const triggerInstall=()=>{if(!installPrompt)return;installPrompt.prompt();installPrompt.userChoice.then(()=>{setInstallPrompt(null)});dismissPWA()}

  // Sidebar effective width
  const sidebarW=isMobile?260:isTablet?(tabletExpanded?218:60):218
  const showLabels=isMobile||(!isTablet)||tabletExpanded

  return <>{installPrompt&&!pwaDismissed&&(
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 18px',background:'#0d1117',borderBottom:'1px solid rgba(62,207,199,0.2)',color:'#e0e0e0',fontSize:13,flexWrap:'wrap'}}>
      <span style={{flex:1,minWidth:200}}>📱 Instala Pessaro CRM en tu dispositivo para acceso rápido</span>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button onClick={triggerInstall} style={{padding:'6px 16px',borderRadius:8,background:'rgba(62,207,199,0.15)',border:'1px solid rgba(62,207,199,0.4)',color:'#3ECFC7',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit'}}>Instalar</button>
        <button onClick={dismissPWA} style={{padding:'4px 8px',borderRadius:6,background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'#a4b0be',cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>✕</button>
      </div>
    </div>
  )}
  <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',background:P.bg}}>
    {/* Mobile top bar */}
    {isMobile&&<div style={{height:48,background:P.sidebar,borderBottom:`1px solid ${P.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 8px',position:'sticky',top:0,zIndex:100,flexShrink:0}}>
      <button onClick={()=>setMenuOpen(true)} style={{background:'none',border:'none',color:P.text,fontSize:20,cursor:'pointer',minWidth:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8}}>☰</button>
      <span style={{fontSize:14,fontWeight:800,color:P.text,letterSpacing:'-0.01em'}}>Pessaro CRM</span>
      <button onClick={()=>{setModule('mensajes');setWaUnread(0)}} style={{background:'none',border:'none',color:waUnread>0?P.red:P.muted,fontSize:18,cursor:'pointer',minWidth:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,position:'relative'}}>
        🔔{waUnread>0&&<span style={{position:'absolute',top:6,right:6,background:P.red,color:'#fff',borderRadius:10,fontSize:9,fontWeight:700,padding:'1px 5px',lineHeight:'14px'}}>{waUnread>99?'99+':waUnread}</span>}
      </button>
    </div>}
    <div style={{display:'flex',flex:1,minHeight:0,overflow:'hidden'}}>
      {/* Backdrop (mobile only) */}
      {isMobile&&menuOpen&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:999}} onClick={()=>setMenuOpen(false)}/>}
      {/* Sidebar */}
      <div
        style={{
          width:sidebarW,
          background:P.sidebar,
          borderRight:`1px solid ${P.border}`,
          display:'flex',
          flexDirection:'column',
          flexShrink:0,
          position:isMobile?'fixed':'sticky',
          top:0,
          left:isMobile?(menuOpen?0:-260):0,
          height:'100vh',
          zIndex:isMobile?1000:'auto',
          transition:'left 0.25s ease, width 0.2s ease',
          overflow:'hidden',
        }}
        onMouseEnter={()=>isTablet&&setTabletExpanded(true)}
        onMouseLeave={()=>isTablet&&setTabletExpanded(false)}
      >
        {/* Logo */}
        <div style={{padding:isTablet&&!tabletExpanded?'22px 0':'22px 18px',borderBottom:`1px solid ${P.border}`,display:'flex',alignItems:'center',justifyContent:isTablet&&!tabletExpanded?'center':'flex-start',gap:12,flexShrink:0}}>
          <img src={LOGO_URI} width={32} height={32} style={{borderRadius:6,objectFit:'cover',display:'block',flexShrink:0}} alt="Pessaro"/>
          {showLabels&&<div><div style={{fontSize:14,fontWeight:800,color:P.text,letterSpacing:'-0.01em',whiteSpace:'nowrap'}}>Pessaro</div><div style={{fontSize:10,color:P.purple,letterSpacing:'0.10em',textTransform:'uppercase',fontWeight:600,whiteSpace:'nowrap'}}>Capital CRM</div></div>}
        </div>
        {/* Nav */}
        <nav style={{padding:'10px 8px',flex:1,overflowY:'auto'}}>
          {NAV.map(item=>{
            const active=currentMod===item.id
            const ic=item.color||P.purple
            const showBadge=item.id==='mensajes'&&waUnread>0
            const showTaskBadge=item.id==='tasks'&&taskBadge>0
            return <button key={item.id} onClick={()=>{setModule(item.id);if(item.id==='mensajes')setWaUnread(0);if(item.id==='tasks')setTaskBadge(0);if(isMobile)setMenuOpen(false)}}
              style={{width:'100%',display:'flex',alignItems:'center',justifyContent:showLabels?'flex-start':'center',gap:showLabels?9:0,padding:showLabels?'9px 12px':'11px 0',borderRadius:8,marginBottom:2,cursor:'pointer',textAlign:'left',minHeight:44,position:'relative',
                background:active?ic+'22':'transparent',color:active?ic:P.muted,
                border:active?`1px solid ${ic}35`:'1px solid transparent',
                fontSize:13,fontWeight:active?600:400,transition:'all 0.12s'}}>
              <span style={{fontSize:15,width:18,textAlign:'center',opacity:active?1:0.7,flexShrink:0}}>{item.icon}</span>
              {showLabels&&<span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</span>}
              {showBadge&&showLabels&&<span style={{background:P.red,color:'#fff',borderRadius:10,fontSize:9,fontWeight:700,padding:'1px 6px',minWidth:16,textAlign:'center',lineHeight:'14px',flexShrink:0}}>{waUnread>99?'99+':waUnread}</span>}
              {showBadge&&!showLabels&&<span style={{position:'absolute',top:4,right:4,background:P.red,color:'#fff',borderRadius:'50%',width:8,height:8}}/>}
              {showTaskBadge&&showLabels&&<span style={{background:P.orange,color:'#fff',borderRadius:10,fontSize:9,fontWeight:700,padding:'1px 6px',minWidth:16,textAlign:'center',lineHeight:'14px',flexShrink:0}}>{taskBadge>99?'99+':taskBadge}</span>}
              {showTaskBadge&&!showLabels&&<span style={{position:'absolute',top:4,right:4,background:P.orange,color:'#fff',borderRadius:'50%',width:8,height:8}}/>}
              {active&&!showBadge&&!showTaskBadge&&showLabels&&<div style={{width:5,height:5,borderRadius:'50%',background:ic,flexShrink:0}}/>}
            </button>
          })}
        </nav>
        {/* Supabase status */}
        {showLabels&&<div style={{padding:'8px 12px',borderBottom:`1px solid ${P.border}`,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:7}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:P.green,flexShrink:0}}/>
            <span style={{fontSize:10,color:P.green,fontWeight:600,letterSpacing:'0.04em'}}>Supabase conectado</span>
          </div>
        </div>}
        {!showLabels&&<div style={{padding:'8px 0',display:'flex',justifyContent:'center',borderBottom:`1px solid ${P.border}`,flexShrink:0}}><div style={{width:6,height:6,borderRadius:'50%',background:P.green}}/></div>}
        {/* User card */}
        <div style={{padding:showLabels?'12px 14px':'10px 0',flexShrink:0,display:'flex',flexDirection:'column',gap:showLabels?0:8,alignItems:showLabels?'stretch':'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:showLabels?10:0,justifyContent:showLabels?'flex-start':'center'}}>
            <div style={{
              width:38,height:38,borderRadius:10,flexShrink:0,
              background:isSuperAdmin?P.orangeDim:isBroker?P.blueDim:P.purpleDim,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:15,fontWeight:800,
              color:isSuperAdmin?P.orange:isBroker?P.blue:P.purple,
              border:`1.5px solid ${isSuperAdmin?P.orange:isBroker?P.blue:P.purple}30`
            }}>
              {(staffProfile?.display_name||user?.email||'?')[0].toUpperCase()}
            </div>
            {showLabels&&<div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:P.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {staffProfile?.display_name||user?.email?.split('@')[0]||'Usuario'}
              </div>
              <div style={{fontSize:10,color:P.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:1}}>
                {staffProfile?.title||'Pessaro Capital'}
              </div>
            </div>}
          </div>
          {showLabels&&staffProfile?.pessaro_email&&<div style={{
            display:'flex',alignItems:'center',gap:6,padding:'5px 8px',marginBottom:8,
            background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:6}}>
            <span style={{fontSize:10}}>✉</span>
            <span style={{fontSize:10,color:P.blue,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {staffProfile.pessaro_email}
            </span>
          </div>}
          {showLabels&&<div style={{marginBottom:10}}>
            {isSuperAdmin&&<div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:P.orangeDim,border:`1px solid ${P.orange}30`,borderRadius:5}}>
              <span style={{fontSize:9}}>⚙</span><span style={{fontSize:10,color:P.orange,fontWeight:700,letterSpacing:'0.04em'}}>Super Admin</span>
            </div>}
            {isBroker&&!isSuperAdmin&&<div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:P.blueDim,border:`1px solid ${P.blue}30`,borderRadius:5}}>
              <span style={{fontSize:9}}>⬡</span><span style={{fontSize:10,color:P.blue,fontWeight:700,letterSpacing:'0.04em'}}>Administrador</span>
            </div>}
            {!isSuperAdmin&&!isBroker&&<div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:5}}>
              <span style={{fontSize:9}}>◈</span><span style={{fontSize:10,color:P.purple,fontWeight:700,letterSpacing:'0.04em'}}>Asesor</span>
            </div>}
          </div>}
          {showLabels&&<button onClick={logout} style={{width:'100%',padding:'6px 0',fontSize:11,color:P.muted,background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:6,cursor:'pointer',transition:'all 0.12s',minHeight:44}}
            onMouseEnter={e=>{e.currentTarget.style.color=P.red;e.currentTarget.style.borderColor=P.red+'40'}}
            onMouseLeave={e=>{e.currentTarget.style.color=P.muted;e.currentTarget.style.borderColor=P.border}}>
            Cerrar sesión →
          </button>}
          {!showLabels&&<button onClick={logout} title="Cerrar sesión" style={{width:38,height:38,borderRadius:8,background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,color:P.muted,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>⇒</button>}
        </div>
      </div>
      {/* Main content */}
      <div style={{flex:1,padding:isMobile?'16px':isTablet?'20px 24px':'28px 32px',overflowY:'auto',minHeight:0}}>
        <ErrorBoundary key={currentMod}>{(()=>{
          // ── Filtro definitivo de leads por rol (imposible de evadir) ──
          const myLeads=(()=>{
            if(isSuperAdmin)return leads
            const ep=(user?.email||'').split('@')[0].toLowerCase()
            const rc=staffProfile?.referral_code||''
            return leads.filter(l=>
              (l.advisor_assigned&&l.advisor_assigned.toLowerCase().includes(ep))
              ||(rc&&l.advisor_referral_code&&l.advisor_referral_code===rc)
            )
          })()
          if(loading&&currentMod==='dashboard') return <Spinner/>
          if(isBroker) return <BrokerView user={user} campaigns={campaigns} leads={myLeads} isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='dashboard') return <Dashboard contacts={contacts} leads={myLeads} onNav={setModule} isSuperAdmin={isSuperAdmin} user={user} staffProfile={staffProfile}/>
          if(currentMod==='contacts')  return <ContactsHub user={user} isSuperAdmin={isSuperAdmin} staffProfile={staffProfile} Contacts={Contacts}/>
          if(currentMod==='pipeline')  return <Pipeline leads={myLeads} setLeads={setLeads} isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='tasks')     return <Tasks contacts={contacts} leads={myLeads} user={user} isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='emails')    return <Emails contacts={contacts} leads={myLeads} staffProfile={staffProfile} user={user} isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='reports')   return <Reports contacts={contacts} leads={myLeads} isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='equipo')    return <Equipo user={user} isSuperAdmin={isSuperAdmin} teamId={teamId}/>
          if(currentMod==='campaigns') return <CampaignsHub campaigns={campaigns} setCampaigns={setCampaigns} user={user} isSuperAdmin={isSuperAdmin} staffProfile={staffProfile} globalLeads={myLeads} setGlobalLeads={setLeads}/>
          if(currentMod==='documentos') return <DocumentosHub user={user} isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='webcontent'&&isSuperAdmin) return <WebContentHub isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='education'&&(isSuperAdmin||staffProfile?.role==='admin')) return <EducationAdmin user={user} isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='mensajes') return <WhatsAppMessages user={user} staffProfile={staffProfile} isSuperAdmin={isSuperAdmin} waAssignments={waAssignments} setWaAssignments={setWaAssignments} navPhone={waNavPhone} onNavConsumed={()=>setWaNavPhone(null)} onPhoneChange={setWaViewingPhone}/>
          if(currentMod==='wafinance') return <WAFinanceChatInbox user={user} staffProfile={staffProfile} isSuperAdmin={isSuperAdmin}/>
          if(currentMod==='soporte') return <SupportInbox user={user} staffProfile={staffProfile} isSuperAdmin={isSuperAdmin}/>
          return <Dashboard contacts={contacts} leads={myLeads} onNav={setModule}/>
        })()}</ErrorBoundary>
      </div>
    </div>
    {waToasts.length>0&&<div style={{position:'fixed',bottom:20,right:20,display:'flex',flexDirection:'column',gap:10,zIndex:9999}}>
      {waToasts.map(t=><WaToast key={t.id} toast={t}
        onClose={()=>setWaToasts(p=>p.filter(x=>x.id!==t.id))}
        onView={()=>{setModule('mensajes');setWaUnread(0);setWaNavPhone({phone:t.phone,name:t.name});setWaToasts(p=>p.filter(x=>x.id!==t.id))}}
      />)}
    </div>}
    <NotifPermBanner onGranted={()=>console.log('[notif-banner] permission granted, push subscribe se activará automáticamente')}/>
  </div>
  </>
}
