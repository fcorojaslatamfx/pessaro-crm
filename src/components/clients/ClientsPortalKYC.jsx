// ─── CONTACTOS · Clientes Portal + KYC (solo super_admin) ────────────────────
// Lote 4 unificación CMS→CRM. Tablas: client_profiles_2026_02_08_22_02,
// client_kyc_documents_2026_03_16 · Bucket privado: kyc-documents (signed URLs 60s)
// Export default: ContactsHub — wrapper que agrega el toggle "CRM | Clientes Portal"
// sin modificar los hooks del componente Contacts original (recibe Contacts por prop).
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { P, GlassCard, Btn, Badge, Lbl, Spinner, Modal, fmtDate, fmtSize } from '../webcontent/ui.jsx'

const T_PROFILES='client_profiles_2026_02_08_22_02'
const T_KYC='client_kyc_documents_2026_03_16'
const KYC_BUCKET='kyc-documents'
const STATUS_META={active:{label:'Activa',color:P.green},pending:{label:'Pendiente',color:P.orange},suspended:{label:'Suspendida',color:P.red},inactive:{label:'Inactiva',color:P.muted}}
const DOC_META={pending:{label:'Pendiente',color:P.orange},approved:{label:'Aprobado',color:P.green},rejected:{label:'Rechazado',color:P.red}}

function ClientsPortalKYC({user}){
  const[clients,setClients]=useState([])
  const[loading,setLoading]=useState(true)
  const[search,setSearch]=useState('')
  const[selected,setSelected]=useState(null)
  const[docs,setDocs]=useState([])
  const[docsLoading,setDocsLoading]=useState(false)
  const[actingId,setActingId]=useState(null)
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

  const openClient=async c=>{
    setSelected(c);setDocs([]);setError('');setDocsLoading(true)
    try{
      const{data,error}=await supabase.from(T_KYC).select('*').eq('user_id',c.user_id).order('created_at',{ascending:false})
      if(error)throw error
      setDocs(data||[])
    }catch(e){console.error(e)}finally{setDocsLoading(false)}
  }

  const viewDoc=async d=>{
    setError('')
    try{
      const{data,error}=await supabase.storage.from(KYC_BUCKET).createSignedUrl(d.file_path,60)
      if(error)throw error
      if(data?.signedUrl)window.open(data.signedUrl,'_blank')
    }catch(e){console.error(e);setError('No se pudo generar el enlace del documento')}
  }

  const reviewDoc=async(d,status)=>{
    let reason=null
    if(status==='rejected'){
      reason=window.prompt('Motivo de rechazo:')
      if(reason===null)return
    }
    setActingId(d.id);setError('')
    try{
      const{data,error}=await supabase.from(T_KYC).update({
        status,rejection_reason:reason||null,
        reviewed_by:user?.id||null,reviewed_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      }).eq('id',d.id).select().single()
      if(error)throw error
      setDocs(p=>p.map(x=>x.id===data.id?data:x))
    }catch(e){console.error(e);setError('No se pudo actualizar el documento')}
    finally{setActingId(null)}
  }

  const q=search.toLowerCase()
  const filtered=q?clients.filter(c=>
    `${c.first_name||''} ${c.last_name||''}`.toLowerCase().includes(q)||
    (c.email||'').toLowerCase().includes(q)||(c.document_number||'').includes(q)):clients
  const fullName=c=>`${c.first_name||''} ${c.last_name||''}`.trim()||c.email

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
      <p style={{fontSize:12,color:P.muted,margin:0}}>{clients.length} clientes del portal · perfiles de registro + verificación KYC</p>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, email o documento..."
        style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:13,outline:'none',width:280,fontFamily:'inherit'}}/>
    </div>
    {loading?<Spinner/>:
      filtered.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>Sin clientes.</p></GlassCard>:
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtered.map(c=><GlassCard key={c.id} onClick={()=>openClient(c)} style={{display:'flex',gap:12,alignItems:'center',cursor:'pointer'}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:P.purpleDim,color:P.purple,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>
            {(c.first_name?.[0]||c.email?.[0]||'?').toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <p style={{fontSize:14,fontWeight:600,color:P.text,margin:0}}>{fullName(c)}</p>
              {c.account_status&&<Badge label={(STATUS_META[c.account_status]||{label:c.account_status}).label} color={(STATUS_META[c.account_status]||{color:P.muted}).color}/>}
              {c.account_type&&<span style={{fontSize:11,color:P.blue}}>{c.account_type}</span>}
            </div>
            <p style={{fontSize:11,color:P.muted,margin:'2px 0 0'}}>{c.email}{c.phone?` · ${c.phone}`:''}{c.country?` · ${c.country}`:''} · Registro {fmtDate(c.created_at)}</p>
          </div>
          <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12,flexShrink:0}}>Ver + KYC →</Btn>
        </GlassCard>)}
      </div>}

    {selected&&<Modal title={fullName(selected)} onClose={()=>setSelected(null)} accent={P.purple} width={780}>
      <div style={{display:'flex',flexDirection:'column',gap:18}}>
        <div>
          <Lbl>Perfil</Lbl>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 20px',fontSize:12.5,color:P.textSub}}>
            <span>Email: <strong style={{color:P.text}}>{selected.email||'—'}</strong></span>
            <span>Teléfono: <strong style={{color:P.text}}>{selected.phone||'—'}</strong></span>
            <span>Documento: <strong style={{color:P.text}}>{selected.document_type||'—'} {selected.document_number||''}</strong></span>
            <span>Nacionalidad: <strong style={{color:P.text}}>{selected.nationality||'—'}</strong></span>
            <span>Dirección: <strong style={{color:P.text}}>{[selected.address,selected.city,selected.country].filter(Boolean).join(', ')||'—'}</strong></span>
            <span>Vía de registro: <strong style={{color:P.text}}>{selected.created_via||'—'}</strong></span>
            <span>Perfil de riesgo: <strong style={{color:P.text}}>{selected.risk_tolerance||'—'}</strong></span>
            <span>Experiencia: <strong style={{color:P.text}}>{selected.experience_level||'—'}</strong></span>
            <span>Capital: <strong style={{color:P.text}}>{selected.investment_capital||'—'}</strong></span>
            <span>Horizonte: <strong style={{color:P.text}}>{selected.investment_horizon||'—'}</strong></span>
          </div>
          {Array.isArray(selected.interested_instruments)&&selected.interested_instruments.length>0&&
            <p style={{fontSize:11,color:P.muted,margin:'8px 0 0'}}>Instrumentos: {selected.interested_instruments.join(', ')}</p>}
          {Array.isArray(selected.investment_goals)&&selected.investment_goals.length>0&&
            <p style={{fontSize:11,color:P.muted,margin:'2px 0 0'}}>Objetivos: {selected.investment_goals.join(', ')}</p>}
        </div>

        <div style={{borderTop:`1px solid ${P.border}`,paddingTop:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <Lbl>Documentos KYC</Lbl>
            {docs.length>0&&<span style={{fontSize:11,color:P.muted}}>
              {docs.filter(d=>d.status==='approved').length} aprobados · {docs.filter(d=>d.status==='pending').length} pendientes · {docs.filter(d=>d.status==='rejected').length} rechazados
            </span>}
          </div>
          {error&&<p style={{fontSize:12,color:P.red,margin:'0 0 8px'}}>{error}</p>}
          {docsLoading?<Spinner/>:
            docs.length===0?<p style={{fontSize:12,color:P.muted,margin:0}}>Este cliente no ha subido documentos.</p>:
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {docs.map(d=>{
                const m=DOC_META[d.status]||DOC_META.pending
                return <div key={d.id} style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:'10px 14px',display:'flex',gap:12,alignItems:'center'}}>
                  <span style={{fontSize:18}}>📄</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      <span style={{fontSize:12.5,fontWeight:600,color:P.text}}>{d.document_type||'Documento'}</span>
                      <Badge label={m.label} color={m.color}/>
                    </div>
                    <p style={{fontSize:10.5,color:P.muted,margin:'2px 0 0'}}>{d.file_name} · {fmtSize(d.file_size)} · Subido {fmtDate(d.created_at)}{d.reviewed_at?` · Revisado ${fmtDate(d.reviewed_at)}`:''}</p>
                    {d.status==='rejected'&&d.rejection_reason&&<p style={{fontSize:11,color:P.red,margin:'3px 0 0'}}>Motivo: {d.rejection_reason}</p>}
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <Btn variant="ghost" style={{padding:'4px 10px',fontSize:11}} onClick={()=>viewDoc(d)}>Ver ↗</Btn>
                    {d.status!=='approved'&&<Btn style={{padding:'4px 10px',fontSize:11,background:P.greenDim,color:P.green,border:'1px solid rgba(0,208,132,0.3)'}} onClick={()=>reviewDoc(d,'approved')} disabled={actingId===d.id}>✓ Aprobar</Btn>}
                    {d.status!=='rejected'&&<Btn variant="danger" style={{padding:'4px 10px',fontSize:11}} onClick={()=>reviewDoc(d,'rejected')} disabled={actingId===d.id}>✕ Rechazar</Btn>}
                  </div>
                </div>
              })}
            </div>}
        </div>
      </div>
    </Modal>}
  </div>
}

// ── Wrapper: toggle "Contactos CRM | Clientes Portal" (hook-safe) ────────────
export default function ContactsHub({user,isSuperAdmin,staffProfile,Contacts}){
  const[view,setView]=useState('crm')
  const Tab=({id,label})=>(
    <button onClick={()=>setView(id)} style={{padding:'6px 16px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:view===id?700:400,background:view===id?P.purpleDim:'rgba(255,255,255,0.04)',color:view===id?P.purple:P.muted,border:`1px solid ${view===id?'rgba(108,92,231,0.4)':P.border}`}}>{label}</button>
  )
  return <div>
    {isSuperAdmin&&<div style={{display:'flex',gap:8,marginBottom:16}}>
      <Tab id="crm" label="📋 Contactos CRM"/>
      <Tab id="portal" label="🔐 Clientes Portal (KYC)"/>
    </div>}
    {view==='portal'&&isSuperAdmin?
      <ClientsPortalKYC user={user}/>:
      <Contacts user={user} isSuperAdmin={isSuperAdmin} staffProfile={staffProfile}/>}
  </div>
}
