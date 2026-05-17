import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { P } from '../lib/constants.js'
import { LOGO_URI } from '../lib/logo.js'
import { GlassCard, Input, Lbl, Btn } from '../lib/ui.jsx'

export default function Login({onLogin}){
  const[email,setEmail]=useState('')
  const[pass,setPass]=useState('')
  const[error,setError]=useState('')
  const[loading,setLoading]=useState(false)
  const handle=async()=>{
    if(!email||!pass)return
    setLoading(true);setError('')
    const{data,error:err}=await supabase.auth.signInWithPassword({email,password:pass})
    setLoading(false)
    if(err){setError(err.message);return}
    onLogin(data.user)
  }
  return <div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div style={{width:'100%',maxWidth:380}}>
      <div style={{textAlign:'center',marginBottom:36}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
          <img src={LOGO_URI} width={52} height={52} style={{borderRadius:10,display:'block'}} alt="Pessaro"/>
        </div>
        <h1 style={{fontSize:22,fontWeight:800,color:P.text,margin:'0 0 4px'}}>Pessaro Capital</h1>
        <p style={{color:P.purple,fontWeight:600,fontSize:14,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 6px'}}>CRM Interno</p>
        <p style={{color:P.muted,fontSize:13,margin:0}}>Acceso exclusivo para el equipo</p>
      </div>
      <GlassCard accent={P.purple}>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div><Lbl>Email</Lbl><Input value={email} onChange={setEmail} placeholder="tu@pessaro.cl" type="email"/></div>
          <div><Lbl>Contraseña</Lbl><Input value={pass} onChange={setPass} placeholder="••••••••" type="password"/></div>
          {error&&<div style={{fontSize:12,color:P.red,background:P.redDim,padding:'10px 12px',borderRadius:8,border:`1px solid ${P.red}30`}}>{error}</div>}
          <Btn onClick={handle} disabled={loading} style={{width:'100%',justifyContent:'center',padding:11}}>{loading?'Ingresando...':'Entrar al CRM'}</Btn>
        </div>
      </GlassCard>
      <p style={{textAlign:'center',marginTop:14,fontSize:11,color:P.muted}}>Usa tu cuenta de Pessaro Capital</p>
    </div>
  </div>
}
