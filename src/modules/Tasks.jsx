import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { P, PRIO_COLOR, fmtDate } from '../lib/constants.js'
import { Badge, GlassCard, Input, Sel, Btn, Modal, Lbl, Spinner, SHdr } from '../lib/ui.jsx'

export default function Tasks({contacts,leads}){
  const[tasks,setTasks]=useState([])
  const[loading,setLoading]=useState(true)
  const[showAdd,setShowAdd]=useState(false)
  const[form,setForm]=useState({title:'',priority:'media',due_date:'',contact_submission_id:'',campaign_lead_id:''})

  const load=useCallback(async()=>{
    setLoading(true)
    try{const{data}=await supabase.from('crm_tasks').select('*').order('created_at',{ascending:false});setTasks(data||[])}
    catch(e){console.error(e)}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{load()},[load])

  const addTask=async()=>{
    if(!form.title)return
    const p={...form,done:false}
    if(!p.contact_submission_id)delete p.contact_submission_id
    if(!p.campaign_lead_id)delete p.campaign_lead_id
    const{data}=await supabase.from('crm_tasks').insert(p).select().single()
    if(data){setTasks(p=>[data,...p]);setShowAdd(false);setForm({title:'',priority:'media',due_date:'',contact_submission_id:'',campaign_lead_id:''})}
  }

  const toggle=async(id,done)=>{await supabase.from('crm_tasks').update({done:!done}).eq('id',id);setTasks(p=>p.map(t=>t.id===id?{...t,done:!done}:t))}
  const del=async id=>{await supabase.from('crm_tasks').delete().eq('id',id);setTasks(p=>p.filter(t=>t.id!==id))}

  const getName=useCallback(t=>{
    if(t.contact_submission_id)return contacts.find(c=>c.id===t.contact_submission_id)?.full_name||''
    if(t.campaign_lead_id)return leads.find(l=>l.id===t.campaign_lead_id)?.full_name||''
    return ''
  },[contacts,leads])

  const pending = useMemo(()=>tasks.filter(t=>!t.done),[tasks])
  const done    = useMemo(()=>tasks.filter(t=>t.done),[tasks])

  return <div>
    <SHdr title="Tareas" sub={`${pending.length} pendientes · ${done.length} completadas`} action={<Btn onClick={()=>setShowAdd(true)}>+ Nueva tarea</Btn>}/>
    {loading?<Spinner/>:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      <div>
        <p style={{fontSize:10,fontWeight:700,color:P.orange,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>● Pendientes ({pending.length})</p>
        {pending.map(t=><GlassCard key={t.id} style={{marginBottom:10,display:'flex',gap:12,alignItems:'flex-start',borderLeft:`3px solid ${PRIO_COLOR[t.priority]}`}}>
          <button onClick={()=>toggle(t.id,t.done)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${PRIO_COLOR[t.priority]}`,background:'transparent',cursor:'pointer',flexShrink:0,marginTop:2}}/>
          <div style={{flex:1}}>
            <p style={{fontSize:14,fontWeight:500,color:P.text,margin:'0 0 6px'}}>{t.title}</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              {getName(t)&&<span style={{fontSize:11,color:P.muted}}>{getName(t)}</span>}
              <Badge label={t.priority} color={PRIO_COLOR[t.priority]}/>
              {t.due_date&&<span style={{fontSize:11,color:P.muted}}>{fmtDate(t.due_date)}</span>}
            </div>
          </div>
          <button onClick={()=>del(t.id)} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:14}}>✕</button>
        </GlassCard>)}
        {pending.length===0&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'20px 0'}}><div style={{width:8,height:8,borderRadius:'50%',background:P.green}}/><span style={{color:P.green,fontSize:13,fontWeight:500}}>¡Todo al día!</span></div>}
      </div>
      <div>
        <p style={{fontSize:10,fontWeight:700,color:P.green,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>● Completadas ({done.length})</p>
        {done.map(t=><GlassCard key={t.id} style={{marginBottom:10,opacity:0.4}}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}><div style={{width:20,height:20,borderRadius:6,background:P.green,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',fontSize:10,fontWeight:700}}>✓</div><span style={{fontSize:14,textDecoration:'line-through',color:P.muted}}>{t.title}</span></div>
        </GlassCard>)}
      </div>
    </div>}
    {showAdd&&<Modal title="Nueva tarea" onClose={()=>setShowAdd(false)} accent={P.orange}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div><Lbl>Título *</Lbl><Input value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Descripción de la tarea"/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Prioridad</Lbl><Sel value={form.priority} onChange={v=>setForm(p=>({...p,priority:v}))} options={[{value:'alta',label:'Alta'},{value:'media',label:'Media'},{value:'baja',label:'Baja'}]}/></div>
          <div><Lbl>Fecha</Lbl><Input value={form.due_date} onChange={v=>setForm(p=>({...p,due_date:v}))} type="date"/></div>
        </div>
        <div><Lbl>Contacto</Lbl><Sel value={form.contact_submission_id} onChange={v=>setForm(p=>({...p,contact_submission_id:v}))} options={[{value:'',label:'Sin contacto'},...contacts.map(c=>({value:c.id,label:c.full_name||c.email}))]}/></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn>
          <Btn onClick={addTask} disabled={!form.title}>Guardar</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}
