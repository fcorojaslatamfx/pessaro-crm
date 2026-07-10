// ─── EDUCACIÓN · Asignación y Aprobaciones (Lote 5, unificación CMS→CRM) ─────
// Reemplaza /cms/educacion/asignar y /cms/educacion/aprobaciones de pessaro_CL.
// Edge Functions (sin cambios): assign-course-to-client, approve-course-assignment.
// El backend resuelve crm_contacts.id → auth user internamente (resolve-client-account).
// Acceso: Asignar = admin + super_admin · Aprobaciones = solo super_admin.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { P, GlassCard, Btn, Badge, Lbl, TextArea, Sel, Spinner } from '../webcontent/ui.jsx'

const DIFF_COLOR={principiante:P.green,intermedio:P.orange,avanzado:P.red}

// ── Tab 1: Asignar curso ─────────────────────────────────────────────────────
function AssignCourse(){
  const[modules,setModules]=useState([])
  const[contacts,setContacts]=useState([])
  const[loading,setLoading]=useState(true)
  const[form,setForm]=useState({module_id:'',assigned_to_user_id:'',reason_note:''})
  const[submitting,setSubmitting]=useState(false)
  const[msg,setMsg]=useState(null) // {type:'ok'|'err', text}

  useEffect(()=>{
    (async()=>{
      try{
        const[mods,cts]=await Promise.all([
          supabase.from('education_modules').select('id,title').eq('is_active',true).order('order_index'),
          supabase.from('crm_contacts').select('id,full_name,email').order('full_name'),
        ])
        setModules(mods.data||[])
        setContacts(cts.data||[])
      }catch(e){console.error(e)}
      finally{setLoading(false)}
    })()
  },[])

  const submit=async()=>{
    setSubmitting(true);setMsg(null)
    try{
      const{error}=await supabase.functions.invoke('assign-course-to-client',{
        body:{assigned_to_user_id:form.assigned_to_user_id,module_id:form.module_id,reason_note:form.reason_note}
      })
      if(error)throw error
      setMsg({type:'ok',text:'Curso asignado correctamente. Queda pendiente de aprobación.'})
      setForm({module_id:'',assigned_to_user_id:'',reason_note:''})
      setTimeout(()=>setMsg(null),6000)
    }catch(e){
      console.error(e)
      setMsg({type:'err',text:e.message||'Error al asignar el curso'})
    }finally{setSubmitting(false)}
  }

  if(loading)return <Spinner/>
  return <GlassCard style={{maxWidth:640}}>
    <p style={{fontSize:15,fontWeight:700,color:P.text,margin:'0 0 16px'}}>Asignar curso a cliente</p>
    {msg&&<p style={{fontSize:12.5,color:msg.type==='ok'?P.green:P.red,background:msg.type==='ok'?P.greenDim:P.redDim,borderRadius:8,padding:'10px 14px',margin:'0 0 14px'}}>{msg.type==='ok'?'✓ ':'✕ '}{msg.text}</p>}
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div>
        <Lbl>Cliente *</Lbl>
        <Sel value={form.assigned_to_user_id} onChange={v=>setForm(f=>({...f,assigned_to_user_id:v}))}
          options={[{value:'',label:'Selecciona un cliente'},...contacts.map(c=>({value:c.id,label:`${c.full_name||'—'}${c.email?` (${c.email})`:''}`}))]}/>
        {contacts.length===0&&<p style={{fontSize:11,color:P.orange,margin:'6px 0 0'}}>No tienes contactos registrados.</p>}
      </div>
      <div>
        <Lbl>Curso *</Lbl>
        <Sel value={form.module_id} onChange={v=>setForm(f=>({...f,module_id:v}))}
          options={[{value:'',label:'Selecciona un curso'},...modules.map(m=>({value:m.id,label:m.title}))]}/>
      </div>
      <div>
        <Lbl>Motivo</Lbl>
        <TextArea value={form.reason_note} onChange={v=>setForm(f=>({...f,reason_note:v}))} rows={3} placeholder="Ej: Cliente interesado en aprender análisis técnico..."/>
      </div>
      <Btn onClick={submit} disabled={submitting||!form.module_id||!form.assigned_to_user_id}>
        {submitting?'Asignando…':'Asignar curso'}
      </Btn>
      <p style={{fontSize:11,color:P.muted,margin:0}}>La asignación queda <strong>pendiente</strong> hasta ser aprobada por el Super Admin en la pestaña Aprobaciones.</p>
    </div>
  </GlassCard>
}

// ── Tab 2: Cola de aprobaciones (solo super_admin) ───────────────────────────
function ApprovalQueue({user}){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[notes,setNotes]=useState({})       // id -> nota de aprobación/rechazo
  const[processing,setProcessing]=useState({}) // id -> 'approving'|'rejecting'
  const[error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data,error}=await supabase
        .from('education_course_assignments')
        .select(`id, status, assigned_at, reason_note, assigned_to_user_id,
          education_modules ( title, difficulty_level ),
          assigned_by:crm_staff_profiles!assigned_by_staff_id ( user_id, display_name )`)
        .eq('status','pending')
        .order('assigned_at',{ascending:false})
      if(error)throw error
      setItems(data||[])
    }catch(e){console.error(e)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  const approve=async id=>{
    setProcessing(p=>({...p,[id]:'approving'}));setError('')
    try{
      const{error}=await supabase.functions.invoke('approve-course-assignment',{
        body:{assignment_id:id,approval_reason:notes[id]??''}
      })
      if(error)throw error
      setItems(a=>a.filter(x=>x.id!==id))
    }catch(e){console.error(e);setError('Error al aprobar la asignación')}
    finally{setProcessing(p=>({...p,[id]:null}))}
  }
  const reject=async id=>{
    if(!window.confirm('¿Rechazar esta asignación?'))return
    setProcessing(p=>({...p,[id]:'rejecting'}));setError('')
    try{
      const{error}=await supabase.from('education_course_assignments')
        .update({status:'rejected',approval_reason:notes[id]??'Rechazado'}).eq('id',id)
      if(error)throw error
      setItems(a=>a.filter(x=>x.id!==id))
    }catch(e){console.error(e);setError('Error al rechazar')}
    finally{setProcessing(p=>({...p,[id]:null}))}
  }

  if(loading)return <Spinner/>
  return <div>
    <p style={{fontSize:12,color:P.muted,margin:'0 0 14px'}}>{items.length} asignaciones pendientes de aprobación</p>
    {error&&<p style={{fontSize:12,color:P.red,margin:'0 0 10px'}}>{error}</p>}
    {items.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>✓ Sin asignaciones pendientes.</p></GlassCard>:
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {items.map(x=>{
          const mod=x.education_modules||{}
          const diffColor=DIFF_COLOR[(mod.difficulty_level||'').toLowerCase()]||P.blue
          return <GlassCard key={x.id}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:6}}>
              <span style={{fontSize:14,fontWeight:700,color:P.text}}>🎓 {mod.title||'Curso'}</span>
              {mod.difficulty_level&&<Badge label={mod.difficulty_level} color={diffColor}/>}
              <span style={{fontSize:11,color:P.muted}}>Solicitado {new Date(x.assigned_at).toLocaleString('es-CL')}</span>
            </div>
            <p style={{fontSize:12,color:P.textSub,margin:'0 0 4px'}}>
              Asignado por: <strong style={{color:P.text}}>{x.assigned_by?.display_name||'—'}</strong>
            </p>
            {x.reason_note&&<p style={{fontSize:12,color:P.muted,margin:'0 0 10px',fontStyle:'italic'}}>"{x.reason_note}"</p>}
            <div style={{display:'flex',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}>
              <input value={notes[x.id]||''} onChange={e=>setNotes(n=>({...n,[x.id]:e.target.value}))} placeholder="Nota de aprobación/rechazo (opcional)"
                style={{flex:1,minWidth:220,background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'8px 12px',color:P.text,fontSize:12.5,outline:'none',fontFamily:'inherit'}}/>
              <div style={{display:'flex',gap:8}}>
                <Btn style={{padding:'7px 14px',fontSize:12,background:P.greenDim,color:P.green,border:'1px solid rgba(0,208,132,0.3)'}} onClick={()=>approve(x.id)} disabled={!!processing[x.id]}>
                  {processing[x.id]==='approving'?'…':'✓ Aprobar'}
                </Btn>
                <Btn variant="danger" style={{padding:'7px 14px',fontSize:12}} onClick={()=>reject(x.id)} disabled={!!processing[x.id]}>
                  {processing[x.id]==='rejecting'?'…':'✕ Rechazar'}
                </Btn>
              </div>
            </div>
          </GlassCard>
        })}
      </div>}
  </div>
}

// ── Contenedor del módulo ────────────────────────────────────────────────────
export default function EducationAdmin({user,isSuperAdmin}){
  const[tab,setTab]=useState('assign')
  const Tab=({id,label})=>(
    <button onClick={()=>setTab(id)} style={{padding:'7px 16px',borderRadius:9,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:tab===id?700:500,background:tab===id?P.purpleDim:'rgba(255,255,255,0.04)',color:tab===id?P.purple:P.textSub,border:`1px solid ${tab===id?'rgba(108,92,231,0.4)':P.border}`}}>{label}</button>
  )
  return <div>
    <div style={{marginBottom:18}}>
      <h1 style={{fontSize:22,fontWeight:800,color:P.text,margin:'0 0 4px',letterSpacing:'-0.01em'}}>Educación</h1>
      <p style={{fontSize:12,color:P.muted,margin:0}}>Asignación de cursos del módulo educativo (9 módulos · 67 lecciones) y flujo de aprobación</p>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:18,borderBottom:`1px solid ${P.border}`,paddingBottom:12}}>
      <Tab id="assign" label="📤 Asignar curso"/>
      {isSuperAdmin&&<Tab id="approvals" label="✅ Aprobaciones"/>}
    </div>
    {tab==='assign'&&<AssignCourse/>}
    {tab==='approvals'&&isSuperAdmin&&<ApprovalQueue user={user}/>}
  </div>
}
