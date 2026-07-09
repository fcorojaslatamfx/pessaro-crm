// ─── CONTENIDO WEB · Biblioteca de Medios ────────────────────────────────────
// Tabla: cms_media_files_2026_02_23_17_38 · Bucket: media-library-2026-01-30-20-41
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { P, T_MEDIA, MEDIA_BUCKET, GlassCard, Btn, Lbl, Input, Spinner, Modal, fmtSize, fmtDate } from './ui.jsx'

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,video/mp4'
const MAX_SIZE = 20 * 1024 * 1024 // 20MB — límite real del bucket

export const publicUrl = filePath => supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath).data.publicUrl

export function useMediaFiles(){
  const[files,setFiles]=useState([])
  const[loading,setLoading]=useState(true)
  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data,error}=await supabase.from(T_MEDIA).select('*').eq('is_active',true).order('created_at',{ascending:false})
      if(error)throw error
      setFiles(data||[])
    }catch(e){console.error('media load:',e)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  const upload=async(file,subfolder='blog')=>{
    if(file.size>MAX_SIZE)throw new Error(`Archivo supera 20MB (${fmtSize(file.size)})`)
    const ext=file.name.split('.').pop()
    const safe=`${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const filePath=subfolder?`${subfolder}/${safe}`:safe
    const{error:upErr}=await supabase.storage.from(MEDIA_BUCKET).upload(filePath,file,{cacheControl:'3600',upsert:false})
    if(upErr)throw upErr
    const{data,error:dbErr}=await supabase.from(T_MEDIA).insert({
      filename:safe,original_name:file.name,file_path:filePath,
      file_size:file.size,mime_type:file.type,is_active:true
    }).select().single()
    if(dbErr)throw dbErr
    setFiles(p=>[data,...p])
    return data
  }
  const remove=async f=>{
    await supabase.storage.from(MEDIA_BUCKET).remove([f.file_path])
    const{error}=await supabase.from(T_MEDIA).delete().eq('id',f.id)
    if(error)throw error
    setFiles(p=>p.filter(x=>x.id!==f.id))
  }
  return{files,loading,upload,remove,reload:load}
}

function MediaTile({f,onSelect,onDelete,selected}){
  const isImg=(f.mime_type||'').startsWith('image/')
  const url=publicUrl(f.file_path)
  return <div onClick={onSelect} style={{border:`2px solid ${selected?P.purple:P.border}`,borderRadius:12,overflow:'hidden',cursor:onSelect?'pointer':'default',background:'rgba(255,255,255,0.02)'}}>
    <div style={{height:110,display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0c13',overflow:'hidden'}}>
      {isImg?<img src={url} alt={f.alt_text||f.original_name} style={{width:'100%',height:'100%',objectFit:'cover'}} loading="lazy"/>
        :<span style={{fontSize:30}}>🎬</span>}
    </div>
    <div style={{padding:'8px 10px'}}>
      <p style={{fontSize:11,fontWeight:600,color:P.text,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={f.original_name}>{f.original_name}</p>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
        <span style={{fontSize:10,color:P.muted}}>{fmtSize(f.file_size)} · {fmtDate(f.created_at)}</span>
        {onDelete&&<button onClick={e=>{e.stopPropagation();onDelete(f)}} title="Eliminar" style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:12,padding:2}}>🗑</button>}
      </div>
    </div>
  </div>
}

function UploadButton({onUpload,busy,setBusy,setError}){
  const ref=useRef(null)
  const pick=async e=>{
    const file=e.target.files?.[0]
    if(!file)return
    setError('');setBusy(true)
    try{await onUpload(file)}
    catch(err){console.error(err);setError(err.message||'Error al subir archivo')}
    finally{setBusy(false);if(ref.current)ref.current.value=''}
  }
  return <>
    <input ref={ref} type="file" accept={ACCEPTED} onChange={pick} style={{display:'none'}}/>
    <Btn onClick={()=>ref.current?.click()} disabled={busy}>{busy?'Subiendo…':'⬆ Subir archivo'}</Btn>
  </>
}

// ── Picker reutilizable (modal) — usado por BlogManager ──────────────────────
export function MediaPicker({onPick,onClose}){
  const{files,loading,upload}=useMediaFiles()
  const[busy,setBusy]=useState(false)
  const[error,setError]=useState('')
  return <Modal title="Seleccionar imagen" onClose={onClose} accent={P.blue} width={860}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
      <p style={{fontSize:12,color:P.muted,margin:0}}>Haz clic en un archivo para usarlo, o sube uno nuevo (máx 20MB).</p>
      <UploadButton onUpload={async f=>{const m=await upload(f);onPick(publicUrl(m.file_path))}} busy={busy} setBusy={setBusy} setError={setError}/>
    </div>
    {error&&<p style={{fontSize:12,color:P.red,margin:'0 0 10px'}}>{error}</p>}
    {loading?<Spinner/>:
      files.length===0?<p style={{fontSize:13,color:P.muted,textAlign:'center',padding:'30px 0'}}>Biblioteca vacía — sube tu primer archivo.</p>:
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,maxHeight:420,overflowY:'auto'}}>
        {files.filter(f=>(f.mime_type||'').startsWith('image/')).map(f=>
          <MediaTile key={f.id} f={f} onSelect={()=>onPick(publicUrl(f.file_path))}/>)}
      </div>}
  </Modal>
}

// ── Vista completa de la biblioteca ──────────────────────────────────────────
export default function MediaLibrary(){
  const{files,loading,upload,remove}=useMediaFiles()
  const[busy,setBusy]=useState(false)
  const[error,setError]=useState('')
  const[confirm,setConfirm]=useState(null)
  const[copied,setCopied]=useState(null)

  const copyUrl=f=>{
    navigator.clipboard.writeText(publicUrl(f.file_path)).then(()=>{
      setCopied(f.id);setTimeout(()=>setCopied(null),1500)
    })
  }
  const doDelete=async()=>{
    try{await remove(confirm);setConfirm(null)}
    catch(e){console.error(e);setError('No se pudo eliminar el archivo');setConfirm(null)}
  }

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
      <p style={{fontSize:12,color:P.muted,margin:0}}>{files.length} archivos · bucket <code style={{fontSize:11}}>{MEDIA_BUCKET}</code></p>
      <UploadButton onUpload={upload} busy={busy} setBusy={setBusy} setError={setError}/>
    </div>
    {error&&<p style={{fontSize:12,color:P.red,margin:'0 0 10px'}}>{error}</p>}
    {loading?<Spinner/>:
      files.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>Biblioteca vacía — sube tu primer archivo.</p></GlassCard>:
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:12}}>
        {files.map(f=><div key={f.id}>
          <MediaTile f={f} onDelete={setConfirm}/>
          <button onClick={()=>copyUrl(f)} style={{marginTop:4,width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${P.border}`,borderRadius:6,color:copied===f.id?P.green:P.textSub,fontSize:10,padding:'4px 0',cursor:'pointer',fontFamily:'inherit'}}>
            {copied===f.id?'✓ Copiado':'Copiar URL'}
          </button>
        </div>)}
      </div>}
    {confirm&&<Modal title="Eliminar archivo" onClose={()=>setConfirm(null)} accent={P.red} width={440}>
      <p style={{fontSize:13,color:P.textSub,marginTop:0}}>Se eliminará <strong style={{color:P.text}}>{confirm.original_name}</strong> del bucket y de la biblioteca. Si algún post lo usa, la imagen dejará de verse en el sitio público.</p>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <Btn variant="ghost" onClick={()=>setConfirm(null)}>Cancelar</Btn>
        <Btn variant="danger" onClick={doDelete}>Eliminar</Btn>
      </div>
    </Modal>}
  </div>
}
