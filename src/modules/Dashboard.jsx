import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { P, STAGES, STAGE_LABEL, ETAPA_STAGE, STATUS_COLOR, fmt, TT } from '../lib/constants.js'
import { GlassCard, StatCard, SHdr, Badge } from '../lib/ui.jsx'

export default function Dashboard({contacts,leads,onNav}){
  const closed   = useMemo(()=>leads.filter(l=>l.etapa===5).length, [leads])
  const newC     = useMemo(()=>contacts.filter(c=>c.status==='new').length, [contacts])
  const totalCap = useMemo(()=>contacts.reduce((s,c)=>s+(Number(c.investment_capital)||0),0), [contacts])
  const pipeData = useMemo(()=>STAGES.map(s=>({name:STAGE_LABEL[s],v:leads.filter(l=>ETAPA_STAGE[l.etapa]===s).length})), [leads])

  return <div>
    <SHdr title="Dashboard" sub="Datos en tiempo real desde Supabase"/>
    <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
      <StatCard label="Formularios" value={contacts.length} sub={newC>0?`${newC} sin leer`:contacts.length>0?'Todos leídos ✓':'Sin formularios'} accent={newC>0?P.orange:P.purple} Icon="📋"/>
      <StatCard label="Leads pipeline" value={leads.length} sub={`${closed} cerrados`} accent={P.blue} Icon="◈"/>
      <StatCard label="Capital declarado" value={fmt(totalCap)} accent={P.green} Icon="💵"/>
      <StatCard label="Tasa cierre" value={leads.length?`${Math.round(closed/leads.length*100)}%`:'—'} accent={P.orange} Icon="🎯"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Pipeline por etapa</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={pipeData} barSize={28}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.purple} radius={[4,4,0,0]}/></BarChart>
        </ResponsiveContainer>
      </GlassCard>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Estado formularios</p>
        {[['new','Sin leer',P.orange],['read','Leídos',P.blue],['replied','Respondidos',P.green],['archived','Archivados / Spam',P.muted]].map(([s,l,c])=>{
          const cnt=contacts.filter(x=>x.status===s).length
          return <div key={s} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13,color:P.textSub}}>{l}</span><span style={{fontSize:13,fontFamily:'monospace',color:c,fontWeight:600}}>{cnt}</span></div>
            <div style={{background:'rgba(255,255,255,0.06)',borderRadius:2,height:4}}><div style={{background:c,height:4,borderRadius:2,width:`${contacts.length?cnt/contacts.length*100:0}%`,transition:'width 0.6s'}}/></div>
          </div>
        })}
      </GlassCard>
    </div>
    <GlassCard>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Últimos formularios</p>
      {contacts.filter(c=>c.status!=='archived').slice(0,6).map((c,i)=>(
        <div key={c.id} onClick={()=>onNav('contacts')} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<5?`1px solid ${P.border}`:'none',cursor:'pointer',borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <div style={{width:30,height:30,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:P.purple}}>{(c.full_name||'?')[0]}</div>
            <div><p style={{fontSize:13,fontWeight:600,color:P.text,margin:0}}>{c.full_name}</p><p style={{fontSize:11,color:P.muted,margin:0}}>{c.email}</p></div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {c.investment_capital>0&&<span style={{fontSize:12,fontFamily:'monospace',color:P.green}}>{fmt(c.investment_capital)}</span>}
            <Badge label={c.status} color={STATUS_COLOR[c.status]||P.muted}/>
          </div>
        </div>
      ))}
      {contacts.length===0&&<p style={{color:P.muted,fontSize:13,margin:0}}>Sin formularios aún</p>}
    </GlassCard>
  </div>
}
