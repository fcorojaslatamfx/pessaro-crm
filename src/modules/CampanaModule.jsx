import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { P, fmtDate } from '../lib/constants.js'
import { Badge, GlassCard, StatCard, Input, Sel, Btn, Modal, Lbl, Spinner, SHdr } from '../lib/ui.jsx'

export default function CampanaModule({campaign,user,isSuperAdmin,globalLeads}){
  const[participants,setParticipants]=useState([])
  const[myContacts,setMyContacts]=useState([])
  const[tiers,setTiers]=useState([])
  const[loading,setLoading]=useState(true)
  const[campTab,setCampTab]=useState('general')
  const[showAdd,setShowAdd]=useState(false)
  const[addForm,setAddForm]=useState({crm_contact_id:'',full_name:'',email:'',phone:'',investment_range:'',team:''})
  const[addSaving,setAddSaving]=useState(false)
  const[selPart,setSelPart]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const[{data:parts},{data:myC},{data:t}]=await Promise.all([
        supabase.from('campaign_participants').select('*').eq('campaign_id',campaign.id).order('created_at',{ascending:false}),
        supabase.from('crm_contacts').select('id,full_name,email,phone').eq('user_id',user.id),
        supabase.from('campaign_bonus_tiers').select('*').order('min_referrals'),
      ])
      setParticipants(parts||[])
      setMyContacts(myC||[])
      setTiers(t||[])
    }catch(e){console.error('campaign load:',e)}
    finally{setLoading(false)}
  },[campaign.id,user.id])

  useEffect(()=>{load()},[load])

  const myParts  = useMemo(()=>isSuperAdmin?participants:participants.filter(p=>p.user_id===user.id),[participants,isSuperAdmin,user.id])
  const deposited= useMemo(()=>participants.filter(p=>p.deposit_confirmed),[participants])
  const capital  = useMemo(()=>deposited.reduce((s,p)=>s+(Number(p.deposit_amount_usd)||0),0),[deposited])
  const sorted   = useMemo(()=>[...(globalLeads||[])].sort((a,b)=>b.score-a.score),[globalLeads])

  const addParticipant=async()=>{
    if(!addForm.full_name||!addForm.email)return
    setAddSaving(true)
    const payload={...addForm,user_id:user.id,campaign_id:campaign.id,etapa:1}
    if(!payload.crm_contact_id)delete payload.crm_contact_id
    const{data}=await supabase.from('campaign_participants').insert(payload).select().single()
    if(data){setParticipants(p=>[data,...p]);setShowAdd(false);setAddForm({crm_contact_id:'',full_name:'',email:'',phone:'',investment_range:'',team:''})}
    setAddSaving(false)
  }

  const updatePart=async(id,updates)=>{
    await supabase.from('campaign_participants').update({...updates,updated_at:new Date().toISOString()}).eq('id',id)
    setParticipants(p=>p.map(x=>x.id===id?{...x,...updates}:x))
    if(selPart?.id===id)setSelPart(p=>({...p,...updates}))
  }

  const etapaColor={1:P.muted,2:P.blue,3:P.orange,4:P.purple,5:P.green}
  const etapaLabel={1:'Registro',2:'Contactado',3:'Cuenta',4:'KYC',5:'Depósito'}
  const teamColor={radex:'#e74c3c',tradeview:'#3498db'}

  return <div>
    <SHdr title={campaign.name} sub={`${participants.length} leads agregados · ${deposited.length} depósitos · ${campaign.status}`}/>

    <div style={{display:'flex',gap:8,marginBottom:20}}>
      {[['general','🏆 General'],['mis_leads','👤 Mis Leads']].map(([id,label])=>(
        <button key={id} onClick={()=>setCampTab(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',
          background:campTab===id?P.purpleDim:'rgba(255,255,255,0.04)',
          color:campTab===id?P.purple:P.muted,
          border:`1px solid ${campTab===id?P.purpleBorder:P.border}`,fontWeight:campTab===id?600:400}}>{label}</button>
      ))}
      {campTab==='mis_leads'&&<Btn onClick={()=>setShowAdd(true)} style={{marginLeft:'auto'}}>+ Añadir lead</Btn>}
    </div>

    {campTab==='general'&&(loading?<Spinner/>:<div>
      <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
        <StatCard label="Capital levantado" value={capital>0?`$${(capital/1000).toFixed(0)}k`:'$0'} sub={`${deposited.length} depósitos`} accent={P.green} Icon="💵"/>
        <StatCard label="Cupos" value={`${deposited.length}/${campaign.total_spots||50}`} sub={`${(campaign.total_spots||50)-deposited.length} libres`} accent={P.purple} Icon="🎯"/>
        <StatCard label="Leads totales" value={participants.length} accent={P.blue} Icon="👥"/>
        <StatCard label="Estado" value={campaign.status[0].toUpperCase()+campaign.status.slice(1)} accent={campaign.status==='activa'?P.green:P.orange} Icon="📡"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <GlassCard style={{padding:0}}>
          <div style={{padding:'14px 18px',borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',margin:0}}>🏆 Leaderboard (campaign_leads)</p>
          </div>
          {sorted.length===0&&<p style={{padding:20,color:P.muted,fontSize:13,margin:0}}>Sin leads en el leaderboard</p>}
          {sorted.map((lead,i)=>(
            <div key={lead.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 18px',borderBottom:`1px solid ${P.border}`}}>
              <div style={{width:26,height:26,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:i===0?'rgba(255,215,0,0.2)':i===1?'rgba(192,192,192,0.15)':i===2?'rgba(205,127,50,0.15)':P.purpleDim,fontSize:12,fontWeight:800,color:i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':P.purple,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:P.text,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lead.full_name}</p>
                <div style={{display:'flex',gap:6,marginTop:3}}>
                  <Badge label={etapaLabel[lead.etapa]||lead.etapa} color={etapaColor[lead.etapa]||P.muted}/>
                  {lead.team&&<Badge label={lead.team} color={teamColor[lead.team]||P.muted}/>}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:4,background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:8,padding:'4px 10px',flexShrink:0}}>
                <span style={{fontSize:14,fontWeight:800,color:P.purple,fontFamily:'monospace'}}>{lead.score}</span>
                <span style={{fontSize:10,color:P.muted}}>pts</span>
              </div>
            </div>
          ))}
        </GlassCard>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {tiers.length>0&&<GlassCard>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>Bonus tiers</p>
            {tiers.map(t=>(
              <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',marginBottom:8,borderRadius:8,background:P.purpleDim,border:`1px solid ${P.purpleBorder}`}}>
                <span style={{fontSize:13,color:P.textSub}}>{t.min_referrals}+ referidos</span>
                <div style={{background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:6,padding:'2px 8px'}}>
                  <span style={{fontSize:13,fontWeight:700,color:P.green}}>+{t.bonus_percentage}%</span>
                </div>
              </div>
            ))}
          </GlassCard>}
          <GlassCard>
            <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:14,margin:'0 0 14px'}}>Leads por capital</p>
            {['1k-5k','5k-20k','20k-50k','50k+'].map(r=>{
              const cnt=participants.filter(p=>p.investment_range===r).length
              const dep=participants.filter(p=>p.investment_range===r&&p.deposit_confirmed).length
              return <div key={r} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,color:P.textSub}}>{r}</span>
                  <span style={{fontSize:12,color:P.muted}}>{dep}/{cnt}</span>
                </div>
                <div style={{background:'rgba(255,255,255,0.06)',borderRadius:3,height:4}}>
                  <div style={{background:P.green,height:4,borderRadius:3,width:`${participants.length?cnt/participants.length*100:0}%`}}/>
                </div>
              </div>
            })}
          </GlassCard>
        </div>
      </div>
    </div>)}

    {campTab==='mis_leads'&&(loading?<Spinner/>:<div>
      <GlassCard style={{padding:0,marginBottom:16}}>
        <div style={{padding:'12px 18px',borderBottom:`1px solid ${P.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <p style={{fontSize:12,fontWeight:600,color:P.textSub,margin:0}}>{isSuperAdmin?'Todos los leads':'Mis leads'} · {myParts.length}</p>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
            {['Nombre','Email','Capital','Equipo','Contactado','Cuenta','KYC','Depósito'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {myParts.map((p,i)=>(
              <tr key={p.id} style={{borderBottom:i<myParts.length-1?`1px solid ${P.border}`:'none',cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onClick={()=>setSelPart(p)}>
                <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:P.text}}>{p.full_name}</td>
                <td style={{padding:'11px 14px',fontSize:12,color:P.muted,fontFamily:'monospace'}}>{p.email}</td>
                <td style={{padding:'11px 14px'}}>{p.investment_range?<Badge label={p.investment_range} color={P.green}/>:'—'}</td>
                <td style={{padding:'11px 14px'}}>{p.team?<Badge label={p.team} color={teamColor[p.team]||P.muted}/>:'—'}</td>
                {[['advisor_contacted',p.advisor_contacted],['account_created',p.account_created],['kyc_verified',p.kyc_verified],['deposit_confirmed',p.deposit_confirmed]].map(([field,val])=>(
                  <td key={field} style={{padding:'11px 14px'}}>
                    <button onClick={e=>{e.stopPropagation();updatePart(p.id,{[field]:!val})}}
                      style={{padding:'3px 8px',borderRadius:5,fontSize:11,cursor:'pointer',fontWeight:600,
                        background:val?P.greenDim:'rgba(255,255,255,0.04)',color:val?P.green:P.muted,
                        border:`1px solid ${val?P.green+'30':P.border}`}}>{val?'✓ Sí':'— No'}</button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {myParts.length===0&&<div style={{textAlign:'center',padding:32,color:P.muted,fontSize:13}}>Añade tu primer lead con el botón "+ Añadir lead".</div>}
      </GlassCard>
    </div>)}

    {showAdd&&<Modal title="Añadir lead a campaña" onClose={()=>setShowAdd(false)} accent={P.purple}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div><Lbl>Desde mis contactos</Lbl>
          <Sel value={addForm.crm_contact_id} onChange={v=>{
            const c=myContacts.find(x=>x.id===v)
            if(c)setAddForm(p=>({...p,crm_contact_id:v,full_name:c.full_name,email:c.email,phone:c.phone||''}))
            else setAddForm(p=>({...p,crm_contact_id:v}))
          }} options={[{value:'',label:'Ingresar manualmente'},...myContacts.map(c=>({value:c.id,label:`${c.full_name} · ${c.email}`}))]}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Nombre *</Lbl><Input value={addForm.full_name} onChange={v=>setAddForm(p=>({...p,full_name:v}))} placeholder="Nombre completo"/></div>
          <div><Lbl>Email *</Lbl><Input value={addForm.email} onChange={v=>setAddForm(p=>({...p,email:v}))} placeholder="email@ejemplo.com"/></div>
          <div><Lbl>Teléfono</Lbl><Input value={addForm.phone} onChange={v=>setAddForm(p=>({...p,phone:v}))} placeholder="+56 9..."/></div>
          <div><Lbl>Capital</Lbl><Sel value={addForm.investment_range} onChange={v=>setAddForm(p=>({...p,investment_range:v}))} options={[{value:'',label:'Seleccionar'},{value:'1k-5k',label:'1k-5k'},{value:'5k-20k',label:'5k-20k'},{value:'20k-50k',label:'20k-50k'},{value:'50k+',label:'50k+'}]}/></div>
          <div><Lbl>Equipo</Lbl><Sel value={addForm.team} onChange={v=>setAddForm(p=>({...p,team:v}))} options={[{value:'',label:'Sin equipo'},{value:'radex',label:'Radex'},{value:'tradeview',label:'Tradeview'}]}/></div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancelar</Btn>
          <Btn onClick={addParticipant} disabled={addSaving||!addForm.full_name||!addForm.email}>{addSaving?'Guardando...':'Añadir'}</Btn>
        </div>
      </div>
    </Modal>}

    {selPart&&<Modal title={selPart.full_name} onClose={()=>setSelPart(null)}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={etapaLabel[selPart.etapa]||selPart.etapa} color={etapaColor[selPart.etapa]||P.muted}/>
          {selPart.team&&<Badge label={selPart.team} color={teamColor[selPart.team]||P.muted}/>}
          {selPart.investment_range&&<Badge label={selPart.investment_range} color={P.green}/>}
        </div>
        {[['Email',selPart.email],['Teléfono',selPart.phone||'—'],['Depósito USD',selPart.deposit_amount_usd?`$${Number(selPart.deposit_amount_usd).toLocaleString()}`:'—'],['Registro',fmtDate(selPart.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:3,margin:'0 0 3px',fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{v}</p>
          </div>
        ))}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
          {[['Contactado','advisor_contacted',selPart.advisor_contacted],['Cuenta','account_created',selPart.account_created],['KYC','kyc_verified',selPart.kyc_verified],['Depósito','deposit_confirmed',selPart.deposit_confirmed]].map(([k,field,v])=>(
            <button key={k} onClick={()=>updatePart(selPart.id,{[field]:!v})}
              style={{padding:'10px 12px',borderRadius:8,cursor:'pointer',textAlign:'left',background:v?P.greenDim:'rgba(255,255,255,0.03)',border:`1px solid ${v?P.green+'30':P.border}`}}>
              <p style={{fontSize:10,color:P.muted,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</p>
              <p style={{fontSize:13,fontWeight:700,color:v?P.green:P.muted,margin:0}}>{v?'✓ Sí':'— No'}</p>
            </button>
          ))}
        </div>
      </div>
    </Modal>}
  </div>
}
