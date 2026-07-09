// ─── CONTENIDO WEB · Hub (solo super_admin) ──────────────────────────────────
// Módulo de unificación CMS→CRM. Lotes 1-3 completos: los 8 gestores activos.
import { useState } from 'react'
import { P } from './ui.jsx'
import BlogManager from './BlogManager.jsx'
import MediaLibrary from './MediaLibrary.jsx'
import FAQManager from './FAQManager.jsx'
import ServicesManager from './ServicesManager.jsx'
import InstrumentsManager from './InstrumentsManager.jsx'
import TeamWebManager from './TeamWebManager.jsx'
import PageContentManager from './PageContentManager.jsx'
import SiteSettings from './SiteSettings.jsx'

const TABS=[
  {id:'blog', label:'Blog',        icon:'📰', ready:true},
  {id:'media',label:'Media',       icon:'🖼', ready:true},
  {id:'faqs', label:'FAQs',        icon:'❓', ready:true},
  {id:'services',label:'Servicios',icon:'🧭', ready:true},
  {id:'instruments',label:'Instrumentos',icon:'📈', ready:true},
  {id:'teamweb',label:'Equipo Web',icon:'👥', ready:true},
  {id:'pages',label:'Páginas',     icon:'📄', ready:true},
  {id:'settings',label:'Ajustes',  icon:'⚙', ready:true},
]

export default function WebContentHub({isSuperAdmin}){
  const[tab,setTab]=useState('blog')
  if(!isSuperAdmin)return <div style={{padding:40,textAlign:'center',color:P.muted,fontSize:13}}>Acceso restringido a Super Admin.</div>
  return <div>
    <div style={{marginBottom:18}}>
      <h1 style={{fontSize:22,fontWeight:800,color:P.text,margin:'0 0 4px',letterSpacing:'-0.01em'}}>Contenido Web</h1>
      <p style={{fontSize:12,color:P.muted,margin:0}}>Gestión del contenido público de pessaro.cl · cambios publicados se reflejan de inmediato</p>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap',borderBottom:`1px solid ${P.border}`,paddingBottom:12}}>
      {TABS.map(t=>
        <button key={t.id} onClick={()=>t.ready&&setTab(t.id)} disabled={!t.ready}
          title={t.ready?'':'Disponible en el próximo lote'}
          style={{padding:'7px 14px',borderRadius:9,fontSize:12,fontFamily:'inherit',cursor:t.ready?'pointer':'not-allowed',
            fontWeight:tab===t.id?700:500,opacity:t.ready?1:0.35,
            background:tab===t.id?P.purpleDim:'rgba(255,255,255,0.04)',
            color:tab===t.id?P.purple:P.textSub,
            border:`1px solid ${tab===t.id?'rgba(108,92,231,0.4)':P.border}`}}>
          {t.icon} {t.label}{!t.ready&&' ·'}
        </button>)}
    </div>
    {tab==='blog'&&<BlogManager/>}
    {tab==='media'&&<MediaLibrary/>}
    {tab==='faqs'&&<FAQManager/>}
    {tab==='services'&&<ServicesManager/>}
    {tab==='instruments'&&<InstrumentsManager/>}
    {tab==='teamweb'&&<TeamWebManager/>}
    {tab==='pages'&&<PageContentManager/>}
    {tab==='settings'&&<SiteSettings/>}
  </div>
}
