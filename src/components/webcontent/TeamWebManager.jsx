// ─── CONTENIDO WEB · Gestor de Equipo (sitio público) ────────────────────────
// Tabla: cms_team_members_2026_02_23_17_38 (public read: is_active=true)
// Nota v1.9: incluye twitter_url (columna real en DB, ausente en cms-types.ts del CMS viejo)
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { P, GlassCard, Btn, Badge, Lbl, Input, TextArea, Spinner, Modal } from './ui.jsx'
import { MediaPicker } from './MediaLibrary.jsx'

const T='cms_team_members_2026_02_23_17_38'
const EMPTY={name:'',role:'',bio:'',image_url:'',linkedin_url:'',twitter_url:''}

export default function TeamWebManager(){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[editing,setEditing]=useState(null)
  const[form,setForm]=useState(EMPTY)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState('')
  const[confirm,setConfirm]=useState(null)
  const[showPicker,setShowPicker]=useState(false)

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
  const openEdit=x=>{setForm({name:x.name||'',role:x.role||'',bio:x.bio||'',image_url:x.image_url||'',linkedin_url:x.linkedin_url||'',twitter_url:x.twitter_url||''});setError('');setEditing(x)}

  const save=async()=>{
    if(!form.name.trim()||!form.role.trim()){setError('Nombre y cargo son obligatorios');return}
    setSaving(true);setError('')
    const now=new Date().toISOString()
    const payload={
      name:form.name.trim(),role:form.role.trim(),bio:form.bio||null,
      image_url:form.image_url||null,linkedin_url:form.linkedin_url||null,twitter_url:form.twitter_url||null,
    }
    try{
      if(editing==='new'){
        const maxOrder=Math.max(0,...items.map(i=>i.order_index||0))
        const{data,error}=await supabase.from(T).insert({...payload,order_index:maxOrder+1,is_active:true}).select().single()
        if(error)throw error
        setItems(p=>[...p,data])
      }else{
        const{data,error}=await supabase.from(T).update({...payload,updated_at:now}).eq('id',editing.id).select().single()
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
      <p style={{fontSize:12,color:P.muted,margin:0}}>{items.length} miembros · sección "Nosotros" de pessaro.cl · inactivos se ocultan</p>
      <Btn onClick={openNew}>+ Nuevo miembro</Btn>
    </div>
    {loading?<Spinner/>:
      items.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>Sin miembros.</p></GlassCard>:
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {items.map((x,idx)=><GlassCard key={x.id} style={{display:'flex',gap:12,alignItems:'center',opacity:x.is_active?1:0.45}}>
          <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>
            <button onClick={()=>move(idx,-1)} disabled={idx===0} style={{background:'none',border:'none',color:idx===0?P.border:P.muted,cursor:idx===0?'default':'pointer',fontSize:12,padding:2}}>▲</button>
            <button onClick={()=>move(idx,1)} disabled={idx===items.length-1} style={{background:'none',border:'none',color:idx===items.length-1?P.border:P.muted,cursor:idx===items.length-1?'default':'pointer',fontSize:12,padding:2}}>▼</button>
          </div>
          <div style={{width:48,height:48,borderRadius:'50%',overflow:'hidden',background:'#0a0c13',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {x.image_url?<img src={x.image_url} alt={x.name} style={{width:'100%',height:'100%',objectFit:'cover'}} loading="lazy"/>:<span style={{fontSize:18,opacity:0.4}}>👤</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <p style={{fontSize:14,fontWeight:600,color:P.text,margin:0}}>{x.name}</p>
              <Badge label={x.is_active?'Visible':'Oculto'} color={x.is_active?P.green:P.muted}/>
            </div>
            <p style={{fontSize:12,color:P.textSub,margin:'2px 0 0'}}>{x.role}</p>
            <div style={{display:'flex',gap:10,marginTop:2}}>
              {x.linkedin_url&&<a href={x.linkedin_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:P.blue,textDecoration:'none'}}>LinkedIn ↗</a>}
              {x.twitter_url&&<a href={x.twitter_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:P.blue,textDecoration:'none'}}>X/Twitter ↗</a>}
            </div>
          </div>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12}} onClick={()=>toggle(x)}>{x.is_active?'Ocultar':'Mostrar'}</Btn>
            <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12}} onClick={()=>openEdit(x)}>Editar</Btn>
            <Btn variant="danger" style={{padding:'5px 10px',fontSize:12}} onClick={()=>setConfirm(x)}>🗑</Btn>
          </div>
        </GlassCard>)}
      </div>}

    {editing&&<Modal title={editing==='new'?'Nuevo miembro':'Editar miembro'} onClose={()=>setEditing(null)} accent={P.purple} width={640}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',gap:14,alignItems:'center'}}>
          <div style={{width:72,height:72,borderRadius:'50%',overflow:'hidden',background:'#0a0c13',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${P.border}`}}>
            {form.image_url?<img src={form.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:24,opacity:0.4}}>👤</span>}
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn variant="ghost" style={{padding:'6px 12px',fontSize:12}} onClick={()=>setShowPicker(true)}>Elegir foto</Btn>
            {form.image_url&&<Btn variant="ghost" style={{padding:'6px 12px',fontSize:12}} onClick={()=>setForm(f=>({...f,image_url:''}))}>Quitar</Btn>}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Nombre *</Lbl><Input value={form.name} onChange={v=>setForm(f=>({...f,name:v}))}/></div>
          <div><Lbl>Cargo *</Lbl><Input value={form.role} onChange={v=>setForm(f=>({...f,role:v}))} placeholder="CEO & Head Trader"/></div>
        </div>
        <div><Lbl>Bio</Lbl><TextArea value={form.bio} onChange={v=>setForm(f=>({...f,bio:v}))} rows={3}/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>LinkedIn URL</Lbl><Input value={form.linkedin_url} onChange={v=>setForm(f=>({...f,linkedin_url:v}))} placeholder="https://linkedin.com/in/..."/></div>
          <div><Lbl>X / Twitter URL</Lbl><Input value={form.twitter_url} onChange={v=>setForm(f=>({...f,twitter_url:v}))} placeholder="https://x.com/..."/></div>
        </div>
        {error&&<p style={{fontSize:12,color:P.red,margin:0}}>{error}</p>}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setEditing(null)}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</Btn>
        </div>
      </div>
    </Modal>}

    {showPicker&&<MediaPicker onClose={()=>setShowPicker(false)} onPick={url=>{setForm(f=>({...f,image_url:url}));setShowPicker(false)}}/>}

    {confirm&&<Modal title="Eliminar miembro" onClose={()=>setConfirm(null)} accent={P.red} width={440}>
      <p style={{fontSize:13,color:P.textSub,marginTop:0}}>Se eliminará <strong style={{color:P.text}}>{confirm.name}</strong>. Alternativa reversible: ocultarlo.</p>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <Btn variant="ghost" onClick={()=>setConfirm(null)}>Cancelar</Btn>
        <Btn variant="danger" onClick={doDelete}>Eliminar</Btn>
      </div>
    </Modal>}
  </div>
}
