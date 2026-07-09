// ─── CONTENIDO WEB · Gestor de Blog ──────────────────────────────────────────
// Tabla: cms_blog_posts_2026_02_23_17_38 (public read: status='published')
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { P, T_BLOG, GlassCard, Btn, Badge, Lbl, Input, TextArea, Sel, Spinner, Modal, fmtDate } from './ui.jsx'
import { MediaPicker } from './MediaLibrary.jsx'

const STATUS_META={published:{label:'Publicado',color:P.green},draft:{label:'Borrador',color:P.orange},archived:{label:'Archivado',color:P.muted}}
const slugify=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)
const EMPTY={title:'',slug:'',excerpt:'',content:'',featured_image:'',author_name:'Pessaro Capital',category:'',tags:'',status:'draft',read_time:5}

// ── Editor HTML autocontenido (sin dependencias — contentEditable) ───────────
function HtmlEditor({value,onChange}){
  const ref=useRef(null)
  useEffect(()=>{
    if(ref.current&&ref.current.innerHTML!==(value||''))ref.current.innerHTML=value||''
  },[]) // solo montaje: evita perder el cursor en cada tecla
  const exec=(cmd,arg=null)=>{
    ref.current?.focus()
    document.execCommand(cmd,false,arg)
    onChange(ref.current?.innerHTML||'')
  }
  const addLink=()=>{
    const url=window.prompt('URL del enlace (https://...)')
    if(url)exec('createLink',url)
  }
  const TB=({label,title,onClick})=>(
    <button type="button" onMouseDown={e=>e.preventDefault()} onClick={onClick} title={title}
      style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${P.border}`,borderRadius:6,color:P.textSub,fontSize:12,fontWeight:600,padding:'5px 9px',cursor:'pointer',fontFamily:'inherit'}}>{label}</button>
  )
  return <div style={{border:`1px solid ${P.border}`,borderRadius:10,overflow:'hidden'}}>
    <div style={{display:'flex',gap:5,flexWrap:'wrap',padding:8,borderBottom:`1px solid ${P.border}`,background:'rgba(255,255,255,0.02)'}}>
      <TB label="B" title="Negrita" onClick={()=>exec('bold')}/>
      <TB label="I" title="Cursiva" onClick={()=>exec('italic')}/>
      <TB label="H2" title="Título 2" onClick={()=>exec('formatBlock','<h2>')}/>
      <TB label="H3" title="Título 3" onClick={()=>exec('formatBlock','<h3>')}/>
      <TB label="¶" title="Párrafo" onClick={()=>exec('formatBlock','<p>')}/>
      <TB label="• Lista" title="Lista" onClick={()=>exec('insertUnorderedList')}/>
      <TB label="1. Lista" title="Lista numerada" onClick={()=>exec('insertOrderedList')}/>
      <TB label='"' title="Cita" onClick={()=>exec('formatBlock','<blockquote>')}/>
      <TB label="🔗" title="Enlace" onClick={addLink}/>
      <TB label="⌫F" title="Limpiar formato" onClick={()=>exec('removeFormat')}/>
    </div>
    <div ref={ref} contentEditable suppressContentEditableWarning
      onInput={()=>onChange(ref.current?.innerHTML||'')}
      style={{minHeight:260,maxHeight:460,overflowY:'auto',padding:16,fontSize:14,lineHeight:1.7,color:P.text,outline:'none',background:'rgba(255,255,255,0.015)'}}/>
  </div>
}

export default function BlogManager(){
  const[posts,setPosts]=useState([])
  const[loading,setLoading]=useState(true)
  const[filter,setFilter]=useState('todos')
  const[editing,setEditing]=useState(null)   // null | 'new' | post object
  const[form,setForm]=useState(EMPTY)
  const[slugTouched,setSlugTouched]=useState(false)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState('')
  const[confirm,setConfirm]=useState(null)
  const[showPicker,setShowPicker]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data,error}=await supabase.from(T_BLOG).select('*').order('created_at',{ascending:false})
      if(error)throw error
      setPosts(data||[])
    }catch(e){console.error('blog load:',e)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  const openNew=()=>{setForm(EMPTY);setSlugTouched(false);setError('');setEditing('new')}
  const openEdit=p=>{
    setForm({title:p.title||'',slug:p.slug||'',excerpt:p.excerpt||'',content:p.content||'',
      featured_image:p.featured_image||'',author_name:p.author_name||'',category:p.category||'',
      tags:Array.isArray(p.tags)?p.tags.join(', '):'',status:p.status||'draft',read_time:p.read_time||5})
    setSlugTouched(true);setError('');setEditing(p)
  }
  const setTitle=v=>setForm(f=>({...f,title:v,slug:slugTouched?f.slug:slugify(v)}))

  const save=async()=>{
    if(!form.title.trim()||!form.slug.trim()){setError('Título y slug son obligatorios');return}
    setSaving(true);setError('')
    const now=new Date().toISOString()
    const payload={
      title:form.title.trim(),slug:form.slug.trim(),excerpt:form.excerpt||null,
      content:form.content||'',featured_image:form.featured_image||null,
      author_name:form.author_name||null,category:form.category||null,
      tags:form.tags?form.tags.split(',').map(t=>t.trim()).filter(Boolean):[],
      status:form.status,read_time:Number(form.read_time)||5,
    }
    try{
      if(editing==='new'){
        if(payload.status==='published')payload.published_at=now
        const{data,error}=await supabase.from(T_BLOG).insert(payload).select().single()
        if(error)throw error
        setPosts(p=>[data,...p])
      }else{
        if(payload.status==='published'&&!editing.published_at)payload.published_at=now
        const{data,error}=await supabase.from(T_BLOG).update({...payload,updated_at:now}).eq('id',editing.id).select().single()
        if(error)throw error
        setPosts(p=>p.map(x=>x.id===data.id?data:x))
      }
      setEditing(null)
    }catch(e){
      console.error(e)
      setError(e.code==='23505'?'Ya existe un post con ese slug — cámbialo.':e.message||'Error al guardar')
    }finally{setSaving(false)}
  }
  const doDelete=async()=>{
    try{
      const{error}=await supabase.from(T_BLOG).delete().eq('id',confirm.id)
      if(error)throw error
      setPosts(p=>p.filter(x=>x.id!==confirm.id));setConfirm(null)
    }catch(e){console.error(e);setError('No se pudo eliminar');setConfirm(null)}
  }

  const filtered=filter==='todos'?posts:posts.filter(p=>p.status===filter)
  const counts={todos:posts.length,published:posts.filter(p=>p.status==='published').length,draft:posts.filter(p=>p.status==='draft').length,archived:posts.filter(p=>p.status==='archived').length}

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {[['todos','Todos'],['published','Publicados'],['draft','Borradores'],['archived','Archivados']].map(([id,label])=>
          <button key={id} onClick={()=>setFilter(id)} style={{padding:'6px 14px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:filter===id?700:400,background:filter===id?P.purpleDim:'rgba(255,255,255,0.04)',color:filter===id?P.purple:P.muted,border:`1px solid ${filter===id?'rgba(108,92,231,0.4)':P.border}`}}>
            {label} <span style={{opacity:0.7}}>({counts[id]??0})</span>
          </button>)}
      </div>
      <Btn onClick={openNew}>+ Nuevo post</Btn>
    </div>
    {error&&!editing&&<p style={{fontSize:12,color:P.red,margin:'0 0 10px'}}>{error}</p>}
    {loading?<Spinner/>:
      filtered.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>Sin posts en esta vista.</p></GlassCard>:
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtered.map(p=>{
          const m=STATUS_META[p.status]||STATUS_META.draft
          return <GlassCard key={p.id} style={{display:'flex',gap:14,alignItems:'center'}}>
            <div style={{width:70,height:48,borderRadius:8,overflow:'hidden',background:'#0a0c13',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {p.featured_image?<img src={p.featured_image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} loading="lazy"/>:<span style={{fontSize:18,opacity:0.4}}>📰</span>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:600,color:P.text,margin:'0 0 3px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title}</p>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <Badge label={m.label} color={m.color}/>
                <span style={{fontSize:11,color:P.muted}}>/{p.slug}</span>
                {p.category&&<span style={{fontSize:11,color:P.blue}}>{p.category}</span>}
                <span style={{fontSize:11,color:P.muted}}>{p.status==='published'&&p.published_at?`Publicado ${fmtDate(p.published_at)}`:`Creado ${fmtDate(p.created_at)}`}</span>
                {typeof p.views==='number'&&<span style={{fontSize:11,color:P.muted}}>👁 {p.views}</span>}
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              {p.status==='published'&&<a href={`https://pessaro.cl/blog/${p.slug}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:P.blue,textDecoration:'none',alignSelf:'center'}}>Ver ↗</a>}
              <Btn variant="ghost" style={{padding:'5px 12px',fontSize:12}} onClick={()=>openEdit(p)}>Editar</Btn>
              <Btn variant="danger" style={{padding:'5px 10px',fontSize:12}} onClick={()=>setConfirm(p)}>🗑</Btn>
            </div>
          </GlassCard>
        })}
      </div>}

    {editing&&<Modal title={editing==='new'?'Nuevo post':`Editar · ${editing.title}`} onClose={()=>setEditing(null)} accent={P.green} width={880}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
          <div><Lbl>Título *</Lbl><Input value={form.title} onChange={setTitle} placeholder="Título del artículo"/></div>
          <div><Lbl>Slug *</Lbl><Input value={form.slug} onChange={v=>{setSlugTouched(true);setForm(f=>({...f,slug:slugify(v)||v}))}} placeholder="url-del-post"/></div>
        </div>
        <div><Lbl>Extracto</Lbl><TextArea value={form.excerpt} onChange={v=>setForm(f=>({...f,excerpt:v}))} rows={2} placeholder="Resumen corto para listados y SEO..."/></div>
        <div>
          <Lbl>Imagen destacada</Lbl>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            {form.featured_image?
              <img src={form.featured_image} alt="" style={{width:110,height:66,objectFit:'cover',borderRadius:8,border:`1px solid ${P.border}`}}/>:
              <div style={{width:110,height:66,borderRadius:8,border:`1px dashed ${P.border}`,display:'flex',alignItems:'center',justifyContent:'center',color:P.muted,fontSize:11}}>Sin imagen</div>}
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" style={{padding:'6px 12px',fontSize:12}} onClick={()=>setShowPicker(true)}>Elegir de biblioteca</Btn>
              {form.featured_image&&<Btn variant="ghost" style={{padding:'6px 12px',fontSize:12}} onClick={()=>setForm(f=>({...f,featured_image:''}))}>Quitar</Btn>}
            </div>
          </div>
        </div>
        <div><Lbl>Contenido</Lbl><HtmlEditor key={editing==='new'?'new':editing.id} value={form.content} onChange={v=>setForm(f=>({...f,content:v}))}/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          <div><Lbl>Autor</Lbl><Input value={form.author_name} onChange={v=>setForm(f=>({...f,author_name:v}))}/></div>
          <div><Lbl>Categoría</Lbl><Input value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} placeholder="Mercados, Educación..."/></div>
          <div><Lbl>Lectura (min)</Lbl><Input type="number" min="1" value={form.read_time} onChange={v=>setForm(f=>({...f,read_time:v}))}/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
          <div><Lbl>Tags (separados por coma)</Lbl><Input value={form.tags} onChange={v=>setForm(f=>({...f,tags:v}))} placeholder="forex, oro, análisis"/></div>
          <div><Lbl>Estado</Lbl><Sel value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={[{value:'draft',label:'Borrador'},{value:'published',label:'Publicado'},{value:'archived',label:'Archivado'}]}/></div>
        </div>
        {form.status==='published'&&<p style={{fontSize:11,color:P.green,margin:0}}>✓ Al guardar quedará visible de inmediato en pessaro.cl/blog</p>}
        {error&&<p style={{fontSize:12,color:P.red,margin:0}}>{error}</p>}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:4}}>
          <Btn variant="ghost" onClick={()=>setEditing(null)}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</Btn>
        </div>
      </div>
    </Modal>}

    {showPicker&&<MediaPicker onClose={()=>setShowPicker(false)} onPick={url=>{setForm(f=>({...f,featured_image:url}));setShowPicker(false)}}/>}

    {confirm&&<Modal title="Eliminar post" onClose={()=>setConfirm(null)} accent={P.red} width={440}>
      <p style={{fontSize:13,color:P.textSub,marginTop:0}}>Se eliminará <strong style={{color:P.text}}>{confirm.title}</strong> de forma permanente. Si está publicado, desaparecerá del sitio. Alternativa: cambia su estado a <em>Archivado</em>.</p>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <Btn variant="ghost" onClick={()=>setConfirm(null)}>Cancelar</Btn>
        <Btn variant="danger" onClick={doDelete}>Eliminar definitivamente</Btn>
      </div>
    </Modal>}
  </div>
}
