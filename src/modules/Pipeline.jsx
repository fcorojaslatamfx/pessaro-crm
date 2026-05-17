import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { P, STAGES, STAGE_LABEL, STAGE_COLOR, ETAPA_STAGE, STAGE_ETAPA, fmtDate } from '../lib/constants.js'
import { Badge, GlassCard, Modal, SHdr } from '../lib/ui.jsx'

export default function Pipeline({leads,setLeads,isSuperAdmin}){
  const[selected,setSelected]=useState(null)

  const move=async(id,etapa)=>{
    const u={etapa,advisor_contacted:etapa>=2,account_created:etapa>=3,kyc_verified:etapa>=4,deposit_confirmed:etapa>=5}
    await supabase.from('campaign_leads').update(u).eq('id',id)
    setLeads(p=>p.map(l=>l.id===id?{...l,...u}:l))
    if(selected?.id===id)setSelected(p=>({...p,...u}))
  }

  const stageGroups=useMemo(()=>{
    const groups={}
    STAGES.forEach(stage=>{
      const etapa=STAGE_ETAPA[stage]
      groups[stage]=leads.filter(l=>l.etapa===etapa)
    })
    return groups
  },[leads])

  return <div>
    <SHdr title="Pipeline" sub={`${leads.length} leads en pipeline de conversión`}/>
    <div style={{display:'flex',gap:14,overflowX:'auto',paddingBottom:12}}>
      {STAGES.map(stage=>{
        const etapa=STAGE_ETAPA[stage]
        const staged=stageGroups[stage]
        const color=STAGE_COLOR[stage]
        return <div key={stage} style={{minWidth:200,flex:1}}>
          <div style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:6,height:6,borderRadius:'50%',background:color}}/><span style={{fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.06em'}}>{STAGE_LABEL[stage]}</span></div>
            <span style={{fontSize:11,color:P.muted}}>{staged.length}</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {staged.map(lead=><GlassCard key={lead.id} style={{padding:14,borderLeft:`3px solid ${color}`,cursor:'pointer'}} onClick={()=>setSelected(lead)}>
              <p style={{fontSize:13,fontWeight:600,color:P.text,margin:'0 0 2px'}}>{lead.full_name}</p>
              <p style={{fontSize:11,color:P.muted,margin:'0 0 8px',fontFamily:'monospace'}}>{lead.email}</p>
              {lead.investment_range&&<Badge label={lead.investment_range} color={P.green}/>}
              <div style={{background:'rgba(255,255,255,0.07)',borderRadius:2,height:3,margin:'8px 0'}}><div style={{background:color,height:3,borderRadius:2,width:`${(etapa/5)*100}%`}}/></div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {etapa>1&&<button onClick={e=>{e.stopPropagation();move(lead.id,etapa-1)}} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:'rgba(255,255,255,0.05)',color:P.muted,border:`1px solid ${P.border}`,cursor:'pointer'}}>← Anterior</button>}
                {etapa<5&&<button onClick={e=>{e.stopPropagation();move(lead.id,etapa+1)}} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:STAGE_COLOR[STAGES[etapa]]+'18',color:STAGE_COLOR[STAGES[etapa]],border:`1px solid ${STAGE_COLOR[STAGES[etapa]]}30`,cursor:'pointer'}}>→ {STAGE_LABEL[STAGES[etapa]]}</button>}
              </div>
            </GlassCard>)}
            {staged.length===0&&<div style={{border:`1px dashed ${P.border}`,borderRadius:12,padding:'20px 14px',textAlign:'center',fontSize:12,color:P.muted}}>Sin leads</div>}
          </div>
        </div>
      })}
    </div>
    {selected&&<Modal title={selected.full_name} onClose={()=>setSelected(null)} accent={STAGE_COLOR[ETAPA_STAGE[selected.etapa]]}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={STAGE_LABEL[ETAPA_STAGE[selected.etapa]]} color={STAGE_COLOR[ETAPA_STAGE[selected.etapa]]}/>
          {selected.investment_range&&<Badge label={selected.investment_range} color={P.green}/>}
          {selected.team&&<Badge label={selected.team} color={P.blue}/>}
        </div>
        {[['Email',selected.email],['Teléfono',selected.phone||'—'],['Asesor',selected.advisor_assigned||'Sin asignar'],['Score',selected.score||0],['Registro',fmtDate(selected.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:3,margin:'0 0 3px',fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{String(v)}</p>
          </div>
        ))}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
          {[['Contactado',selected.advisor_contacted],['Cuenta',selected.account_created],['KYC',selected.kyc_verified],['Depósito',selected.deposit_confirmed]].map(([k,v])=>(
            <div key={k} style={{padding:'8px 12px',borderRadius:8,background:v?P.greenDim:'rgba(255,255,255,0.03)',border:`1px solid ${v?P.green+'30':P.border}`}}>
              <p style={{fontSize:10,color:P.muted,margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</p>
              <p style={{fontSize:13,fontWeight:700,color:v?P.green:P.muted,margin:0}}>{v?'✓ Sí':'—'}</p>
            </div>
          ))}
        </div>
      </div>
    </Modal>}
  </div>
}
