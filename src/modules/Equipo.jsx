import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { P } from '../lib/constants.js'
import { GlassCard, Input, Btn, Modal, Lbl, Spinner, SHdr } from '../lib/ui.jsx'

export default function Equipo({user,isSuperAdmin}){
  const[staff,setStaff]=useState([])
  const[loading,setLoading]=useState(true)
  const[showInvite,setShowInvite]=useState(false)
  const[sending,setSending]=useState(false)
  const[result,setResult]=useState(null)
  const[form,setForm]=useState({email:'',display_name:'',title:'Asesor · Pessaro Capital',pessaro_email:'',phone:''})

  useEffect(()=>{
    const load=async()=>{
      setLoading(true)
      try{const{data}=await supabase.from('crm_staff_profiles').select('*').order('created_at');setStaff(data||[])}
      catch(e){console.error(e)}finally{setLoading(false)}
    };load()
  },[])

  const invite=async()=>{
    if(!form.email||!form.display_name)return
    setSending(true);setResult(null)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm_invite_user`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify(form)
      })
      const d=await res.json()
      if(d.ok){
        setResult({ok:true,msg:d.message})
        setStaff(p=>[...p,{id:d.user_id,user_id:d.user_id,display_name:form.display_name,title:form.title,pessaro_email:form.pessaro_email||form.email,phone:form.phone}])
        setForm({email:'',display_name:'',title:'Asesor · Pessaro Capital',pessaro_email:'',phone:''})
        setShowInvite(false)
      }else setResult({ok:false,msg:d.error||'Error al enviar'})
    }catch(e){setResult({ok:false,msg:e.message})}
    setSending(false)
  }

  return <div>
    <SHdr title="Equipo" sub={`${staff.length} miembros del equipo interno`}
      action={isSuperAdmin&&<Btn onClick={()=>setShowInvite(true)}>✉ Invitar miembro</Btn>}/>
    {result&&<div style={{marginBottom:16,padding:'10px 14px',borderRadius:8,background:result.ok?P.greenDim:P.redDim,border:`1px solid ${result.ok?P.green+'40':P.red+'40'}`,color:result.ok?P.green:P.red,fontSize:13}}>{result.msg}</div>}
    {loading?<Spinner/>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
      {staff.map(s=>(
        <GlassCard key={s.id} accent={P.purple}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
            <div style={{width:48,height:48,borderRadius:12,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:P.purple,flexShrink:0}}>{(s.display_name||'?')[0].toUpperCase()}</div>
            <div><p style={{fontSize:15,fontWeight:700,color:P.text,margin:0}}>{s.display_name}</p><p style={{fontSize:12,color:P.purple,margin:'2px 0 0'}}>{s.title}</p></div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {s.pessaro_email&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:`1px solid ${P.border}`}}><span style={{fontSize:12}}>✉</span><a href={`mailto:${s.pessaro_email}`} style={{fontSize:12,color:P.blue,textDecoration:'none',fontFamily:'monospace'}}>{s.pessaro_email}</a></div>}
            {s.phone&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:`1px solid ${P.border}`}}><span style={{fontSize:12}}>📞</span><span style={{fontSize:12,color:P.textSub}}>{s.phone}</span></div>}
          </div>
        </GlassCard>
      ))}
    </div>}
    {showInvite&&<Modal title="Invitar nuevo miembro" onClose={()=>setShowInvite(false)} accent={P.green}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{padding:'10px 14px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}>
          <p style={{fontSize:12,color:P.green,margin:0}}>Se enviará un email de invitación. El usuario hace clic en el enlace, establece su contraseña y accede al CRM.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Email personal *</Lbl><Input value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} placeholder="usuario@gmail.com" type="email"/></div>
          <div><Lbl>Nombre completo *</Lbl><Input value={form.display_name} onChange={v=>setForm(p=>({...p,display_name:v}))} placeholder="Juan García"/></div>
          <div><Lbl>Email @pessaro.cl</Lbl><Input value={form.pessaro_email} onChange={v=>setForm(p=>({...p,pessaro_email:v}))} placeholder="juan@pessaro.cl" type="email"/></div>
          <div><Lbl>Teléfono</Lbl><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+56 9 1234 5678"/></div>
          <div style={{gridColumn:'1/-1'}}><Lbl>Cargo</Lbl><Input value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Asesor · Pessaro Capital"/></div>
        </div>
        {result&&!result.ok&&<div style={{padding:'10px',background:P.redDim,border:`1px solid ${P.red}30`,borderRadius:8}}><p style={{fontSize:12,color:P.red,margin:0}}>{result.msg}</p></div>}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowInvite(false)}>Cancelar</Btn>
          <Btn onClick={invite} disabled={sending||!form.email||!form.display_name}>{sending?'Enviando...':'Enviar invitación ✉'}</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}
