export const P = {
  bg:'#0d0f17', surface:'#13151f', sidebar:'#0a0c16',
  card:'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border:'rgba(255,255,255,0.07)', text:'#f1f2f6', textSub:'#a4b0be', muted:'#636e72',
  purple:'#6c5ce7', purpleLight:'#a29bfe', purpleDim:'rgba(108,92,231,0.15)', purpleBorder:'rgba(108,92,231,0.3)',
  blue:'#0984e3', blueDim:'rgba(9,132,227,0.15)',
  green:'#00d084', greenDim:'rgba(0,208,132,0.12)',
  red:'#ff4757', redDim:'rgba(255,71,87,0.12)',
  orange:'#ffa502', orangeDim:'rgba(255,165,2,0.10)',
}

export const STAGES      = ['lead','contactado','propuesta','negociacion','cerrado']
export const STAGE_LABEL = { lead:'Lead', contactado:'Contactado', propuesta:'Propuesta', negociacion:'Negociación', cerrado:'Cerrado' }
export const STAGE_COLOR = { lead:P.muted, contactado:P.blue, propuesta:P.orange, negociacion:P.purple, cerrado:P.green }
export const ETAPA_STAGE = { 1:'lead', 2:'contactado', 3:'propuesta', 4:'negociacion', 5:'cerrado' }
export const STAGE_ETAPA = { lead:1, contactado:2, propuesta:3, negociacion:4, cerrado:5 }
export const STATUS_COLOR = { new:P.orange, read:P.blue, replied:P.green, archived:P.muted }
export const STATUS_OPT   = [{value:'activo',label:'Activo'},{value:'prospecto',label:'Prospecto'},{value:'cliente',label:'Cliente'},{value:'inactivo',label:'Inactivo'}]
export const SCOLOR_MAP   = { activo:P.green, prospecto:P.orange, cliente:P.purple, inactivo:P.muted }
export const PRIO_COLOR   = { alta:P.red, media:P.orange, baja:P.green }

export const TEMPLATES = [
  {id:'bienvenida_lead',     label:'Bienvenida lead',       color:P.purple, desc:'Primer contacto tras registro'},
  {id:'seguimiento_lead',    label:'Seguimiento',           color:P.blue,   desc:'Follow-up personalizable'},
  {id:'invitacion_radex',    label:'Invitación Radex',      color:'#e74c3c',desc:'Apertura cuenta Radex'},
  {id:'invitacion_tradeview',label:'Invitación Tradeview',  color:'#3498db',desc:'Apertura cuenta Tradeview'},
  {id:'deposito_confirmado', label:'Depósito confirmado',   color:P.green,  desc:'Confirmación con acceso al portal'},
  {id:'informe_trimestral',  label:'Informe trimestral',    color:'#f0a500',desc:'Resultados Q1 2026 con métricas'},
  {id:'personalizado',       label:'Personalizado',         color:P.muted,  desc:'Asunto y cuerpo libres'},
]

export const fmt     = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0)
export const fmtDate = d => d ? new Date(d).toLocaleDateString('es-CL') : '—'
export const uid     = () => Math.random().toString(36).slice(2,9)
export const TT      = {contentStyle:{background:P.surface,border:`1px solid ${P.border}`,borderRadius:8,color:P.text,fontSize:12}}
