import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { P } from '../lib/constants.js'
import { Badge, GlassCard, Input, Sel, Btn, Modal, Lbl, SHdr } from '../lib/ui.jsx'

export default function AdminCampaigns({campaigns,setCampaigns,user}){
  const[showNew,setShowNew]=useState(false)
  const[saving,setSaving]=useState(false)
  const[form,setForm]=useState({name:'',slug:'',description:'',total_spots:50,broker:'',historical_return:'+502%',target_capital:'',start_date:'',status:'activa'})
  const[err,setErr]=useState({})
  const STATUS_C={activa:P.green,pausada:P.orange,cerrada:P.muted}

  const validate=()=>{
    const e={}
    if(!form.name.trim())e.name='Obligatorio'
    if(!form.slug.trim())e.slug='Obligatorio'
    else if(!/^[a-z0-9-]+$/.test(form.slug))e.slug='Solo minúsculas, números y guiones'
    setErr(e); return !Object.keys(e).length
  }

  const create=async()=>{
    if(!validate())return
    setSaving(true)
    const{data,error}=await supabase.from('campaigns').insert({...form,total_spots:Number(form.total_spots)||50,created_by:user.id}).select().single()
    setSaving(false)
    if(error){setErr({slug:error.message});return}
    setCampaigns(p=>[...p,data])
    setShowNew(false)
    setForm({name:'',slug:'',description:'',total_spots:50,broker:'',historical_return:'+502%',target_capital:'',start_date:'',status:'activa'})
    setErr({})
  }

  const updateStatus=async(id,status)=>{
    await supabase.from('campaigns').update({status}).eq('id',id)
    setCampaigns(p=>p.map(c=>c.id===id?{...c,status}:c))
  }

  return <div>
    <SHdr title="Gestionar Campañas" sub="Crea y administra campañas · solo super admin"
      action={<Btn onClick={()=>setShowNew(true)}>+ Nueva campaña</Btn>}/>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {campaigns.map(c=>(
        <GlassCard key={c.id} style={{borderLeft:`3px solid ${STATUS_C[c.status]}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <Badge label={c.status} color={STATUS_C[c.status]}/>
                <span style={{fontSize:11,color:P.muted,fontFamily:'monospace'}}>{c.slug}</span>
              </div>
              <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:P.text}}>{c.name}</h3>
              {c.description&&<p style={{margin:'0 0 10px',fontSize:13,color:P.muted}}>{c.description}</p>}
              <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
                {[['Cupos',c.total_spots],['Broker',c.broker||'—'],['Retorno',c.historical_return||'—'],['Capital obj.',c.target_capital||'—']].map(([k,v])=>(
                  <span key={k} style={{fontSize:11,color:P.muted}}><strong style={{color:P.textSub}}>{k}:</strong> {v}</span>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              {['activa','pausada','cerrada'].map(s=>(
                <button key={s} onClick={()=>updateStatus(c.id,s)} disabled={c.status===s}
                  style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:c.status===s?'default':'pointer',
                    background:c.status===s?STATUS_C[s]+'25':'rgba(255,255,255,0.04)',
                    color:c.status===s?STATUS_C[s]:P.muted,
                    border:`1px solid ${c.status===s?STATUS_C[s]+'40':P.border}`,fontWeight:600}}>
                  {s[0].toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginTop:12,padding:'8px 12px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:`1px solid ${P.border}`}}>
            <p style={{fontSize:11,color:P.muted,margin:0}}>
              Los asesores ven <strong style={{color:P.text}}>🚀 {c.name}</strong> en su sidebar {c.status==='activa'?'✓':'· pausada/cerrada = oculta para asesores'}.
            </p>
          </div>
        </GlassCard>
      ))}
      {campaigns.length===0&&<GlassCard><p style={{color:P.muted,fontSize:14,textAlign:'center',padding:'20px 0',margin:0}}>No hay campañas. Crea la primera.</p></GlassCard>}
    </div>

    {showNew&&<Modal title="Nueva campaña" onClose={()=>setShowNew(false)} accent={P.green}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Lbl>Nombre *</Lbl>
            <Input value={form.name} onChange={v=>setForm(p=>({...p,name:v,slug:v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}))} placeholder="Campaña Q3 2026"/>
            {err.name&&<p style={{fontSize:11,color:P.red,margin:'3px 0 0'}}>{err.name}</p>}
          </div>
          <div><Lbl>Slug *</Lbl>
            <Input value={form.slug} onChange={v=>setForm(p=>({...p,slug:v}))} placeholder="q3-2026"/>
            {err.slug&&<p style={{fontSize:11,color:P.red,margin:'3px 0 0'}}>{err.slug}</p>}
          </div>
          <div><Lbl>Broker</Lbl><Input value={form.broker} onChange={v=>setForm(p=>({...p,broker:v}))} placeholder="Radex / Tradeview"/></div>
          <div><Lbl>Cupos</Lbl><Input value={form.total_spots} onChange={v=>setForm(p=>({...p,total_spots:v}))} type="number" placeholder="50"/></div>
          <div><Lbl>Retorno histórico</Lbl><Input value={form.historical_return} onChange={v=>setForm(p=>({...p,historical_return:v}))} placeholder="+502%"/></div>
          <div><Lbl>Capital objetivo</Lbl><Input value={form.target_capital} onChange={v=>setForm(p=>({...p,target_capital:v}))} placeholder="$500,000 USD"/></div>
          <div><Lbl>Fecha inicio</Lbl><Input value={form.start_date} onChange={v=>setForm(p=>({...p,start_date:v}))} type="date"/></div>
          <div><Lbl>Estado</Lbl><Sel value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={[{value:'activa',label:'Activa'},{value:'pausada',label:'Pausada'}]}/></div>
        </div>
        <div><Lbl>Descripción</Lbl>
          <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Descripción..."
            style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:10,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:60,resize:'vertical',fontFamily:'inherit'}}/>
        </div>
        <div style={{padding:'8px 12px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}>
          <p style={{fontSize:12,color:P.green,margin:0}}>✓ Aparecerá automáticamente en el sidebar de todos los asesores.</p>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setShowNew(false)}>Cancelar</Btn>
          <Btn onClick={create} disabled={saving}>{saving?'Creando...':'Crear campaña'}</Btn>
        </div>
      </div>
    </Modal>}
  </div>
}
