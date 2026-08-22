// ─── CONTACTOS · Clientes Portal + KYC (solo super_admin) ────────────────────
// Lote 4 unificación CMS→CRM. Tablas: client_profiles_2026_02_08_22_02,
// client_kyc_documents_2026_03_16 · Bucket privado: kyc-documents (signed URLs 60s)
// Export default: ContactsHub — wrapper que agrega el toggle "CRM | Clientes Portal"
// sin modificar los hooks del componente Contacts original (recibe Contacts por prop).
//
// 2026-08-22: esta vista dejó de tener su propio modal de detalle. Al pulsar
// un cliente se resuelve (o se crea) el crm_contacts correspondiente y se abre
// la MISMA ficha completa de "Contactos" — con una sección de Verificación KYC
// agregada ahí, exclusiva de super_admin. Ver App.jsx: Contacts (openContactId/
// onFichaAbierta) y la FSection "Verificación KYC" dentro de su ficha.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { P, GlassCard, Btn, Badge, Spinner, fmtDate } from '../webcontent/ui.jsx'

const T_PROFILES='client_profiles_2026_02_08_22_02'
const STATUS_META={active:{label:'Activa',color:P.green},pending:{label:'Pendiente',color:P.orange},suspended:{label:'Suspendida',color:P.red},inactive:{label:'Inactiva',color:P.muted},lead_educacion:{label:'Lead Academia',color:P.blue}}
const VIA_LABELS={waba:'WhatsApp',web:'Web',web_registration:'Web',web_registration_otp:'Web (OTP)',risk_profile:'Perfil de riesgo',risk_profile_registration:'Perfil de riesgo'}

// Mismo patrón de filtro de fecha que Contactos (App.jsx: RANGOS_FECHA_PERSONALIZABLE
// / desdeRango / mismoDia) — duplicado acá porque son archivos separados, no un
// módulo compartido.
const RANGOS_FECHA=[
  {value:'todos',label:'Cualquier fecha'},
  {value:'hoy',label:'Creados hoy'},
  {value:'7d',label:'Últimos 7 días'},
  {value:'30d',label:'Últimos 30 días'},
  {value:'personalizado',label:'📅 Fecha personalizada'},
]
const desdeRango=rango=>{
  if(!rango||rango==='todos'||rango==='personalizado')return null
  const d=new Date();d.setHours(0,0,0,0)
  if(rango==='7d')d.setDate(d.getDate()-6)
  if(rango==='30d')d.setDate(d.getDate()-29)
  return d
}
const mismoDia=(creadoISO,ymd)=>{
  if(!creadoISO||!ymd)return false
  const c=new Date(creadoISO)
  const[y,m,d]=ymd.split('-').map(Number)
  return c.getFullYear()===y&&c.getMonth()===m-1&&c.getDate()===d
}
const soloDigitos=s=>String(s||'').replace(/\D/g,'')

function ClientsPortalKYC({user,onVerFicha}){
  const[clients,setClients]=useState([])
  const[loading,setLoading]=useState(true)
  const[search,setSearch]=useState('')
  const[viaFilter,setViaFilter]=useState('todos')
  const[dateFilter,setDateFilter]=useState('todos')
  const[dateFilterCustom,setDateFilterCustom]=useState('')
  const[resolvingId,setResolvingId]=useState(null)
  const[error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data,error}=await supabase.from(T_PROFILES).select('*').order('created_at',{ascending:false})
      if(error)throw error
      setClients(data||[])
    }catch(e){console.error(e)}finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  // Resuelve el crm_contacts de este cliente del portal (por email, con
  // teléfono como respaldo — mismo criterio que correoDelCrm en waba_bot.ts) y
  // pide a ContactsHub que abra su ficha. Si no existe todavía como contacto
  // CRM (p.ej. se registró por la web y nunca entró al embudo de WhatsApp/
  // campañas), se crea uno — mismo patrón que sincronizarContactoCRM, pero
  // disparado por una acción explícita de un super_admin, no en segundo plano.
  const abrirFicha=async c=>{
    setError('');setResolvingId(c.id)
    try{
      const tel=soloDigitos(c.phone)
      let found=null
      if(c.email){
        const{data}=await supabase.from('crm_contacts').select('id').eq('email',c.email).limit(1).maybeSingle()
        found=data
      }
      if(!found&&tel){
        const{data}=await supabase.from('crm_contacts').select('id').in('phone',[tel,`+${tel}`]).limit(1).maybeSingle()
        found=data
      }
      if(!found){
        // source tiene CHECK (manual/csv/formulario) — verificado en vivo
        // (crm_contacts_source_check). 'manual' es correcto acá: lo crea la
        // acción explícita de un super_admin, no un import ni un formulario.
        const{data:creado,error:errCrear}=await supabase.from('crm_contacts').insert({
          user_id:user.id,
          full_name:`${c.first_name||''} ${c.last_name||''}`.trim()||c.email||tel||'Sin nombre',
          email:c.email||null,
          phone:tel||null,
          source:'manual',
        }).select('id').single()
        if(errCrear)throw errCrear
        found=creado
      }
      onVerFicha(found.id)
    }catch(e){console.error('abrirFicha:',e);setError('No se pudo abrir la ficha de este cliente')}
    finally{setResolvingId(null)}
  }

  // Vías presentes en los datos reales, no una lista fija: si mañana aparece un
  // created_via nuevo, el filtro lo muestra igual (con su valor crudo como label).
  const viasPresentes=[...new Set(clients.map(c=>c.created_via).filter(Boolean))]

  const desdeFecha=desdeRango(dateFilter)
  const coincideFecha=c=>dateFilter==='todos'?true
    :dateFilter==='personalizado'?(!dateFilterCustom||mismoDia(c.created_at,dateFilterCustom))
    :(!desdeFecha||(c.created_at&&new Date(c.created_at)>=desdeFecha))

  const q=search.toLowerCase()
  const porVia=viaFilter==='todos'?clients:clients.filter(c=>c.created_via===viaFilter)
  const porFecha=porVia.filter(coincideFecha)
  const filtered=q?porFecha.filter(c=>
    `${c.first_name||''} ${c.last_name||''}`.toLowerCase().includes(q)||
    (c.email||'').toLowerCase().includes(q)||(c.document_number||'').includes(q)):porFecha
  const fullName=c=>`${c.first_name||''} ${c.last_name||''}`.trim()||c.email

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
      <p style={{fontSize:12,color:P.muted,margin:0}}>{filtered.length} de {clients.length} clientes del portal · perfiles de registro + verificación KYC</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {viasPresentes.length>0&&<select value={viaFilter} onChange={e=>setViaFilter(e.target.value)}
          style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:13,outline:'none',fontFamily:'inherit'}}>
          <option value="todos">Todas las vías</option>
          {viasPresentes.map(v=><option key={v} value={v}>{VIA_LABELS[v]||v}</option>)}
        </select>}
        <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
          style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:13,outline:'none',fontFamily:'inherit'}}>
          {RANGOS_FECHA.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {dateFilter==='personalizado'&&<input type="date" value={dateFilterCustom} onChange={e=>setDateFilterCustom(e.target.value)}
          max={new Date().toISOString().slice(0,10)}
          style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 10px',color:P.text,fontSize:13,outline:'none',fontFamily:'inherit'}}/>}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, email o documento..."
          style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:13,outline:'none',width:280,fontFamily:'inherit'}}/>
      </div>
    </div>

    {error&&<GlassCard style={{marginBottom:14}}><p style={{color:P.red,fontSize:13,margin:0}}>⚠ {error}</p></GlassCard>}

    {loading?<Spinner/>:
      filtered.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>Sin clientes.</p></GlassCard>:
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtered.map(c=><GlassCard key={c.id} onClick={()=>resolvingId?null:abrirFicha(c)} style={{display:'flex',gap:12,alignItems:'center',cursor:resolvingId?'default':'pointer',opacity:resolvingId===c.id?0.6:1}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:P.purpleDim,color:P.purple,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>
            {(c.first_name?.[0]||c.email?.[0]||'?').toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <p style={{fontSize:14,fontWeight:600,color:P.text,margin:0}}>{fullName(c)}</p>
              {c.account_status&&<Badge label={(STATUS_META[c.account_status]||{label:c.account_status}).label} color={(STATUS_META[c.account_status]||{color:P.muted}).color}/>}
              {c.account_type&&<span style={{fontSize:11,color:P.blue}}>{c.account_type}</span>}
              {c.created_via&&<span style={{fontSize:11,color:P.muted}}>· {VIA_LABELS[c.created_via]||c.created_via}</span>}
            </div>
            <p style={{fontSize:11,color:P.muted,margin:'2px 0 0'}}>{c.email}{c.phone?` · ${c.phone}`:''}{c.country?` · ${c.country}`:''} · Registro {fmtDate(c.created_at)}</p>
          </div>
          <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12,flexShrink:0}} disabled={resolvingId===c.id}>
            {resolvingId===c.id?'Abriendo…':'Ver ficha completa →'}
          </Btn>
        </GlassCard>)}
      </div>}
  </div>
}

// ── Wrapper: toggle "Contactos CRM | Clientes Portal" (hook-safe) ────────────
export default function ContactsHub({user,isSuperAdmin,staffProfile,Contacts}){
  const[view,setView]=useState('crm')
  const[openContactId,setOpenContactId]=useState(null)
  const Tab=({id,label})=>(
    <button onClick={()=>setView(id)} style={{padding:'6px 16px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:view===id?700:400,background:view===id?P.purpleDim:'rgba(255,255,255,0.04)',color:view===id?P.purple:P.muted,border:`1px solid ${view===id?'rgba(108,92,231,0.4)':P.border}`}}>{label}</button>
  )
  const verFicha=id=>{setView('crm');setOpenContactId(id)}
  return <div>
    {isSuperAdmin&&<div style={{display:'flex',gap:8,marginBottom:16}}>
      <Tab id="crm" label="📋 Contactos CRM"/>
      <Tab id="portal" label="🔐 Clientes Portal (KYC)"/>
    </div>}
    {view==='portal'&&isSuperAdmin?
      <ClientsPortalKYC user={user} onVerFicha={verFicha}/>:
      <Contacts user={user} isSuperAdmin={isSuperAdmin} staffProfile={staffProfile}
        openContactId={openContactId} onFichaAbierta={()=>setOpenContactId(null)}/>}
  </div>
}
