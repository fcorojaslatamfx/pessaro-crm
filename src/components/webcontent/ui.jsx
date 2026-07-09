// ─── CONTENIDO WEB · UI compartida ───────────────────────────────────────────
// Helpers autocontenidos para el módulo webcontent (patrón components/whatsapp/)
import { useEffect } from 'react'

export const P = {
  bg:'#0d0f17', surface:'#13151f',
  card:'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border:'rgba(255,255,255,0.07)', text:'#f1f2f6', textSub:'#a4b0be', muted:'#636e72',
  purple:'#6c5ce7', purpleDim:'rgba(108,92,231,0.15)',
  blue:'#0984e3', blueDim:'rgba(9,132,227,0.15)',
  green:'#00d084', greenDim:'rgba(0,208,132,0.12)',
  red:'#ff4757', redDim:'rgba(255,71,87,0.12)',
  orange:'#ffa502', orangeDim:'rgba(255,165,2,0.10)',
}

export const MEDIA_BUCKET = 'media-library-2026-01-30-20-41'
export const T_BLOG  = 'cms_blog_posts_2026_02_23_17_38'
export const T_MEDIA = 'cms_media_files_2026_02_23_17_38'

export function GlassCard({children,style={},...rest}){
  return <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:14,padding:18,...style}} {...rest}>{children}</div>
}
export function Btn({children,variant='primary',style={},disabled,...rest}){
  const base={padding:'8px 16px',borderRadius:9,fontSize:13,fontWeight:600,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',opacity:disabled?0.5:1,border:'1px solid transparent'}
  const kinds={
    primary:{background:P.purple,color:'#fff'},
    ghost:{background:'rgba(255,255,255,0.05)',color:P.textSub,border:`1px solid ${P.border}`},
    danger:{background:P.redDim,color:P.red,border:'1px solid rgba(255,71,87,0.3)'},
  }
  return <button disabled={disabled} style={{...base,...kinds[variant],...style}} {...rest}>{children}</button>
}
export function Badge({label,color}){
  return <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color,background:`${color}1f`,borderRadius:5,padding:'2px 8px'}}>{label}</span>
}
export function Lbl({children}){
  return <label style={{display:'block',fontSize:11,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{children}</label>
}
export function Input({value,onChange,style={},...rest}){
  return <input value={value} onChange={e=>onChange(e.target.value)}
    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',boxSizing:'border-box',...style}} {...rest}/>
}
export function TextArea({value,onChange,rows=3,style={},...rest}){
  return <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows}
    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',...style}} {...rest}/>
}
export function Sel({value,onChange,options,style={},...rest}){
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{background:'#13151f',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',boxSizing:'border-box',...style}} {...rest}>
    {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
}
export function Spinner(){
  return <div style={{display:'flex',justifyContent:'center',padding:'40px 0'}}>
    <div style={{width:26,height:26,border:`3px solid ${P.border}`,borderTopColor:P.purple,borderRadius:'50%',animation:'wcspin 0.8s linear infinite'}}/>
    <style>{'@keyframes wcspin{to{transform:rotate(360deg)}}'}</style>
  </div>
}
export function Modal({title,children,onClose,accent=P.purple,width=760}){
  useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose()}
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[onClose])
  return <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',zIndex:1200,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'4vh 16px',overflowY:'auto'}}>
    <div onClick={e=>e.stopPropagation()} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,width:'100%',maxWidth:width,boxShadow:'0 24px 80px rgba(0,0,0,0.5)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 22px',borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:accent,display:'inline-block'}}/>
          <span style={{fontSize:15,fontWeight:700,color:P.text}}>{title}</span>
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',color:P.muted,fontSize:18,cursor:'pointer',padding:4}}>✕</button>
      </div>
      <div style={{padding:22}}>{children}</div>
    </div>
  </div>
}
export const fmtDate=d=>d?new Date(d).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}):''
export const fmtSize=b=>!b?'—':b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(1)} MB`
