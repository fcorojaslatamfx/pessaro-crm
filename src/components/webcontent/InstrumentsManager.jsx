// ─── CONTENIDO WEB · Gestor de Instrumentos ──────────────────────────────────
// Tabla: cms_instruments_2026_02_23_17_38 (public read: is_active=true)
// Nota v1.9: la tabla estaba vacía al construir este gestor (2026-07-09) — el sitio
// aún no consume instrumentos dinámicos; este módulo queda listo para poblarla.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { P, GlassCard, Btn, Badge, Lbl, Input, Sel, Spinner, Modal } from './ui.jsx'

const T='cms_instruments_2026_02_23_17_38'
const CATS=['Forex','Índices','Materias Primas','Cripto','Acciones']
const EMPTY={symbol:'',name:'',category:'Forex',spread:'',leverage:'',trending:'',is_popular:false}

export default function InstrumentsManager(){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[editing,setEditing]=useState(null)
  const[form,setForm]=useState(EMPTY)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState('')
  const[confirm,setConfirm]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const{data,error}=await supabase.from(T).select('*').order('category').order('symbol')
      if(error)throw error
      setItems(data||[])
    }catch(e){console.error(e)}finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  const openNew=()=>{setForm(EMPTY);setError('');setEditing('new')}
  const openEdit=x=>{setForm({symbol:x.symbol||'',name:x.name||'',category:x.category||'Forex',spread:x.spread||'',leverage:x.leverage||'',trending:x.trending||'',is_popular:!!x.is_popular});setError('');setEditing(x)}

  const save=async()=>{
    if(!form.symbol.trim()||!form.name.trim()||!form.spread.trim()||!form.leverage.trim()){setError('Símbolo, nombre, spread y leverage son obligatorios');return}
    setSaving(true);setError('')
    const now=new Date().toISOString()
    const payload={
      symbol:form.symbol.trim().toUpperCase(),name:form.name.trim(),category:form.category,
      spread:form.spread.trim(),leverage:form.leverage.trim(),
      trending:form.trending||null,is_popular:form.is_popular,
    }
    try{
      if(editing==='new'){
        const{data,error}=await supabase.from(T).insert({...payload,is_active:true}).select().single()
        if(error)throw error
        setItems(p=>[...p,data])
      }else{
        const{data,error}=await supabase.from(T).update({...payload,updated_at:now}).eq('id',editing.id).select().single()
        if(error)throw error
        setItems(p=>p.map(x=>x.id===data.id?data:x))
      }
      setEditing(null)
    }catch(e){console.error(e);setError(e.message||'Error al guardar')}
    finally{setSaving(false)}
  }
  const toggle=async x=>{
    const{data,error}=await supabase.from(T).update({is_active:!x.is_active,updated_at:new Date().toISOString()}).eq('id',x.id).select().single()
    if(!error)setItems(p=>p.map(i=>i.id===data.id?data:i))
  }
  const doDelete=async()=>{
    const{error}=await supabase.from(T).delete().eq('id',confirm.id)
    if(!error)setItems(p=>p.filter(x=>x.id!==confirm.id))
    setConfirm(null)
  }
  const TREND={up:{label:'▲ Alza',color:P.green},down:{label:'▼ Baja',color:P.red},stable:{label:'— Estable',color:P.muted}}

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
      <p style={{fontSize:12,color:P.muted,margin:0}}>{items.length} instrumentos · inactivos no se muestran en el sitio</p>
      <Btn onClick={openNew}>+ Nuevo instrumento</Btn>
    </div>
    {loading?<Spinner/>:
      items.length===0?<GlassCard><p style={{fontSize:13,color:P.muted,textAlign:'center',margin:0}}>Sin instrumentos — la tabla está vacía. Agrega el primero para habilitar el catálogo dinámico en el sitio.</p></GlassCard>:
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
        {items.map(x=><GlassCard key={x.id} style={{opacity:x.is_active?1:0.45}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:15,fontWeight:800,color:P.text,fontFamily:'monospace'}}>{x.symbol}</span>
              {x.is_popular&&<span title="Popular">⭐</span>}
            </div>
            <Badge label={x.category} color={P.blue}/>
          </div>
          <p style={{fontSize:12,color:P.textSub,margin:'0 0 8px'}}>{x.name}</p>
          <div style={{display:'flex',gap:12,fontSize:11,color:P.muted,marginBottom:10,flexWrap:'wrap'}}>
            <span>Spread: <strong style={{color:P.text}}>{x.spread}</strong></span>
            <span>Leverage: <strong style={{color:P.text}}>{x.leverage}</strong></span>
            {x.trending&&TREND[x.trending]&&<span style={{color:TREND[x.trending].color}}>{TREND[x.trending].label}</span>}
          </div>
          <div style={{display:'flex',gap:6}}>
            <Btn variant="ghost" style={{padding:'4px 10px',fontSize:11}} onClick={()=>toggle(x)}>{x.is_active?'Desactivar':'Activar'}</Btn>
            <Btn variant="ghost" style={{padding:'4px 10px',fontSize:11}} onClick={()=>openEdit(x)}>Editar</Btn>
            <Btn variant="danger" style={{padding:'4px 8px',fontSize:11}} onClick={()=>setConfirm(x)}>🗑</Btn>
          </div>
        </GlassCard>)}
      </div>}

    {editing&&<Modal title={editing==='new'?'Nuevo instrumento':'Editar instrumento'} onClose={()=>setEditing(null)} accent={P.orange} width={560}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12}}>
          <div><Lbl>Símbolo *</Lbl><Input value={form.symbol} onChange={v=>setForm(f=>({...f,symbol:v}))} placeholder="EURUSD"/></div>
          <div><Lbl>Nombre *</Lbl><Input value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="Euro / Dólar estadounidense"/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          <div><Lbl>Categoría</Lbl><Sel value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} options={CATS.map(c=>({value:c,label:c}))}/></div>
          <div><Lbl>Spread *</Lbl><Input value={form.spread} onChange={v=>setForm(f=>({...f,spread:v}))} placeholder="desde 0.1 pips"/></div>
          <div><Lbl>Leverage *</Lbl><Input value={form.leverage} onChange={v=>setForm(f=>({...f,leverage:v}))} placeholder="hasta 1:500"/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,alignItems:'end'}}>
          <div><Lbl>Tendencia</Lbl><Sel value={form.trending} onChange={v=>setForm(f=>({...f,trending:v}))} options={[{value:'',label:'Sin indicador'},{value:'up',label:'▲ Alza'},{value:'down',label:'▼ Baja'},{value:'stable',label:'— Estable'}]}/></div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:P.textSub,cursor:'pointer',paddingBottom:10}}>
            <input type="checkbox" checked={form.is_popular} onChange={e=>setForm(f=>({...f,is_popular:e.target.checked}))} style={{width:14,height:14,cursor:'pointer'}}/>
            ⭐ Marcar como popular
          </label>
        </div>
        {error&&<p style={{fontSize:12,color:P.red,margin:0}}>{error}</p>}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setEditing(null)}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</Btn>
        </div>
      </div>
    </Modal>}

    {confirm&&<Modal title="Eliminar instrumento" onClose={()=>setConfirm(null)} accent={P.red} width={440}>
      <p style={{fontSize:13,color:P.textSub,marginTop:0}}>Se eliminará <strong style={{color:P.text}}>{confirm.symbol}</strong>.</p>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <Btn variant="ghost" onClick={()=>setConfirm(null)}>Cancelar</Btn>
        <Btn variant="danger" onClick={doDelete}>Eliminar</Btn>
      </div>
    </Modal>}
  </div>
}
