// ─── CONTENIDO WEB · Ajustes del Sitio ───────────────────────────────────────
// Tabla: cms_site_settings_2026_02_23_17_38 (public read: is_active=true)
// 20 ajustes en 5 categorías: general, contact, social, seo, trading
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { P, GlassCard, Btn, Lbl, Spinner } from './ui.jsx'

const T='cms_site_settings_2026_02_23_17_38'
const CAT_META={
  general:{label:'General',icon:'🏛',order:1},
  contact:{label:'Contacto',icon:'📞',order:2},
  social:{label:'Redes Sociales',icon:'🔗',order:3},
  seo:{label:'SEO',icon:'🔍',order:4},
  trading:{label:'Trading',icon:'📊',order:5},
}
const keyLabel=k=>(k||'').replace(/^(social_|seo_|contact_)/,'').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())

export default function SiteSettings(){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[drafts,setDrafts]=useState({})   // id -> valor editado
  const[savingId,setSavingId]=useState(null)
  const[savedId,setSavedId]=useState(null)
  const[error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data,error}=await supabase.from(T).select('*').order('category').order('setting_key')
      if(error)throw error
      setItems(data||[])
    }catch(e){console.error(e)}finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  const save=async s=>{
    const value=drafts[s.id]
    if(value===undefined||value===(s.setting_value||''))return
    setSavingId(s.id);setError('')
    try{
      const{data,error}=await supabase.from(T).update({setting_value:value,updated_at:new Date().toISOString()}).eq('id',s.id).select().single()
      if(error)throw error
      setItems(p=>p.map(x=>x.id===data.id?data:x))
      setDrafts(d=>{const n={...d};delete n[s.id];return n})
      setSavedId(s.id);setTimeout(()=>setSavedId(null),1500)
    }catch(e){console.error(e);setError(`No se pudo guardar ${s.setting_key}`)}
    finally{setSavingId(null)}
  }

  const cats=[...new Set(items.map(i=>i.category||'general'))]
    .sort((a,b)=>(CAT_META[a]?.order||99)-(CAT_META[b]?.order||99))

  return <div>
    <p style={{fontSize:12,color:P.muted,margin:'0 0 4px'}}>{items.length} ajustes globales del sitio público (títulos, SEO, contacto, redes, parámetros de trading).</p>
    <p style={{fontSize:11,color:P.orange,margin:'0 0 16px'}}>⚠ Los cambios se reflejan de inmediato en pessaro.cl. Guarda cada campo con su botón tras editarlo.</p>
    {error&&<p style={{fontSize:12,color:P.red,margin:'0 0 10px'}}>{error}</p>}
    {loading?<Spinner/>:
      cats.map(cat=>{
        const meta=CAT_META[cat]||{label:cat,icon:'⚙'}
        const rows=items.filter(i=>(i.category||'general')===cat)
        return <GlassCard key={cat} style={{marginBottom:14}}>
          <p style={{fontSize:12,fontWeight:700,color:P.text,textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 14px'}}>{meta.icon} {meta.label}</p>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {rows.map(s=>{
              const current=drafts[s.id]!==undefined?drafts[s.id]:(s.setting_value||'')
              const dirty=drafts[s.id]!==undefined&&drafts[s.id]!==(s.setting_value||'')
              const long=(s.setting_value||'').length>70||s.setting_key.includes('description')||s.setting_key.includes('keywords')
              return <div key={s.id} style={{display:'grid',gridTemplateColumns:'180px 1fr auto',gap:12,alignItems:'start'}}>
                <div style={{paddingTop:9}}>
                  <p style={{fontSize:12,fontWeight:600,color:P.textSub,margin:0}}>{keyLabel(s.setting_key)}</p>
                  <p style={{fontSize:10,color:P.muted,margin:'2px 0 0',fontFamily:'monospace'}}>{s.setting_key}</p>
                </div>
                {long?
                  <textarea value={current} rows={2} onChange={e=>setDrafts(d=>({...d,[s.id]:e.target.value}))}
                    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${dirty?P.orange:P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}}/>:
                  <input value={current} onChange={e=>setDrafts(d=>({...d,[s.id]:e.target.value}))}
                    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${dirty?P.orange:P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',boxSizing:'border-box'}}/>}
                <div style={{paddingTop:2,minWidth:96,textAlign:'right'}}>
                  {savedId===s.id?<span style={{fontSize:12,color:P.green,lineHeight:'34px'}}>✓ Guardado</span>:
                   dirty?<Btn style={{padding:'7px 14px',fontSize:12}} onClick={()=>save(s)} disabled={savingId===s.id}>{savingId===s.id?'…':'Guardar'}</Btn>:
                   <span style={{fontSize:11,color:P.border,lineHeight:'34px'}}>—</span>}
                </div>
              </div>
            })}
          </div>
        </GlassCard>
      })}
  </div>
}
