import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const P = {
  bg:'#0d0f17',surface:'#13151f',card:'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  sidebar:'#0a0c16',border:'rgba(255,255,255,0.07)',text:'#f1f2f6',textSub:'#a4b0be',muted:'#636e72',
  purple:'#6c5ce7',purpleLight:'#a29bfe',purpleDim:'rgba(108,92,231,0.15)',purpleBorder:'rgba(108,92,231,0.3)',
  blue:'#0984e3',blueDim:'rgba(9,132,227,0.15)',green:'#00d084',greenDim:'rgba(0,208,132,0.12)',
  red:'#ff4757',redDim:'rgba(255,71,87,0.12)',orange:'#ffa502',orangeDim:'rgba(255,165,2,0.10)',
}
const ETAPA_STAGE={1:'lead',2:'contactado',3:'propuesta',4:'negociacion',5:'cerrado'}
const STAGE_ETAPA={lead:1,contactado:2,propuesta:3,negociacion:4,cerrado:5}
const STAGES=['lead','contactado','propuesta','negociacion','cerrado']
const STAGE_LABEL={lead:'Lead',contactado:'Contactado',propuesta:'Propuesta',negociacion:'Negociación',cerrado:'Cerrado'}
const STAGE_COLOR={lead:P.muted,contactado:P.blue,propuesta:P.orange,negociacion:P.purple,cerrado:P.green}
const STATUS_COLOR={new:P.orange,read:P.blue,replied:P.green,archived:P.muted}
const PRIO_COLOR={alta:P.red,media:P.orange,baja:P.green}
const fmt=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0)
const fmtDate=d=>d?new Date(d).toLocaleDateString('es-CL'):'—'

function Badge({label,color}){return<span style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',background:color+'20',color,border:`1px solid ${color}35`}}>{label}</span>}
function GlassCard({children,style={},accent}){return<div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:14,padding:20,position:'relative',overflow:'hidden',...style}}>{accent&&<div style={{position:'absolute',top:-30,right:-30,width:100,height:100,background:`radial-gradient(circle,${accent}25,transparent 70%)`,borderRadius:'50%',pointerEvents:'none'}}/>}{children}</div>}
function StatCard({label,value,sub,Icon,accent=P.purple}){return<GlassCard accent={accent} style={{flex:1,minWidth:150}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em'}}>{label}</p><div style={{width:28,height:28,borderRadius:8,background:accent+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>{Icon}</div></div><div style={{display:'inline-flex',background:accent+'18',border:`1px solid ${accent}35`,borderRadius:8,padding:'5px 12px',marginBottom:sub?6:0}}><span style={{fontSize:16,fontWeight:700,color:accent,fontFamily:"'JetBrains Mono',monospace"}}>{value}</span></div>{sub&&<p style={{fontSize:11,color:P.muted,marginTop:4}}>{sub}</p>}</GlassCard>}
function Input({value,onChange,placeholder,type='text',style={}}){return<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',...style}}/>}
function Sel({value,onChange,options,style={}}){return<select value={value} onChange={e=>onChange(e.target.value)} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',...style}}>{options.map(o=><option key={o.value} value={o.value} style={{background:P.surface}}>{o.label}</option>)}</select>}
function Btn({children,onClick,variant='primary',style={},disabled=false}){const vs={primary:{background:`linear-gradient(135deg,#7c6fee,${P.purple})`,color:'#fff',border:'none',fontWeight:600,boxShadow:`0 4px 14px ${P.purple}40`},ghost:{background:'rgba(255,255,255,0.04)',color:P.textSub,border:`1px solid ${P.border}`,fontWeight:500},blue:{background:`linear-gradient(135deg,#1a9bff,${P.blue})`,color:'#fff',border:'none',fontWeight:600},danger:{background:P.redDim,color:P.red,border:`1px solid ${P.red}35`,fontWeight:500}};return<button onClick={onClick} disabled={disabled} style={{padding:'9px 16px',borderRadius:8,fontSize:13,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,display:'inline-flex',alignItems:'center',gap:6,...vs[variant],...style}}>{children}</button>}
function Modal({title,onClose,children,accent=P.purple}){return<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}><div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,width:'100%',maxWidth:520,maxHeight:'90vh',overflow:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.5)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:`1px solid ${P.border}`}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:accent}}/><h3 style={{margin:0,fontSize:16,fontWeight:700,color:P.text}}>{title}</h3></div><button onClick={onClose} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:20}}>✕</button></div><div style={{padding:24}}>{children}</div></div></div>}
function Lbl({children}){return<label style={{fontSize:11,color:P.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>{children}</label>}
function Spinner(){return<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:48}}><div style={{width:28,height:28,border:`3px solid ${P.border}`,borderTop:`3px solid ${P.purple}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>}
function SHdr({title,sub,action}){return<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}><div><h2 style={{fontSize:20,fontWeight:700,color:P.text,marginBottom:4}}>{title}</h2>{sub&&<p style={{fontSize:13,color:P.muted}}>{sub}</p>}</div>{action}</div>}
function Logo({size=28}){return<img src="data:image/webp;base64,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RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5mYXZpY29uLTI1NiAtIEljb25vIFBlc3Nhcm8gQ2FwaXRhbCA8L3JkZjpsaT4KICAgPC9yZGY6QWx0PgogIDwvZGM6dGl0bGU+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgPHBkZjpBdXRob3I+RnJhbmNpc2NvIFJvamFzPC9wZGY6QXV0aG9yPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczp4bXA9J2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8nPgogIDx4bXA6Q3JlYXRvclRvb2w+Q2FudmEgZG9jPURBSEJDSFZaZ0xVIHVzZXI9VUFDZHdIZFdBRjAgYnJhbmQ9VmVydGljMyB0ZW1wbGF0ZT1CbHVlIE1vZGVybiBQcm9mZXNzaW9uYWwgTGV0dGVyIEsgTG9nbzwveG1wOkNyZWF0b3JUb29sPgogPC9yZGY6RGVzY3JpcHRpb24+CjwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cjw/eHBhY2tldCBlbmQ9J3InPz4A" width={size} height={size} alt="Pessaro Capital" style={{borderRadius:size*0.18,objectFit:'cover',display:'block'}}/>}
const tt={contentStyle:{background:P.surface,border:`1px solid ${P.border}`,borderRadius:8,color:P.text,fontSize:12}}

// ── LOGIN ──────────────────────────────────────────────────────────────────────
function Login({onLogin}){
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
  return<div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div style={{width:'100%',maxWidth:380}}>
      <div style={{textAlign:'center',marginBottom:36}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:16}}><Logo size={52}/></div>
        <h1 style={{fontSize:22,fontWeight:800,color:P.text,margin:'0 0 4px'}}>Pessaro Capital</h1>
        <p style={{color:P.purple,fontWeight:600,fontSize:14,letterSpacing:'0.08em',textTransform:'uppercase'}}>CRM Interno</p>
        <p style={{color:P.muted,marginTop:6,fontSize:13}}>Acceso exclusivo para el equipo</p>
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

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({contacts,leads}){
  const newC=contacts.filter(c=>c.status==='new').length
  const closedL=leads.filter(l=>l.etapa===5).length
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital)||0),0)
  const pipeData=STAGES.map(s=>({name:STAGE_LABEL[s],v:leads.filter(l=>ETAPA_STAGE[l.etapa]===s).length}))
  return<div>
    <SHdr title="Dashboard" sub="Datos en tiempo real desde Supabase"/>
    <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
      <StatCard label="Formularios" value={contacts.length} sub={`${newC} sin leer`} accent={P.purple} Icon="📋"/>
      <StatCard label="Leads pipeline" value={leads.length} sub={`${closedL} cerrados`} accent={P.blue} Icon="◈"/>
      <StatCard label="Capital declarado" value={fmt(totalCap)} accent={P.green} Icon="💵"/>
      <StatCard label="Tasa cierre" value={leads.length?`${Math.round(closedL/leads.length*100)}%`:'—'} accent={P.orange} Icon="🎯"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16}}>Pipeline por etapa</p>
        <ResponsiveContainer width="100%" height={180}><BarChart data={pipeData} barSize={28}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...tt} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.purple} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
      </GlassCard>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16}}>Estado formularios</p>
        {[['new','Sin leer',P.orange],['read','Leídos',P.blue],['replied','Respondidos',P.green],['archived','Archivados',P.muted]].map(([s,l,c])=>{
          const count=contacts.filter(x=>x.status===s).length
          return<div key={s} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13,color:P.textSub}}>{l}</span><span style={{fontSize:13,fontFamily:'monospace',color:c,fontWeight:600}}>{count}</span></div>
            <div style={{background:'rgba(255,255,255,0.06)',borderRadius:2,height:4}}><div style={{background:c,height:4,borderRadius:2,width:`${contacts.length?count/contacts.length*100:0}%`,transition:'width 0.6s'}}/></div>
          </div>
        })}
      </GlassCard>
    </div>
    <GlassCard>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16}}>Últimos formularios</p>
      {contacts.slice(0,5).map((c,i)=><div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<4?`1px solid ${P.border}`:'none'}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{width:30,height:30,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:P.purple}}>{(c.full_name||'?')[0]}</div>
          <div><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{c.full_name}</p><p style={{fontSize:11,color:P.muted,margin:0}}>{c.email}</p></div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {c.investment_capital>0&&<span style={{fontSize:12,fontFamily:'monospace',color:P.green}}>{fmt(c.investment_capital)}</span>}
          <Badge label={c.status} color={STATUS_COLOR[c.status]||P.muted}/>
        </div>
      </div>)}
      {contacts.length===0&&<p style={{color:P.muted,fontSize:13}}>Sin formularios aún</p>}
    </GlassCard>
  </div>
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────
function Contacts({contacts,setContacts,loading}){
  const[search,setSearch]=useState('')
  const[filter,setFilter]=useState('todos')
  const[selected,setSelected]=useState(null)
  const[notes,setNotes]=useState([])
  const[note,setNote]=useState('')
  const[saving,setSaving]=useState(false)
  const filtered=contacts.filter(c=>`${c.full_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())&&(filter==='todos'||c.status===filter))
  const updateStatus=async(id,status)=>{
    setSaving(true)
    await supabase.from('contact_submissions').update({status,updated_at:new Date().toISOString()}).eq('id',id)
    setContacts(p=>p.map(c=>c.id===id?{...c,status}:c))
    if(selected?.id===id)setSelected(p=>({...p,status}))
    setSaving(false)
  }
  const openContact=async c=>{
    setSelected(c);setNotes([]);setNote('')
    const{data}=await supabase.from('crm_notes').select('*').eq('contact_submission_id',c.id).order('created_at',{ascending:false})
    setNotes(data||[])
    if(c.status==='new')updateStatus(c.id,'read')
  }
  const addNote=async()=>{
    if(!note.trim()||!selected)return
    const{data}=await supabase.from('crm_notes').insert({content:note,contact_submission_id:selected.id}).select().single()
    if(data){setNotes(p=>[data,...p]);setNote('')}
  }
  return<div>
    <SHdr title="Contactos" sub={`${contacts.length} formularios · ${contacts.filter(c=>c.status==='new').length} sin leer`}/>
    <div style={{display:'flex',gap:10,marginBottom:16}}>
      <Input value={search} onChange={setSearch} placeholder="Buscar nombre o email..." style={{maxWidth:300}}/>
      <Sel value={filter} onChange={setFilter} style={{maxWidth:160}} options={[{value:'todos',label:'Todos'},{value:'new',label:'Sin leer'},{value:'read',label:'Leídos'},{value:'replied',label:'Respondidos'},{value:'archived',label:'Archivados'}]}/>
    </div>
    {loading?<Spinner/>:<GlassCard style={{padding:0}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
          {['Nombre','Email','Capital','Estado','Fecha',''].map(h=><th key={h} style={{padding:'12px 18px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.map((c,i)=><tr key={c.id} style={{borderBottom:i<filtered.length-1?`1px solid ${P.border}`:'none',cursor:'pointer',background:c.status==='new'?'rgba(108,92,231,0.05)':'transparent'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
            onMouseLeave={e=>e.currentTarget.style.background=c.status==='new'?'rgba(108,92,231,0.05)':'transparent'}
            onClick={()=>openContact(c)}>
            <td style={{padding:'12px 18px'}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:30,height:30,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:P.purple,flexShrink:0}}>{(c.full_name||'?')[0]}</div><div><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{c.full_name}</p>{c.mobile&&<p style={{fontSize:11,color:P.muted,margin:0}}>{c.mobile}</p>}</div></div></td>
            <td style={{padding:'12px 18px',color:P.muted,fontSize:12,fontFamily:'monospace'}}>{c.email}</td>
            <td style={{padding:'12px 18px',color:P.green,fontSize:13,fontFamily:'monospace',fontWeight:600}}>{c.investment_capital>0?fmt(c.investment_capital):'—'}</td>
            <td style={{padding:'12px 18px'}}><Badge label={c.status} color={STATUS_COLOR[c.status]||P.muted}/></td>
            <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>{fmtDate(c.submitted_at)}</td>
            <td style={{padding:'12px 18px'}}><Btn variant="ghost" style={{padding:'4px 10px',fontSize:11}}>Ver →</Btn></td>
          </tr>)}
        </tbody>
      </table>
      {filtered.length===0&&<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin resultados</div>}
    </GlassCard>}
    {selected&&<Modal title={selected.full_name} onClose={()=>setSelected(null)}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={selected.status} color={STATUS_COLOR[selected.status]||P.muted}/>
          {selected.investment_capital>0&&<div style={{display:'inline-flex',background:'rgba(0,208,132,0.12)',border:'1px solid rgba(0,208,132,0.3)',borderRadius:8,padding:'2px 10px'}}><span style={{fontSize:13,fontWeight:700,color:P.green,fontFamily:'monospace'}}>{fmt(selected.investment_capital)}</span></div>}
        </div>
        {[['Email',selected.email],['Teléfono',selected.mobile||'—'],['Gestión',selected.management_type||'—'],['Fecha',fmtDate(selected.submitted_at)]].map(([k,v])=><div key={k} style={{paddingBottom:12,marginBottom:12,borderBottom:`1px solid ${P.border}`}}><p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:4,fontWeight:600}}>{k}</p><p style={{fontSize:13,color:P.text,margin:0}}>{v}</p></div>)}
        {selected.comments&&<div style={{marginBottom:16,padding:12,background:'rgba(255,255,255,0.03)',borderRadius:8,border:`1px solid ${P.border}`}}><p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:6,fontWeight:600}}>Comentarios</p><p style={{fontSize:13,color:P.textSub,margin:0,lineHeight:1.6}}>{selected.comments}</p></div>}
        <div style={{marginBottom:20}}><Lbl>Cambiar estado</Lbl>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {['new','read','replied','archived'].map(s=><button key={s} onClick={()=>updateStatus(selected.id,s)} disabled={saving} style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,background:selected.status===s?STATUS_COLOR[s]+'30':'rgba(255,255,255,0.04)',color:selected.status===s?STATUS_COLOR[s]:P.muted,border:`1px solid ${selected.status===s?STATUS_COLOR[s]+'50':P.border}`}}>{s==='new'?'Sin leer':s==='read'?'Leído':s==='replied'?'Respondido':'Archivado'}</button>)}
          </div>
        </div>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:P.purple,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:10}}>Notas ({notes.length})</p>
          {notes.map(n=><div key={n.id} style={{padding:'10px 12px',marginBottom:8,background:'rgba(108,92,231,0.08)',borderRadius:8,borderLeft:`3px solid ${P.purple}`}}><p style={{fontSize:13,color:P.textSub,margin:'0 0 4px',lineHeight:1.6}}>{n.content}</p><p style={{fontSize:10,color:P.muted,margin:0}}>{fmtDate(n.created_at)}</p></div>)}
          <div style={{display:'flex',gap:8,marginTop:10}}><Input value={note} onChange={setNote} placeholder="Añadir nota..." style={{flex:1}}/><Btn onClick={addNote} disabled={!note.trim()}>+</Btn></div>
        </div>
      </div>
    </Modal>}
  </div>
}

// ── PIPELINE ──────────────────────────────────────────────────────────────────
function Pipeline({leads,setLeads,loading}){
  const[selected,setSelected]=useState(null)
  const[saving,setSaving]=useState(false)
  const move=async(id,newEtapa)=>{
    setSaving(true)
    const u={etapa:newEtapa,advisor_contacted:newEtapa>=2,account_created:newEtapa>=3,kyc_verified:newEtapa>=4,deposit_confirmed:newEtapa>=5,updated_at:new Date().toISOString()}
    await supabase.from('campaign_leads').update(u).eq('id',id)
    setLeads(p=>p.map(l=>l.id===id?{...l,...u}:l))
    if(selected?.id===id)setSelected(p=>({...p,...u}))
    setSaving(false)
  }
  return<div>
    <SHdr title="Pipeline de Leads" sub={`${leads.length} leads en pipeline de conversión`}/>
    {loading?<Spinner/>:<div style={{display:'flex',gap:14,overflowX:'auto',paddingBottom:12}}>
      {STAGES.map(stage=>{
        const etapa=STAGE_ETAPA[stage]
        const staged=leads.filter(l=>l.etapa===etapa)
        const color=STAGE_COLOR[stage]
        return<div key={stage} style={{minWidth:200,flex:1}}>
          <div style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:6,height:6,borderRadius:'50%',background:color}}/><span style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.06em'}}>{STAGE_LABEL[stage]}</span></div>
            <span style={{fontSize:11,color:P.muted}}>{staged.length}</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {staged.map(lead=><GlassCard key={lead.id} style={{padding:14,borderLeft:`3px solid ${color}`,cursor:'pointer'}} onClick={()=>setSelected(lead)}>
              <p style={{fontSize:13,fontWeight:600,color:P.text,margin:'0 0 2px'}}>{lead.full_name}</p>
              <p style={{fontSize:11,color:P.muted,margin:'0 0 8px',fontFamily:'monospace'}}>{lead.email}</p>
              {lead.investment_range&&<div style={{display:'inline-flex',background:'rgba(0,208,132,0.12)',border:'1px solid rgba(0,208,132,0.3)',borderRadius:4,padding:'2px 8px',marginBottom:8}}><span style={{fontSize:11,color:P.green,fontWeight:600}}>{lead.investment_range}</span></div>}
              <div style={{background:'rgba(255,255,255,0.07)',borderRadius:2,height:3,marginBottom:8}}><div style={{background:color,height:3,borderRadius:2,width:`${(etapa/5)*100}%`}}/></div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {etapa>1&&<button onClick={e=>{e.stopPropagation();move(lead.id,etapa-1)}} disabled={saving} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`,cursor:'pointer'}}>← Anterior</button>}
                {etapa<5&&<button onClick={e=>{e.stopPropagation();move(lead.id,etapa+1)}} disabled={saving} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:STAGE_COLOR[STAGES[etapa]]+'18',color:STAGE_COLOR[STAGES[etapa]],border:`1px solid ${STAGE_COLOR[STAGES[etapa]]}30`,cursor:'pointer'}}>→ {STAGE_LABEL[STAGES[etapa]]}</button>}
              </div>
            </GlassCard>)}
            {staged.length===0&&<div style={{border:`1px dashed ${P.border}`,borderRadius:12,padding:'20px 14px',textAlign:'center',fontSize:12,color:P.muted}}>Sin leads</div>}
          </div>
        </div>
      })}
    </div>}
    {selected&&<Modal title={selected.full_name} onClose={()=>setSelected(null)} accent={STAGE_COLOR[ETAPA_STAGE[selected.etapa]]}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={STAGE_LABEL[ETAPA_STAGE[selected.etapa]]} color={STAGE_COLOR[ETAPA_STAGE[selected.etapa]]}/>
          {selected.investment_range&&<Badge label={selected.investment_range} color={P.green}/>}
          {selected.team&&<Badge label={selected.team} color={P.blue}/>}
        </div>
        {[['Email',selected.email],['Teléfono',selected.phone||'—'],['Asesor',selected.advisor_assigned||'Sin asignar'],['Score',selected.score||0],['Registro',fmtDate(selected.created_at)]].map(([k,v])=><div key={k} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${P.border}`}}><p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:3,fontWeight:600}}>{k}</p><p style={{fontSize:13,color:P.text,margin:0}}>{String(v)}</p></div>)}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
          {[['Contactado',selected.advisor_contacted],['Cuenta',selected.account_created],['KYC',selected.kyc_verified],['Depósito',selected.deposit_confirmed]].map(([k,v])=><div key={k} style={{padding:'8px 12px',borderRadius:8,background:v?'rgba(0,208,132,0.12)':'rgba(255,255,255,0.03)',border:`1px solid ${v?'rgba(0,208,132,0.3)':P.border}`}}><p style={{fontSize:10,color:P.muted,margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</p><p style={{fontSize:13,fontWeight:700,color:v?P.green:P.muted,margin:0}}>{v?'✓ Sí':'—'}</p></div>)}
        </div>
      </div>
    </Modal>}
  </div>
}

// ── TASKS ─────────────────────────────────────────────────────────────────────
function Tasks({contacts,leads}){
  const[tasks,setTasks]=useState([])
  const[loading,setLoading]=useState(true)
  const[showAdd,setShowAdd]=useState(false)
  const[form,setForm]=useState({title:'',priority:'media',due_date:'',contact_submission_id:'',campaign_lead_id:''})
  const load=useCallback(async()=>{setLoading(true);const{data}=await supabase.from('crm_tasks').select('*').order('created_at',{ascending:false});setTasks(data||[]);setLoading(false)},[])
  useEffect(()=>{load()},[load])
  const addTask=async()=>{
    if(!form.title)return
    const p={...form,done:false}
    if(!p.contact_submission_id)delete p.contact_submission_id
    if(!p.campaign_lead_id)delete p.campaign_lead_id
    const{data}=await supabase.from('crm_tasks').insert(p).select().single()
    if(data){setTasks(p=>[data,...p]);setShowAdd(false);setForm({title:'',priority:'media',due_date:'',contact_submission_id:'',campaign_lead_id:''})}
  }
  const toggle=async(id,done)=>{await supabase.from('crm_tasks').update({done:!done}).eq('id',id);setTasks(p=>p.map(t=>t.id===id?{...t,done:!done}:t))}
  const del=async id=>{await supabase.from('crm_tasks').delete().eq('id',id);setTasks(p=>p.filter(t=>t.id!==id))}
  const getName=t=>{if(t.contact_submission_id)return contacts.find(c=>c.id===t.contact_submission_id)?.full_name||'';if(t.campaign_lead_id)return leads.find(l=>l.id===t.campaign_lead_id)?.full_name||'';return''}
  const pending=tasks.filter(t=>!t.done),done=tasks.filter(t=>t.done)
  return<div>
    <SHdr title="Tareas" sub={`${pending.length} pendientes · ${done.length} completadas`} action={<Btn onClick={()=>setShowAdd(true)}>+ Nueva tarea</Btn>}/>
    {loading?<Spinner/>:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      <div>
        <p style={{fontSize:10,fontWeight:700,color:P.orange,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14}}>● Pendientes ({pending.length})</p>
        {pending.map(t=><GlassCard key={t.id} style={{marginBottom:10,display:'flex',gap:12,alignItems:'flex-start',borderLeft:`3px solid ${PRIO_COLOR[t.priority]}`}}>
          <button onClick={()=>toggle(t.id,t.done)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${PRIO_COLOR[t.priority]}`,background:'transparent',cursor:'pointer',flexShrink:0,marginTop:2}}/>
          <div style={{flex:1}}><p style={{fontSize:14,fontWeight:500,color:P.text,margin:'0 0 6px'}}>{t.title}</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              {getName(t)&&<span style={{fontSize:11,color:P.muted}}>{getName(t)}</span>}
              <Badge label={t.priority} color={PRIO_COLOR[t.priority]}/>
              {t.due_date&&<span style={{fontSize:11,color:P.muted}}>{fmtDate(t.due_date)}</span>}
            </div>
          </div>
          <button onClick={()=>del(t.id)} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:14}}>✕</button>
        </GlassCard>)}
        {pending.length===0&&<div style={{padding:'20px 0',display:'flex',alignItems:'center',gap:8}}><div style={{width:8,height:8,borderRadius:'50%',background:P.green}}/><span style={{color:P.green,fontSize:13,fontWeight:500}}>¡Todo al día!</span></div>}
      </div>
      <div>
        <p style={{fontSize:10,fontWeight:700,color:P.green,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14}}>● Completadas ({done.length})</p>
        {done.map(t=><GlassCard key={t.id} style={{marginBottom:10,opacity:0.4}}><div style={{display:'flex',gap:10,alignItems:'center'}}><div style={{width:20,height:20,borderRadius:6,background:P.green,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',fontSize:10,fontWeight:700}}>✓</div><span style={{fontSize:14,textDecoration:'line-through',color:P.muted}}>{t.title}</span></div></GlassCard>)}
      </div>
    </div>}
    {showAdd&&<Modal title="Nueva tarea" onClose={()=>setShowAdd(false)} accent={P.orange}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div><Lbl>Título *</Lbl><Input value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Descripción de la tarea"/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Prioridad</Lbl><Sel value={form.priority} onChange={v=>setForm(p=>({...p,priority:v}))} options={[{value:'alta',label:'Alta'},{value:'media',label:'Media'},{value:'baja',label:'Baja'}]}/></div>
          <div><Lbl>Fecha límite</Lbl><Input value={form.due_date} onChange={v=>setForm(p=>({...p,due_date:v}))} type="date"/></div>
        </div>
        <div><Lbl>Contacto</Lbl><Sel value={form.contact_submission_id} onChange={v=>setForm(p=>({...p,contact_submission_id:v}))} options={[{value:'',label:'Sin contacto'},...contacts.map(c=>({value:c.id,label:c.full_name||c.email}))]}/></div>
        <div><Lbl>Lead (pipeline)</Lbl><Sel value={form.campaign_lead_id} onChange={v=>setForm(p=>({...p,campaign_lead_id:v}))} options={[{value:'',label:'Sin lead'},...leads.map(l=>({value:l.id,label:l.full_name||l.email}))]}/></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}><Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn><Btn onClick={addTask} disabled={!form.title}>Guardar</Btn></div>
      </div>
    </Modal>}
  </div>
}

// ── EMAILS ────────────────────────────────────────────────────────────────────
function Emails(){
  const[emails,setEmails]=useState([])
  const[loading,setLoading]=useState(true)
  const[tab,setTab]=useState('tracking')
  useEffect(()=>{
    const load=async()=>{
      setLoading(true)
      if(tab==='tracking'){const{data}=await supabase.from('email_tracking').select('*').order('sent_at',{ascending:false}).limit(50);setEmails(data||[])}
      else{const{data}=await supabase.from('followup_emails_sent').select('*').order('sent_at',{ascending:false}).limit(50);setEmails(data||[])}
      setLoading(false)
    }
    load()
  },[tab])
  const sc={sent:P.blue,delivered:P.blue,opened:P.green,clicked:P.green,bounced:P.red,complained:P.red,delayed:P.orange}
  return<div>
    <SHdr title="Emails" sub="Historial Resend en tiempo real"/>
    <div style={{display:'flex',gap:8,marginBottom:18}}>
      {[['tracking','Email tracking'],['followup','Seguimientos']].map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',background:tab===id?P.purpleDim:'rgba(255,255,255,0.04)',color:tab===id?P.purple:P.muted,border:`1px solid ${tab===id?P.purpleBorder:P.border}`,fontWeight:tab===id?600:400}}>{label}</button>)}
    </div>
    {loading?<Spinner/>:<GlassCard style={{padding:0}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
          {(tab==='tracking'?['Destinatario','Asunto','Tipo','Estado','Enviado','Abierto']:['Email','Tipo','Enviado']).map(h=><th key={h} style={{padding:'12px 18px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {emails.map((e,i)=><tr key={e.id} style={{borderBottom:i<emails.length-1?`1px solid ${P.border}`:'none'}}>
            {tab==='tracking'?<>
              <td style={{padding:'12px 18px'}}><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{e.recipient_name||e.recipient_email}</p><p style={{fontSize:11,color:P.muted,margin:0,fontFamily:'monospace'}}>{e.recipient_email}</p></td>
              <td style={{padding:'12px 18px',color:P.textSub,fontSize:12}}>{e.subject||'—'}</td>
              <td style={{padding:'12px 18px'}}><Badge label={e.email_type||'—'} color={P.blue}/></td>
              <td style={{padding:'12px 18px'}}><Badge label={e.status} color={sc[e.status]||P.muted}/></td>
              <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>{fmtDate(e.sent_at)}</td>
              <td style={{padding:'12px 18px',color:e.opened_at?P.green:P.muted,fontSize:12}}>{e.opened_at?fmtDate(e.opened_at):'—'}</td>
            </>:<>
              <td style={{padding:'12px 18px',color:P.text,fontSize:13,fontFamily:'monospace'}}>{e.email}</td>
              <td style={{padding:'12px 18px'}}><Badge label={e.form_type||'—'} color={P.purple}/></td>
              <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>{fmtDate(e.sent_at)}</td>
            </>}
          </tr>)}
        </tbody>
      </table>
      {emails.length===0&&<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>Sin registros</div>}
    </GlassCard>}
  </div>
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
function Reports({contacts,leads}){
  const closedL=leads.filter(l=>l.etapa===5).length
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital)||0),0)
  const pipeData=STAGES.map(s=>({name:STAGE_LABEL[s],v:leads.filter(l=>ETAPA_STAGE[l.etapa]===s).length}))
  const capData=['1k-5k','5k-20k','20k-50k','50k+'].map(r=>({name:r,v:leads.filter(l=>l.investment_range===r).length}))
  return<div>
    <SHdr title="Reportes" sub="Analíticas en tiempo real"/>
    <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
      <StatCard label="Formularios" value={contacts.length} accent={P.purple} Icon="📋"/>
      <StatCard label="Capital declarado" value={fmt(totalCap)} accent={P.green} Icon="💵"/>
      <StatCard label="Leads totales" value={leads.length} accent={P.blue} Icon="◈"/>
      <StatCard label="Cerrados" value={closedL} accent={P.orange} Icon="✓"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
      <GlassCard><p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16}}>Leads por etapa</p>
        <ResponsiveContainer width="100%" height={190}><BarChart data={pipeData} barSize={24}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...tt} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.purple} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
      </GlassCard>
      <GlassCard><p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16}}>Leads por capital</p>
        <ResponsiveContainer width="100%" height={190}><BarChart data={capData} barSize={24}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...tt} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.blue} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
      </GlassCard>
    </div>
    <GlassCard>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16}}>Conversión del pipeline</p>
      <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
        {[['Contactados',leads.filter(l=>l.advisor_contacted).length,P.blue],['Cuenta creada',leads.filter(l=>l.account_created).length,P.purple],['KYC verificado',leads.filter(l=>l.kyc_verified).length,P.orange],['Depósito',leads.filter(l=>l.deposit_confirmed).length,P.green]].map(([k,v,c])=><div key={k} style={{flex:1,minWidth:110,textAlign:'center',padding:'18px 10px',borderRadius:12,background:`${c}10`,border:`1px solid ${c}25`}}><div style={{fontSize:30,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</div><div style={{fontSize:11,color:P.muted,marginTop:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>{k}</div></div>)}
      </div>
    </GlassCard>
  </div>
}


// ── CAMPAÑA ───────────────────────────────────────────────────────────────────
function Campana({leads}){
  const[config,setConfig]=useState({})
  const[referrals,setReferrals]=useState([])
  const[tiers,setTiers]=useState([])
  const[loading,setLoading]=useState(true)
  const[selected,setSelected]=useState(null)
  const[saving,setSaving]=useState(false)

  useEffect(()=>{
    const load=async()=>{
      setLoading(true)
      const[{data:cfg},{data:ref},{data:t}]=await Promise.all([
        supabase.from('campaign_config').select('*'),
        supabase.from('campaign_referrals').select('*'),
        supabase.from('campaign_bonus_tiers').select('*').order('min_referrals')
      ])
      const cfgMap={}
      ;(cfg||[]).forEach(r=>cfgMap[r.key]=r.value)
      setConfig(cfgMap)
      setReferrals(ref||[])
      setTiers(t||[])
      setLoading(false)
    }
    load()
  },[])

  const totalSpots=Number(config.total_spots||50)
  const spotsTaken=Number(config.spots_taken||0)
  const depositados=leads.filter(l=>l.deposit_confirmed)
  const totalCapital=depositados.reduce((s,l)=>s+(Number(l.deposit_amount_usd)||0),0)
  const getReferidos=lead=>referrals.filter(r=>r.referrer_code===lead?.referral_code&&r.is_valid).length

  const updateLead=async(id,updates)=>{
    setSaving(true)
    await supabase.from('campaign_leads').update({...updates,updated_at:new Date().toISOString()}).eq('id',id)
    if(selected?.id===id)setSelected(p=>({...p,...updates}))
    setSaving(false)
  }

  const sorted=[...leads].sort((a,b)=>b.score-a.score)

  const etapaLabel={1:'Registro',2:'Contactado',3:'Cuenta',4:'KYC',5:'Depósito'}
  const etapaColor={1:P.muted,2:P.blue,3:P.orange,4:P.purple,5:P.green}
  const teamColor={radex:'#e74c3c',tradeview:'#3498db'}

  return<div>
    <SHdr title="Campaña Q2" sub={`${leads.length} leads · ${depositados.length} depósitos confirmados`}/>

    {/* KPIs */}
    <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
      <StatCard label="Capital levantado" value={`$${(totalCapital/1000).toFixed(0)}k`} sub={`${depositados.length} depósitos`} accent={P.green} Icon="💵"/>
      <StatCard label="Cupos tomados" value={`${spotsTaken}/${totalSpots}`} sub={`${totalSpots-spotsTaken} disponibles`} accent={P.purple} Icon="🎯"/>
      <StatCard label="Total leads" value={leads.length} sub="en pipeline" accent={P.blue} Icon="👥"/>
      <StatCard label="Campaña" value={config.campaign_active==='true'?'Activa':'Pausada'} accent={config.campaign_active==='true'?P.green:P.orange} Icon="📡"/>
    </div>

    {/* Progreso cupos */}
    <GlassCard style={{marginBottom:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <p style={{fontSize:12,fontWeight:600,color:P.textSub}}>Cupos disponibles</p>
        <span style={{fontSize:13,fontFamily:'monospace',color:P.purple,fontWeight:700}}>{spotsTaken} / {totalSpots}</span>
      </div>
      <div style={{background:'rgba(255,255,255,0.07)',borderRadius:6,height:10}}>
        <div style={{background:`linear-gradient(90deg,${P.purple},${P.blue})`,height:10,borderRadius:6,width:`${(spotsTaken/totalSpots)*100}%`,transition:'width 0.6s'}}/>
      </div>
      <div style={{display:'flex',gap:20,marginTop:14,flexWrap:'wrap'}}>
        {[['Retorno histórico',`${config.historical_return_pct||502}%`,P.green],
          ['Pts registro',config.pts_registro||10,P.blue],
          ['Pts referido',config.pts_referido||20,P.purple],
          ['Bonus expiry',`${config.bonus_expiry_days||30}d`,P.orange]].map(([k,v,c])=>(
          <div key={k} style={{flex:1,minWidth:100,textAlign:'center',padding:'10px 8px',borderRadius:8,background:`${c}10`,border:`1px solid ${c}20`}}>
            <div style={{fontSize:18,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</div>
            <div style={{fontSize:10,color:P.muted,marginTop:4,textTransform:'uppercase',letterSpacing:'0.08em'}}>{k}</div>
          </div>
        ))}
      </div>
    </GlassCard>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
      {/* Leaderboard */}
      <GlassCard style={{padding:0}}>
        <div style={{padding:'16px 18px',borderBottom:`1px solid ${P.border}`}}>
          <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em'}}>🏆 Leaderboard por score</p>
        </div>
        {loading?<Spinner/>:sorted.map((lead,i)=>(
          <div key={lead.id} onClick={()=>setSelected(lead)}
            style={{display:'flex',alignItems:'center',gap:12,padding:'12px 18px',
              borderBottom:i<sorted.length-1?`1px solid ${P.border}`:'none',cursor:'pointer',transition:'background 0.12s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{width:26,height:26,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',
              background: i===0?'rgba(255,215,0,0.2)':i===1?'rgba(192,192,192,0.15)':i===2?'rgba(205,127,50,0.15)':P.purpleDim,
              fontSize:12,fontWeight:800,
              color: i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':P.purple,flexShrink:0}}>
              {i+1}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:13,fontWeight:600,color:P.text,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lead.full_name}</p>
              <div style={{display:'flex',gap:6,marginTop:3,alignItems:'center',flexWrap:'wrap'}}>
                <Badge label={etapaLabel[lead.etapa]||lead.etapa} color={etapaColor[lead.etapa]||P.muted}/>
                {lead.team&&<Badge label={lead.team} color={teamColor[lead.team]||P.muted}/>}
                {lead.deposit_confirmed&&<span style={{fontSize:10,color:P.green}}>💵 {lead.deposit_amount_usd?`$${Number(lead.deposit_amount_usd).toLocaleString()}`:''}</span>}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4,background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:8,padding:'4px 10px',flexShrink:0}}>
              <span style={{fontSize:14,fontWeight:800,color:P.purple,fontFamily:'monospace'}}>{lead.score}</span>
              <span style={{fontSize:10,color:P.muted}}>pts</span>
            </div>
          </div>
        ))}
      </GlassCard>

      {/* Bonus tiers */}
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <GlassCard>
          <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14}}>Bonus tiers por referidos</p>
          {tiers.map(t=>(
            <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'10px 12px',marginBottom:8,borderRadius:8,
              background:`rgba(108,92,231,0.08)`,border:`1px solid ${P.purpleBorder}`}}>
              <span style={{fontSize:13,color:P.textSub}}>{t.min_referrals}+ referidos</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:11,color:P.muted}}>{t.label}</span>
                <div style={{background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:6,padding:'2px 8px'}}>
                  <span style={{fontSize:13,fontWeight:700,color:P.green}}>+{t.bonus_percentage}%</span>
                </div>
              </div>
            </div>
          ))}
        </GlassCard>

        <GlassCard>
          <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14}}>Capital por rango</p>
          {['1k-5k','5k-20k','20k-50k','50k+'].map(r=>{
            const count=leads.filter(l=>l.investment_range===r).length
            const dep=leads.filter(l=>l.investment_range===r&&l.deposit_confirmed).length
            return<div key={r} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:12,color:P.textSub}}>{r}</span>
                <span style={{fontSize:12,color:P.muted}}>{dep}/{count} depósitos</span>
              </div>
              <div style={{background:'rgba(255,255,255,0.06)',borderRadius:3,height:5}}>
                <div style={{background:P.green,height:5,borderRadius:3,width:`${leads.length?count/leads.length*100:0}%`}}/>
              </div>
            </div>
          })}
        </GlassCard>
      </div>
    </div>

    {/* Detail modal */}
    {selected&&<Modal title={selected.full_name} onClose={()=>setSelected(null)} accent={P.purple}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={etapaLabel[selected.etapa]} color={etapaColor[selected.etapa]}/>
          {selected.team&&<Badge label={selected.team} color={teamColor[selected.team]||P.muted}/>}
          <div style={{display:'inline-flex',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:8,padding:'2px 10px'}}>
            <span style={{fontSize:13,fontWeight:800,color:P.purple,fontFamily:'monospace'}}>{selected.score} pts</span>
          </div>
        </div>

        {[['Email',selected.email],['Teléfono',selected.phone||'—'],['Capital',selected.investment_range||'—'],
          ['Depósito USD',selected.deposit_amount_usd?`$${Number(selected.deposit_amount_usd).toLocaleString()}`:'—'],
          ['Asesor',selected.advisor_assigned||'Sin asignar'],
          ['Fuente',selected.source||'—'],['Referidos',getReferidos(selected)],
          ['Registro',fmtDate(selected.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:3,fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{String(v)}</p>
          </div>
        ))}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
          {[['Contactado',selected.advisor_contacted,'advisor_contacted'],
            ['Cuenta',selected.account_created,'account_created'],
            ['KYC',selected.kyc_verified,'kyc_verified'],
            ['Depósito',selected.deposit_confirmed,'deposit_confirmed']].map(([k,v,field])=>(
            <button key={k} onClick={()=>updateLead(selected.id,{[field]:!v})} disabled={saving}
              style={{padding:'10px 12px',borderRadius:8,cursor:'pointer',textAlign:'left',
                background:v?'rgba(0,208,132,0.12)':'rgba(255,255,255,0.03)',
                border:`1px solid ${v?'rgba(0,208,132,0.3)':P.border}`}}>
              <p style={{fontSize:10,color:P.muted,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</p>
              <p style={{fontSize:13,fontWeight:700,color:v?P.green:P.muted,margin:0}}>{v?'✓ Sí':'— No'}</p>
            </button>
          ))}
        </div>

        {selected.meeting_url&&<div style={{marginBottom:14,padding:'10px 12px',background:'rgba(9,132,227,0.1)',borderRadius:8,border:`1px solid ${P.blue}30`}}>
          <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Meeting URL</p>
          <a href={selected.meeting_url} target="_blank" rel="noopener noreferrer"
            style={{fontSize:12,color:P.blue,wordBreak:'break-all'}}>{selected.meeting_url}</a>
        </div>}

        <div style={{display:'flex',justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setSelected(null)}>Cerrar</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}

// ── APP ───────────────────────────────────────────────────────────────────────
const NAV=[{id:'dashboard',label:'Dashboard',icon:'⊞'},{id:'contacts',label:'Contactos',icon:'📋'},{id:'pipeline',label:'Pipeline',icon:'◈'},{id:'campana',label:'Campaña Q2',icon:'🚀'},{id:'tasks',label:'Tareas',icon:'✓'},{id:'emails',label:'Emails',icon:'✉'},{id:'reports',label:'Reportes',icon:'▦'}]

export default function App(){
  const[user,setUser]=useState(null)
  const[checking,setChecking]=useState(true)
  const[module,setModule]=useState('dashboard')
  const[contacts,setContacts]=useState([])
  const[leads,setLeads]=useState([])
  const[loading,setLoading]=useState(true)

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user??null);setChecking(false)})
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>setUser(session?.user??null))
    return()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!user)return
    const load=async()=>{
      setLoading(true)
      const[{data:c},{data:l}]=await Promise.all([
        supabase.from('contact_submissions').select('id,full_name,email,mobile,investment_capital,management_type,comments,form_type,status,submitted_at').order('submitted_at',{ascending:false}),
        supabase.from('campaign_leads').select('id,full_name,email,phone,investment_range,etapa,advisor_assigned,advisor_contacted,account_created,kyc_verified,deposit_confirmed,score,team,created_at').order('created_at',{ascending:false})
      ])
      setContacts(c||[]);setLeads(l||[]);setLoading(false)
    }
    load()
  },[user])

  useEffect(()=>{
    const s=document.createElement('style')
    s.textContent=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{background:${P.bg};color:${P.text};font-family:'Inter',sans-serif;}input,select,textarea{font-family:'Inter',sans-serif!important;}::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}input::placeholder,textarea::placeholder{color:${P.muted}!important;}select option{background:${P.surface};}input:focus,select:focus,textarea:focus{border-color:rgba(108,92,231,0.5)!important;}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`
    document.head.appendChild(s)
    return()=>document.head.removeChild(s)
  },[])

  if(checking)return<div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,border:`3px solid rgba(255,255,255,0.07)`,borderTop:`3px solid ${P.purple}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>
  if(!user)return<Login onLogin={setUser}/>
  const logout=async()=>{await supabase.auth.signOut();setUser(null)}
  const mods={dashboard:<Dashboard contacts={contacts} leads={leads}/>,contacts:<Contacts contacts={contacts} setContacts={setContacts} loading={loading}/>,pipeline:<Pipeline leads={leads} setLeads={setLeads} loading={loading}/>,campana:<Campana leads={leads}/>,tasks:<Tasks contacts={contacts} leads={leads}/>,emails:<Emails/>,reports:<Reports contacts={contacts} leads={leads}/>}

  return<div style={{display:'flex',minHeight:'100vh',background:P.bg}}>
    <div style={{width:218,background:P.sidebar,borderRight:`1px solid ${P.border}`,display:'flex',flexDirection:'column',flexShrink:0,position:'sticky',top:0,height:'100vh'}}>
      <div style={{padding:'22px 18px',borderBottom:`1px solid ${P.border}`,display:'flex',alignItems:'center',gap:12}}>
        <img src="data:image/webp;base64,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RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5mYXZpY29uLTI1NiAtIEljb25vIFBlc3Nhcm8gQ2FwaXRhbCA8L3JkZjpsaT4KICAgPC9yZGY6QWx0PgogIDwvZGM6dGl0bGU+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgPHBkZjpBdXRob3I+RnJhbmNpc2NvIFJvamFzPC9wZGY6QXV0aG9yPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczp4bXA9J2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8nPgogIDx4bXA6Q3JlYXRvclRvb2w+Q2FudmEgZG9jPURBSEJDSFZaZ0xVIHVzZXI9VUFDZHdIZFdBRjAgYnJhbmQ9VmVydGljMyB0ZW1wbGF0ZT1CbHVlIE1vZGVybiBQcm9mZXNzaW9uYWwgTGV0dGVyIEsgTG9nbzwveG1wOkNyZWF0b3JUb29sPgogPC9yZGY6RGVzY3JpcHRpb24+CjwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cjw/eHBhY2tldCBlbmQ9J3InPz4A" width={32} height={32} alt="Pessaro" style={{borderRadius:6,objectFit:'cover'}}/>
        <div><div style={{fontSize:14,fontWeight:800,color:P.text,letterSpacing:'-0.01em'}}>Pessaro</div><div style={{fontSize:10,color:P.purple,letterSpacing:'0.10em',textTransform:'uppercase',fontWeight:600}}>Capital CRM</div></div>
      </div>
      <nav style={{padding:'10px 8px',flex:1,overflowY:'auto'}}>
        {NAV.map(item=>{const active=module===item.id;return<button key={item.id} onClick={()=>setModule(item.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:8,marginBottom:2,cursor:'pointer',textAlign:'left',background:active?'rgba(108,92,231,0.15)':'transparent',color:active?P.purple:P.muted,border:active?`1px solid rgba(108,92,231,0.25)`:'1px solid transparent',fontSize:13,fontWeight:active?600:400,transition:'all 0.12s'}}><span style={{fontSize:15,width:18,textAlign:'center',opacity:active?1:0.7}}>{item.icon}</span>{item.label}{active&&<div style={{marginLeft:'auto',width:5,height:5,borderRadius:'50%',background:P.purple}}/>}</button>})}
      </nav>
      <div style={{padding:'10px 18px',borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',background:'rgba(0,208,132,0.12)',border:'1px solid rgba(0,208,132,0.3)',borderRadius:8}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:P.green,flexShrink:0}}/>
          <span style={{fontSize:10,color:P.green,fontWeight:600}}>Supabase conectado</span>
        </div>
      </div>
      <div style={{padding:'14px 18px'}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}>
          <div style={{width:28,height:28,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:P.purple}}>{(user?.email||'?')[0].toUpperCase()}</div>
          <div><div style={{fontSize:11,fontWeight:600,color:P.text}}>{user?.email?.split('@')[0]}</div><div style={{fontSize:10,color:P.muted}}>Equipo interno</div></div>
        </div>
        <button onClick={logout} style={{fontSize:11,color:P.muted,background:'none',border:'none',cursor:'pointer',padding:0}}>Cerrar sesión →</button>
      </div>
    </div>
    <div style={{flex:1,padding:'28px 32px',overflowY:'auto',minHeight:'100vh'}}>{mods[module]}</div>
  </div>
}
