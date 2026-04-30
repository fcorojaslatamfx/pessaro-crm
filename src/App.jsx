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
function Logo({size=28}){return<img src="https://pessaro.cl/images/logo-256.webp" width={size} height={size} alt="Pessaro Capital" style={{borderRadius:size*0.18,objectFit:'cover',display:'block'}}/>}
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

// ── APP ───────────────────────────────────────────────────────────────────────
const NAV=[{id:'dashboard',label:'Dashboard',icon:'⊞'},{id:'contacts',label:'Contactos',icon:'📋'},{id:'pipeline',label:'Pipeline',icon:'◈'},{id:'tasks',label:'Tareas',icon:'✓'},{id:'emails',label:'Emails',icon:'✉'},{id:'reports',label:'Reportes',icon:'▦'}]

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
  const mods={dashboard:<Dashboard contacts={contacts} leads={leads}/>,contacts:<Contacts contacts={contacts} setContacts={setContacts} loading={loading}/>,pipeline:<Pipeline leads={leads} setLeads={setLeads} loading={loading}/>,tasks:<Tasks contacts={contacts} leads={leads}/>,emails:<Emails/>,reports:<Reports contacts={contacts} leads={leads}/>}

  return<div style={{display:'flex',minHeight:'100vh',background:P.bg}}>
    <div style={{width:218,background:P.sidebar,borderRight:`1px solid ${P.border}`,display:'flex',flexDirection:'column',flexShrink:0,position:'sticky',top:0,height:'100vh'}}>
      <div style={{padding:'22px 18px',borderBottom:`1px solid ${P.border}`,display:'flex',alignItems:'center',gap:12}}>
        <img src="https://pessaro.cl/images/logo-256.webp" width={32} height={32} alt="Pessaro" style={{borderRadius:6,objectFit:'cover'}}/>
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
