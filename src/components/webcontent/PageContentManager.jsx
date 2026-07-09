// ─── CONTENIDO WEB · Gestor de Páginas ───────────────────────────────────────
// Tabla: cms_page_content_2026_02_23_17_38 (public read: is_active=true)
// ⚠️ page_key es columna GENERATED ALWAYS (solo lectura) — NUNCA se escribe.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { P, GlassCard, Btn, Badge, Lbl, Input, TextArea, Sel, Spinner, Modal } from './ui.jsx'
import { MediaPicker } from './MediaLibrary.jsx'

const T='cms_page_content_2026_02_23_17_38'
const EMPTY={page_slug:'home',section_key:'',content_type:'text',title:'',content:'',image_url:'',metadata:''}
const PAGE_LABEL={home:'Inicio',nosotros:'Nosotros',servicios:'Servicios'}

export default function PageContentManager(){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[pageFilter,setPageFilter]=useState('todas')
  const[editing,setEditing]=useState(null)
  const[form,setForm]=useState(EMPTY)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState('')
  const[confirm,setConfirm]=useState(null)
  const[showPicker,setShowPicker]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data,error}=await supabase.from(T).select('*').order('page_slug').order('section_key')
      if(error)throw error
      setItems(data||[])
    }catch(e){console.error(e)}finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  const pages=[...new Set(items.map(i=>i.page_slug))]
  const filtered=pageFilter==='todas'?items:items.filter(i=>i.page_slug===pageFilter)

  const openNew=()=>{setForm({...EMPTY,page_slug:pageFilter!=='todas'?pageFilter:'home'});setError('');setEditing('new')}
  const openEdit=x=>{
    setForm({page_slug:x.page_slug||'',section_key:x.section_key||'',content_type:x.content_type||'text',
      title:x.title||'',content:x.content||'',image_url:x.image_url||'',
      metadata:x.metadata?JSON.stringify(x.metadata,null,2):''})
    setError('');setEditing(x)
  }

  const save=async()=>{
    if(!form.page_slug.trim()||!form.section_key.trim()){setError('Página y clave de sección son obligatorias');return}
    let metadata=null
    if(form.metadata.trim()){
      try{metadata=JSON.parse(form.metadata)}
      catch{setError('Metadata no es JSON válido');return}
    }
    setSaving(true);setError('')
    const now=new Date().toISOString()
    // ⚠️ nunca incluir page_key ni created_at en el payload (page_key es GENERATED)
    const payload={
      page_slug:form.page_slug.trim(),section_key:form.section_key.trim(),
      content_type:form.content_type||'text',title:form.title||null,
      content:form.content||null,image_url:form.image_url||null,metadata,
    }
    try{
      if(editing==='new'){
        const{data,error}=await supabase.from(T).insert({...payload,is_active:true}).select().single()
        if(error)throw error
        setItems(p=>[...p,data])
      }else{
        const{data,error}=await supabase.from(T).update({...payload,updated_at:now}).eq('id',editing.id).select().single()
        if(error)throw error
        setItems(p=>p.map(x=>x.id===data.id?data:x))
      }
      setEditing(null)
    }catch(e){
      console.error(e)
      setError(e.code==='23505'?'Ya existe una sección con esa clave en esta página.':e.message||'Error al guardar')
    }finally{setSaving(false)}
  }
  const toggle=async x=>{
    const{data,error}=await supabase.from(T).update({is_active:!x.is_active,updated_at:new Date().toISOString()}).eq('id',x.id).select().single()
    if(!error)setItems(p=>p.map(i=>i.id===data.id?data:i))
  }
  const doDelete=async()=>{
    const{error}=await supabase.from(T).delete().eq('id',confirm.id)
    if(!error)setItems(p=>p.filter(x=>x.id!==confirm.id))
    setConfirm(null)
  }

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {['todas',...pages].map(pg=>
          <button key={pg} onClick={()=>setPageFilter(pg)} style={{padding:'6px 14px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:pageFilter===pg?700:400,background:pageFilter===pg?P.purpleDim:'rgba(255,255,255,0.04)',color:pageFilter===pg?P.purple:P.muted,border:`1px solid ${pageFilter===pg?'rgba(108,92,231,0.4)':P.border}`}}>
            {pg==='todas'?'Todas':PAGE_LABEL[pg]||pg}
          </button>)}
      </div>
      <Btn onClick={openNew}>+ Nueva sección</Btn>
    </div>
    <p style={{fontSize:11,color:P.orange,margin:'0 0 12px'}}>⚠ Estas secciones alimentan textos e imágenes del sitio público — editar con cuidado; cambios activos se reflejan de inmediato.</p>
    {loading?<Spinner/>:
      filtered.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>Sin secciones en esta vista.</p></GlassCard>:
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtered.map(x=><GlassCard key={x.id} style={{display:'flex',gap:12,alignItems:'flex-start',opacity:x.is_active?1:0.45}}>
          {x.image_url&&<div style={{width:64,height:44,borderRadius:8,overflow:'hidden',background:'#0a0c13',flexShrink:0}}>
            <img src={x.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} loading="lazy"/>
          </div>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
              <Badge label={PAGE_LABEL[x.page_slug]||x.page_slug} color={P.blue}/>
              <span style={{fontSize:12,fontWeight:700,color:P.text,fontFamily:'monospace'}}>{x.section_key}</span>
              <Badge label={x.is_active?'Activa':'Inactiva'} color={x.is_active?P.green:P.muted}/>
              {x.content_type&&x.content_type!=='text'&&<span style={{fontSize:10,color:P.muted}}>{x.content_type}</span>}
            </div>
            {x.title&&<p style={{fontSize:13,fontWeight:600,color:P.text,margin:'0 0 2px'}}>{x.title}</p>}
            {x.content&&<p style={{fontSize:12,color:P.textSub,margin:0,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{x.content}</p>}
          </div>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12}} onClick={()=>toggle(x)}>{x.is_active?'Desactivar':'Activar'}</Btn>
            <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12}} onClick={()=>openEdit(x)}>Editar</Btn>
            <Btn variant="danger" style={{padding:'5px 10px',fontSize:12}} onClick={()=>setConfirm(x)}>🗑</Btn>
          </div>
        </GlassCard>)}
      </div>}

    {editing&&<Modal title={editing==='new'?'Nueva sección':`Editar · ${editing.page_slug}/${editing.section_key}`} onClose={()=>setEditing(null)} accent={P.blue} width={720}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          <div><Lbl>Página *</Lbl><Input value={form.page_slug} onChange={v=>setForm(f=>({...f,page_slug:v}))} placeholder="home, nosotros, servicios..."/></div>
          <div><Lbl>Clave de sección *</Lbl><Input value={form.section_key} onChange={v=>setForm(f=>({...f,section_key:v}))} placeholder="hero_title, cta_text..." disabled={editing!=='new'} style={editing!=='new'?{opacity:0.6}:{}}/></div>
          <div><Lbl>Tipo</Lbl><Sel value={form.content_type} onChange={v=>setForm(f=>({...f,content_type:v}))} options={[{value:'text',label:'Texto'},{value:'html',label:'HTML'},{value:'image',label:'Imagen'},{value:'json',label:'JSON'}]}/></div>
        </div>
        <div><Lbl>Título</Lbl><Input value={form.title} onChange={v=>setForm(f=>({...f,title:v}))}/></div>
        <div><Lbl>Contenido</Lbl><TextArea value={form.content} onChange={v=>setForm(f=>({...f,content:v}))} rows={5}/></div>
        <div>
          <Lbl>Imagen</Lbl>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            {form.image_url?
              <img src={form.image_url} alt="" style={{width:90,height:54,objectFit:'cover',borderRadius:8,border:`1px solid ${P.border}`}}/>:
              <div style={{width:90,height:54,borderRadius:8,border:`1px dashed ${P.border}`,display:'flex',alignItems:'center',justifyContent:'center',color:P.muted,fontSize:10}}>Sin imagen</div>}
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" style={{padding:'6px 12px',fontSize:12}} onClick={()=>setShowPicker(true)}>Elegir</Btn>
              {form.image_url&&<Btn variant="ghost" style={{padding:'6px 12px',fontSize:12}} onClick={()=>setForm(f=>({...f,image_url:''}))}>Quitar</Btn>}
            </div>
          </div>
        </div>
        <div><Lbl>Metadata (JSON opcional — avanzado)</Lbl><TextArea value={form.metadata} onChange={v=>setForm(f=>({...f,metadata:v}))} rows={3} style={{fontFamily:'monospace',fontSize:12}}/></div>
        {error&&<p style={{fontSize:12,color:P.red,margin:0}}>{error}</p>}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setEditing(null)}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</Btn>
        </div>
      </div>
    </Modal>}

    {showPicker&&<MediaPicker onClose={()=>setShowPicker(false)} onPick={url=>{setForm(f=>({...f,image_url:url}));setShowPicker(false)}}/>}

    {confirm&&<Modal title="Eliminar sección" onClose={()=>setConfirm(null)} accent={P.red} width={460}>
      <p style={{fontSize:13,color:P.textSub,marginTop:0}}>Se eliminará <strong style={{color:P.text}}>{confirm.page_slug}/{confirm.section_key}</strong>. Si el sitio la consume, esa parte quedará vacía. Alternativa reversible: desactivarla.</p>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <Btn variant="ghost" onClick={()=>setConfirm(null)}>Cancelar</Btn>
        <Btn variant="danger" onClick={doDelete}>Eliminar</Btn>
      </div>
    </Modal>}
  </div>
}
