import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { P, TEMPLATES, fmtDate } from '../lib/constants.js'
import { Badge, GlassCard, Input, Btn, Lbl, Spinner, SHdr } from '../lib/ui.jsx'

export default function Emails({contacts,leads,staffProfile,user}){
  const[emails,setEmails]=useState([])
  const[loading,setLoading]=useState(true)
  const[tab,setTab]=useState('historial')
  const[showModal,setShowModal]=useState(false)
  const[sending,setSending]=useState(false)
  const[sent,setSent]=useState(null)
  const[form,setForm]=useState({template:'bienvenida_lead',source_id:'',extra_text:'',custom_subject:'',teams_url:''})
  const[files,setFiles]=useState([])
  const[dragOver,setDragOver]=useState(false)

  const loadHistory=useCallback(async()=>{
    setLoading(true)
    try{const{data}=await supabase.from('email_tracking').select('*').order('sent_at',{ascending:false}).limit(60);setEmails(data||[])}
    catch(e){console.error(e)}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{loadHistory()},[loadHistory])

  const sc={sent:P.blue,delivered:P.blue,opened:P.green,clicked:P.green,bounced:P.red,complained:P.red,delayed:P.orange}

  const allRecipients=useMemo(()=>[
    ...contacts.map(c=>({id:c.id,name:c.full_name,email:c.email,type:'contact'})),
    ...leads.filter(l=>!contacts.find(c=>c.email===l.email)).map(l=>({id:l.id,name:l.full_name,email:l.email,type:'lead'}))
  ].filter(r=>r.email),[contacts,leads])

  const selectedRecipient=useMemo(()=>allRecipients.find(r=>r.id===form.source_id),[allRecipients,form.source_id])
  const selectedTpl=useMemo(()=>TEMPLATES.find(t=>t.id===form.template)||TEMPLATES[0],[form.template])
  const needsSubject=form.template==='personalizado'
  const canSend=!!selectedRecipient&&!!form.template&&(!needsSubject||form.custom_subject)&&(form.template!=='personalizado'||form.extra_text)

  const handleFiles=async fileList=>{
    const arr=[]
    for(const f of fileList){
      if(f.size>5*1024*1024){alert(`${f.name} supera 5MB`);continue}
      const b64=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.readAsDataURL(f)})
      arr.push({filename:f.name,content:b64,size:f.size})
    }
    setFiles(p=>[...p,...arr])
  }

  const send=async()=>{
    if(!canSend)return
    setSending(true);setSent(null)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm_send_email`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({to:selectedRecipient.email,name:selectedRecipient.name,template_id:form.template,custom_subject:form.custom_subject,extra_text:form.extra_text,teams_url:form.teams_url,attachments:files.map(f=>({filename:f.filename,content:f.content}))})
      })
      const data=await res.json()
      if(data.ok){setSent({ok:true,msg:`✓ Enviado a ${selectedRecipient.email} · desde ${staffProfile?.pessaro_email||'info@pessaro.cl'}`});setForm({template:'bienvenida_lead',source_id:'',extra_text:'',custom_subject:'',teams_url:''});setFiles([]);loadHistory()}
      else setSent({ok:false,msg:data.error||'Error al enviar'})
    }catch(e){setSent({ok:false,msg:e.message})}
    setSending(false)
  }

  const openModal=(tplId)=>{setSent(null);if(tplId)setForm(p=>({...p,template:tplId}));setShowModal(true)}

  return <div>
    <SHdr title="Emails" sub={`${emails.length} enviados · ${staffProfile?.pessaro_email||'info@pessaro.cl'}`}
      action={<Btn variant="blue" onClick={()=>openModal()}>✉ Redactar</Btn>}/>
    <div style={{display:'flex',gap:8,marginBottom:20}}>
      {[['historial','📋 Historial'],['plantillas','🗂 Plantillas']].map(([id,label])=>(
        <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',background:tab===id?P.purpleDim:'rgba(255,255,255,0.04)',color:tab===id?P.purple:P.muted,border:`1px solid ${tab===id?P.purpleBorder:P.border}`,fontWeight:tab===id?600:400}}>{label}</button>
      ))}
    </div>
    {tab==='historial'&&(loading?<Spinner/>:<GlassCard style={{padding:0}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
          {['Destinatario','Plantilla','Estado','Enviado','Abierto'].map(h=><th key={h} style={{padding:'12px 18px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {emails.map((e,i)=><tr key={e.id} style={{borderBottom:i<emails.length-1?`1px solid ${P.border}`:'none'}}>
            <td style={{padding:'12px 18px'}}><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{e.recipient_name||e.recipient_email}</p><p style={{fontSize:11,color:P.muted,margin:0,fontFamily:'monospace'}}>{e.recipient_email}</p></td>
            <td style={{padding:'12px 18px'}}><Badge label={e.email_type||'—'} color={TEMPLATES.find(t=>t.id===e.email_type)?.color||P.muted}/></td>
            <td style={{padding:'12px 18px'}}><Badge label={e.status} color={sc[e.status]||P.muted}/></td>
            <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>{fmtDate(e.sent_at)}</td>
            <td style={{padding:'12px 18px',color:e.opened_at?P.green:P.muted,fontSize:12}}>{e.opened_at?fmtDate(e.opened_at):'—'}</td>
          </tr>)}
        </tbody>
      </table>
      {emails.length===0&&<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin emails enviados</div>}
    </GlassCard>)}
    {tab==='plantillas'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
      {TEMPLATES.map(t=><GlassCard key={t.id} style={{borderLeft:`3px solid ${t.color}`}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><div style={{width:8,height:8,borderRadius:'50%',background:t.color}}/><span style={{fontSize:14,fontWeight:600,color:P.text}}>{t.label}</span></div>
        <p style={{fontSize:12,color:P.muted,margin:'0 0 12px'}}>{t.desc}</p>
        <button onClick={()=>openModal(t.id)} style={{width:'100%',padding:'7px',borderRadius:6,fontSize:12,cursor:'pointer',background:t.color+'18',color:t.color,border:`1px solid ${t.color}30`,fontWeight:600}}>Usar plantilla →</button>
      </GlassCard>)}
    </div>}

    {showModal&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,width:'100%',maxWidth:620,maxHeight:'92vh',overflow:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:`1px solid ${P.border}`}}>
          <div><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:selectedTpl.color}}/><h3 style={{margin:0,fontSize:16,fontWeight:700,color:P.text}}>Redactar email</h3></div>
            {staffProfile&&<p style={{margin:'2px 0 0',fontSize:11,color:P.purple}}>Enviando como: <strong>{staffProfile.pessaro_email}</strong></p>}
          </div>
          <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:20}}>✕</button>
        </div>
        <div style={{padding:24,display:'flex',flexDirection:'column',gap:16}}>
          <div>
            <Lbl>Plantilla</Lbl>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {TEMPLATES.map(t=><button key={t.id} onClick={()=>setForm(p=>({...p,template:t.id}))}
                style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,background:form.template===t.id?t.color+'25':'rgba(255,255,255,0.04)',color:form.template===t.id?t.color:P.muted,border:`1px solid ${form.template===t.id?t.color+'60':P.border}`}}>{t.label}</button>)}
            </div>
          </div>
          <div>
            <Lbl>Destinatario *</Lbl>
            <select value={form.source_id} onChange={e=>setForm(p=>({...p,source_id:e.target.value}))}
              style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit'}}>
              <option value="">Seleccionar contacto o lead...</option>
              <optgroup label="── Contactos"><>{contacts.slice(0,100).map(c=><option key={c.id} value={c.id}>{c.full_name||c.email} · {c.email}</option>)}</></optgroup>
              <optgroup label="── Leads pipeline"><>{leads.filter(l=>!contacts.find(c=>c.email===l.email)).map(l=><option key={l.id} value={l.id}>{l.full_name||l.email} · {l.email}</option>)}</></optgroup>
            </select>
            {selectedRecipient&&<p style={{fontSize:11,color:P.muted,marginTop:4,margin:'4px 0 0',fontFamily:'monospace'}}>{selectedRecipient.email}</p>}
          </div>
          {needsSubject&&<div><Lbl>Asunto *</Lbl><Input value={form.custom_subject} onChange={v=>setForm(p=>({...p,custom_subject:v}))} placeholder="Asunto del email"/></div>}
          <div>
            <Lbl>{form.template==='personalizado'?'Mensaje *':'Texto adicional (opcional)'}</Lbl>
            <textarea value={form.extra_text} onChange={e=>setForm(p=>({...p,extra_text:e.target.value}))} placeholder={form.template==='personalizado'?'Escribe el mensaje completo...':'Añade un párrafo personalizado que se insertará en la plantilla...'}
              style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:12,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:100,resize:'vertical',fontFamily:'inherit'}}/>
          </div>
          <div>
            <Lbl>Link reunión Teams (opcional)</Lbl>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:18}}>🎥</span>
              <Input value={form.teams_url} onChange={v=>setForm(p=>({...p,teams_url:v}))} placeholder="https://teams.microsoft.com/l/meetup-join/..."/>
            </div>
            {form.teams_url&&<p style={{fontSize:11,color:'#60a5fa',marginTop:4,margin:'4px 0 0'}}>✓ Se añadirá botón "Unirse a la reunión" en el email</p>}
          </div>
          <div>
            <Lbl>Adjuntos (PDF, imágenes · máx. 5MB c/u)</Lbl>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files)}}
              style={{border:`2px dashed ${dragOver?P.purple:P.border}`,borderRadius:10,padding:'16px',textAlign:'center',background:dragOver?P.purpleDim:'rgba(255,255,255,0.02)',cursor:'pointer'}}
              onClick={()=>document.getElementById('fileInput').click()}>
              <p style={{fontSize:13,color:P.muted,margin:0}}>📎 Arrastra o <span style={{color:P.purple,fontWeight:600}}>haz clic</span></p>
              <input id="fileInput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx" style={{display:'none'}} onChange={e=>handleFiles(e.target.files)}/>
            </div>
            {files.length>0&&<div style={{marginTop:8}}>
              {files.map((f,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:6,marginBottom:4}}>
                <span style={{flex:1,fontSize:12,color:P.text}}>{f.filename}</span>
                <span style={{fontSize:11,color:P.muted}}>{(f.size/1024).toFixed(0)}KB</span>
                <button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:14}}>✕</button>
              </div>)}
            </div>}
          </div>
          {sent&&<div style={{padding:'10px 14px',borderRadius:8,background:sent.ok?P.greenDim:P.redDim,border:`1px solid ${sent.ok?P.green+'40':P.red+'40'}`,color:sent.ok?P.green:P.red,fontSize:13}}>{sent.msg}</div>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:4}}>
            <div style={{display:'flex',alignItems:'center',gap:6,background:selectedTpl.color+'15',border:`1px solid ${selectedTpl.color}30`,borderRadius:6,padding:'5px 12px'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:selectedTpl.color}}/><span style={{fontSize:11,color:selectedTpl.color,fontWeight:600}}>{selectedTpl.label}</span>
              {files.length>0&&<span style={{fontSize:11,color:P.muted}}>· {files.length} adj.</span>}
            </div>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancelar</Btn>
              <Btn variant="blue" onClick={send} disabled={sending||!canSend}>{sending?'Enviando...':'Enviar ✉'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>}
  </div>
}
