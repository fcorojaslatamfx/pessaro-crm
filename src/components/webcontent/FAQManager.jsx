// ─── CONTENIDO WEB · Gestor de FAQs ──────────────────────────────────────────
// Tabla: cms_faqs_2026_02_23_17_38 (public read: is_active=true)
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { P, GlassCard, Btn, Badge, Lbl, Input, TextArea, Spinner, Modal } from './ui.jsx'

const T='cms_faqs_2026_02_23_17_38'
const slugify=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)
const EMPTY={question:'',answer:'',category:''}

export default function FAQManager(){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[editing,setEditing]=useState(null)
  const[form,setForm]=useState(EMPTY)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState('')
  const[confirm,setConfirm]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data,error}=await supabase.from(T).select('*').order('order_index',{ascending:true,nullsFirst:false})
      if(error)throw error
      setItems(data||[])
    }catch(e){console.error(e)}finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  const openNew=()=>{setForm(EMPTY);setError('');setEditing('new')}
  const openEdit=x=>{setForm({question:x.question||'',answer:x.answer||'',category:x.category||''});setError('');setEditing(x)}

  const save=async()=>{
    if(!form.question.trim()||!form.answer.trim()){setError('Pregunta y respuesta son obligatorias');return}
    setSaving(true);setError('')
    const now=new Date().toISOString()
    try{
      if(editing==='new'){
        const maxOrder=Math.max(0,...items.map(i=>i.order_index||0))
        const{data,error}=await supabase.from(T).insert({
          faq_id:slugify(form.question)||`faq-${Date.now()}`,
          question:form.question.trim(),answer:form.answer.trim(),
          category:form.category||null,order_index:maxOrder+1,is_active:true
        }).select().single()
        if(error)throw error
        setItems(p=>[...p,data])
      }else{
        const{data,error}=await supabase.from(T).update({
          question:form.question.trim(),answer:form.answer.trim(),
          category:form.category||null,updated_at:now
        }).eq('id',editing.id).select().single()
        if(error)throw error
        setItems(p=>p.map(x=>x.id===data.id?data:x))
      }
      setEditing(null)
    }catch(e){console.error(e);setError(e.message||'Error al guardar')}
    finally{setSaving(false)}
  }
  const toggle=async x=>{
    const{data,error}=await supabase.from(T).update({is_active:!x.is_active,updated_at:new Date().toISOString()}).eq('id',x.id).select().single()
    if(!error)setItems(p=>p.map(i=>i.id===data.id?data:i))
  }
  const move=async(idx,dir)=>{
    const j=idx+dir
    if(j<0||j>=items.length)return
    const a=items[idx],b=items[j]
    const oa=a.order_index??idx,ob=b.order_index??j
    await supabase.from(T).update({order_index:ob}).eq('id',a.id)
    await supabase.from(T).update({order_index:oa}).eq('id',b.id)
    setItems(p=>{const n=[...p];n[idx]={...b,order_index:oa};n[j]={...a,order_index:ob};return n})
  }
  const doDelete=async()=>{
    const{error}=await supabase.from(T).delete().eq('id',confirm.id)
    if(!error)setItems(p=>p.filter(x=>x.id!==confirm.id))
    setConfirm(null)
  }

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
      <p style={{fontSize:12,color:P.muted,margin:0}}>{items.length} preguntas · orden = orden en el sitio · inactivas no se muestran</p>
      <Btn onClick={openNew}>+ Nueva FAQ</Btn>
    </div>
    {loading?<Spinner/>:
      items.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>Sin FAQs — crea la primera.</p></GlassCard>:
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {items.map((x,idx)=><GlassCard key={x.id} style={{display:'flex',gap:12,alignItems:'flex-start',opacity:x.is_active?1:0.45}}>
          <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>
            <button onClick={()=>move(idx,-1)} disabled={idx===0} style={{background:'none',border:'none',color:idx===0?P.border:P.muted,cursor:idx===0?'default':'pointer',fontSize:12,padding:2}}>▲</button>
            <button onClick={()=>move(idx,1)} disabled={idx===items.length-1} style={{background:'none',border:'none',color:idx===items.length-1?P.border:P.muted,cursor:idx===items.length-1?'default':'pointer',fontSize:12,padding:2}}>▼</button>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
              <p style={{fontSize:14,fontWeight:600,color:P.text,margin:0}}>{x.question}</p>
              <Badge label={x.is_active?'Activa':'Inactiva'} color={x.is_active?P.green:P.muted}/>
              {x.category&&<span style={{fontSize:11,color:P.blue}}>{x.category}</span>}
            </div>
            <p style={{fontSize:12,color:P.textSub,margin:0,lineHeight:1.6,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{x.answer}</p>
          </div>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12}} onClick={()=>toggle(x)}>{x.is_active?'Desactivar':'Activar'}</Btn>
            <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12}} onClick={()=>openEdit(x)}>Editar</Btn>
            <Btn variant="danger" style={{padding:'5px 10px',fontSize:12}} onClick={()=>setConfirm(x)}>🗑</Btn>
          </div>
        </GlassCard>)}
      </div>}

    {editing&&<Modal title={editing==='new'?'Nueva FAQ':'Editar FAQ'} onClose={()=>setEditing(null)} accent={P.blue} width={640}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div><Lbl>Pregunta *</Lbl><Input value={form.question} onChange={v=>setForm(f=>({...f,question:v}))} placeholder="¿Cómo abro una cuenta?"/></div>
        <div><Lbl>Respuesta *</Lbl><TextArea value={form.answer} onChange={v=>setForm(f=>({...f,answer:v}))} rows={5}/></div>
        <div><Lbl>Categoría</Lbl><Input value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} placeholder="Cuentas, Depósitos, General..."/></div>
        {error&&<p style={{fontSize:12,color:P.red,margin:0}}>{error}</p>}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setEditing(null)}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</Btn>
        </div>
      </div>
    </Modal>}

    {confirm&&<Modal title="Eliminar FAQ" onClose={()=>setConfirm(null)} accent={P.red} width={440}>
      <p style={{fontSize:13,color:P.textSub,marginTop:0}}>Se eliminará <strong style={{color:P.text}}>{confirm.question}</strong>. Alternativa reversible: desactivarla.</p>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <Btn variant="ghost" onClick={()=>setConfirm(null)}>Cancelar</Btn>
        <Btn variant="danger" onClick={doDelete}>Eliminar</Btn>
      </div>
    </Modal>}
  </div>
}
