import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { P, STATUS_OPT, SCOLOR_MAP, STATUS_COLOR, fmt, fmtDate } from '../lib/constants.js'
import { Badge, GlassCard, Input, Sel, Btn, Modal, Lbl, Spinner, SHdr } from '../lib/ui.jsx'

export default function Contacts({user,isSuperAdmin}){
  const[contacts,setContacts]=useState([])
  const[loading,setLoading]=useState(true)
  const[search,setSearch]=useState('')
  const[statusFilter,setStatusFilter]=useState('todos')
  const[staffList,setStaffList]=useState([])
  const[userFilter,setUserFilter]=useState('todos')
  const[tab,setTab]=useState('lista')
  const[selected,setSelected]=useState(null)
  const[notes,setNotes]=useState([])
  const[noteText,setNoteText]=useState('')
  const[form,setForm]=useState({full_name:'',email:'',phone:'',address:'',status:'activo',notes:''})
  const[formErr,setFormErr]=useState({})
  const[saving,setSaving]=useState(false)
  const[csvRows,setCsvRows]=useState([])
  const[csvErrors,setCsvErrors]=useState([])
  const[csvImporting,setCsvImporting]=useState(false)
  const[csvDone,setCsvDone]=useState(null)
  const[dragOver,setDragOver]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      if(isSuperAdmin){
        const[{data:crm},{data:subs},{data:sp}]=await Promise.all([
          supabase.from('crm_contacts').select('*').order('created_at',{ascending:false}),
          supabase.from('contact_submissions').select('id,full_name,email,mobile,investment_capital,management_type,status,submitted_at').order('submitted_at',{ascending:false}),
          supabase.from('crm_staff_profiles').select('user_id,display_name'),
        ])
        setStaffList(sp||[])
        const existing=new Set((crm||[]).map(c=>c.email))
        const normalized=(subs||[]).filter(s=>!existing.has(s.email)).map(s=>({
          id:'sub_'+s.id, user_id:null,
          full_name:s.full_name||'Sin nombre', email:s.email, phone:s.mobile||'—', address:'',
          notes:s.management_type||'', status:s.status==='new'?'prospecto':s.status==='read'?'activo':s.status==='replied'?'cliente':'inactivo',
          _origStatus:s.status, source:'formulario', created_at:s.submitted_at, _capital:s.investment_capital,
        }))
        setContacts([...(crm||[]),...normalized])
      } else {
        const{data}=await supabase.from('crm_contacts').select('*').eq('user_id',user.id).order('created_at',{ascending:false})
        setContacts(data||[])
      }
    }catch(e){console.error('contacts load:',e)}
    finally{setLoading(false)}
  },[user.id,isSuperAdmin])

  useEffect(()=>{load()},[load])

  const filtered=useMemo(()=>contacts.filter(c=>{
    const ms=`${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
    const mst=statusFilter==='todos'||(statusFilter==='activos'&&c.status!=='inactivo')||c.status===statusFilter
    const mu=userFilter==='todos'||c.user_id===userFilter
    return ms&&mst&&mu
  }),[contacts,search,statusFilter,userFilter])

  const validate=()=>{
    const e={}
    if(!form.full_name.trim())e.full_name='Obligatorio'
    if(!form.email.trim()||!form.email.includes('@'))e.email='Email válido obligatorio'
    if(!form.phone.trim())e.phone='Obligatorio'
    setFormErr(e); return !Object.keys(e).length
  }

  const saveContact=async()=>{
    if(!validate())return
    setSaving(true)
    const{data,error}=await supabase.from('crm_contacts').insert({...form,user_id:user.id,source:'manual'}).select().single()
    setSaving(false)
    if(error){setFormErr({email:error.message});return}
    setContacts(p=>[data,...p])
    setForm({full_name:'',email:'',phone:'',address:'',status:'activo',notes:''})
    setFormErr({});setTab('lista')
  }

  const openContact=async c=>{
    setSelected(c);setNotes([]);setNoteText('')
    try{
      let q=supabase.from('crm_notes').select('*').order('created_at',{ascending:false})
      if(c.id.startsWith('sub_')) q=q.eq('contact_submission_id',c.id.replace('sub_',''))
      else q=q.eq('crm_contact_id',c.id)
      const{data}=await q
      setNotes(data||[])
    }catch(e){console.error('loadNotes:',e)}
    if(c.source==='formulario'&&c._origStatus==='new'){
      try{
        await supabase.from('contact_submissions').update({status:'read'}).eq('id',c.id.replace('sub_',''))
        setContacts(p=>p.map(x=>x.id===c.id?{...x,status:'activo',_origStatus:'read'}:x))
        setSelected(s=>s?{...s,status:'activo',_origStatus:'read'}:s)
      }catch(e){console.error('markRead:',e)}
    }
  }

  const addNote=async()=>{
    if(!noteText.trim()||!selected)return
    const isSub=selected.id.startsWith('sub_')
    const payload={content:noteText}
    if(isSub) payload.contact_submission_id=selected.id.replace('sub_','')
    else payload.crm_contact_id=selected.id
    const{data,error}=await supabase.from('crm_notes').insert(payload).select().single()
    if(error){console.error('addNote:',error);return}
    if(data){setNotes(p=>[data,...p]);setNoteText('')}
  }

  const updateStatus=async(id,status)=>{
    try{
      if(id.startsWith('sub_')){
        const subStatus=status==='activo'?'read':status==='cliente'?'replied':status==='inactivo'?'archived':'new'
        await supabase.from('contact_submissions').update({status:subStatus}).eq('id',id.replace('sub_',''))
      } else {
        await supabase.from('crm_contacts').update({status}).eq('id',id)
      }
      const orig=status==='activo'?'read':status==='cliente'?'replied':status==='inactivo'?'archived':'new'
      setContacts(p=>p.map(c=>c.id===id?{...c,status,_origStatus:orig}:c))
      if(selected?.id===id)setSelected(p=>({...p,status}))
    }catch(e){console.error('updateStatus:',e)}
  }

  const parseCSV=text=>{
    const lines=text.trim().split('\n')
    if(lines.length<2)return{rows:[],errors:['El CSV debe tener encabezado y al menos una fila']}
    const headers=lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/['"]/g,""))
    const ni=headers.findIndex(h=>/nombre|name|full_name/.test(h))
    const ei=headers.findIndex(h=>/correo|email/.test(h))
    const pi=headers.findIndex(h=>/tel|phone|movil|móvil/.test(h))
    const ai=headers.findIndex(h=>/dir|address/.test(h))
    const errs=[]
    if(ni<0)errs.push('Columna "nombre" no encontrada')
    if(ei<0)errs.push('Columna "correo/email" no encontrada')
    if(pi<0)errs.push('Columna "telefono" no encontrada')
    if(errs.length)return{rows:[],errors:errs}
    const rows=[];
    lines.slice(1).forEach((line,i)=>{
      const cols=line.split(',').map(c=>c.trim().replace(/^"|"$/g,''))
      const n=cols[ni]||'',e=cols[ei]||'',p=cols[pi]||''
      if(!n||!e||!p){errs.push(`Fila ${i+2}: faltan campos`);return}
      rows.push({full_name:n,email:e,phone:p,address:ai>=0?cols[ai]||'':'',status:'activo',source:'csv'})
    })
    return{rows,errors:errs}
  }

  const handleCSVFile=async file=>{
    if(!file)return
    const text=await file.text()
    const{rows,errors}=parseCSV(text)
    setCsvRows(rows);setCsvErrors(errors);setCsvDone(null)
  }

  const importCSV=async()=>{
    if(!csvRows.length)return
    setCsvImporting(true)
    const{data,error}=await supabase.from('crm_contacts').insert(csvRows.map(r=>({...r,user_id:user.id}))).select()
    setCsvImporting(false)
    if(error){setCsvErrors([error.message]);return}
    setContacts(p=>[...(data||[]),...p])
    setCsvDone(`✓ ${data?.length||0} contactos importados`)
    setCsvRows([]);setCsvErrors([])
  }

  const getAdvisorName=useCallback(uid=>staffList.find(s=>s.user_id===uid)?.display_name||'Asesor',[staffList])

  return <div>
    <SHdr title={isSuperAdmin?'Todos los Contactos':'Mis Contactos'}
      sub={isSuperAdmin?`${filtered.length} de ${contacts.length} · CRM + formularios web`:`${contacts.length} contactos propios`}
      action={<div style={{display:'flex',gap:8}}>
        {isSuperAdmin&&contacts.filter(c=>c._origStatus==='new').length>0&&<Btn variant="ghost" onClick={async()=>{
          const newIds=contacts.filter(c=>c._origStatus==='new'&&c.id.startsWith('sub_')).map(c=>c.id.replace('sub_',''))
          if(!newIds.length)return
          await supabase.from('contact_submissions').update({status:'read'}).in('id',newIds)
          setContacts(p=>p.map(c=>c._origStatus==='new'?{...c,status:'activo',_origStatus:'read'}:c))
        }} style={{fontSize:12}}>✓ Marcar todos leídos ({contacts.filter(c=>c._origStatus==='new').length})</Btn>}
        <Btn variant="ghost" onClick={()=>setTab(tab==='csv'?'lista':'csv')}>📂 CSV</Btn>
        <Btn onClick={()=>setTab(tab==='nuevo'?'lista':'nuevo')}>+ Nuevo</Btn>
      </div>}/>

    {tab==='nuevo'&&<GlassCard accent={P.purple} style={{marginBottom:20}}>
      <p style={{fontWeight:700,color:P.text,marginBottom:18,margin:'0 0 18px'}}>Nuevo contacto</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        {[['full_name','Nombre completo *','Juan García'],['email','Email *','juan@empresa.com'],['phone','Teléfono *','+56 9...']].map(([f,l,p])=>(
          <div key={f}>
            <Lbl>{l}</Lbl>
            <Input value={form[f]} onChange={v=>setForm(x=>({...x,[f]:v}))} placeholder={p} type={f==='email'?'email':'text'}
              style={formErr[f]?{border:`1px solid ${P.red}`}:{}}/>
            {formErr[f]&&<p style={{fontSize:11,color:P.red,marginTop:3,margin:'3px 0 0'}}>{formErr[f]}</p>}
          </div>
        ))}
        <div><Lbl>Estado</Lbl><Sel value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={STATUS_OPT}/></div>
        <div style={{gridColumn:'1/-1'}}><Lbl>Dirección (opcional)</Lbl><Input value={form.address} onChange={v=>setForm(p=>({...p,address:v}))} placeholder="Av. Ejemplo 123"/></div>
        <div style={{gridColumn:'1/-1'}}><Lbl>Notas (opcional)</Lbl>
          <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notas internas..."
            style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:10,color:P.text,fontSize:13,outline:'none',width:'100%',minHeight:60,resize:'vertical',fontFamily:'inherit'}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <Btn variant="ghost" onClick={()=>setTab('lista')}>Cancelar</Btn>
        <Btn onClick={saveContact} disabled={saving}>{saving?'Guardando...':'Guardar'}</Btn>
      </div>
    </GlassCard>}

    {tab==='csv'&&<GlassCard accent={P.blue} style={{marginBottom:20}}>
      <p style={{fontWeight:700,color:P.text,marginBottom:6,margin:'0 0 6px'}}>Importar CSV</p>
      <p style={{fontSize:12,color:P.muted,marginBottom:14,margin:'0 0 14px'}}>Columnas requeridas: <strong style={{color:P.text}}>nombre, correo, telefono</strong> · opcional: direccion</p>
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <button onClick={()=>{const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent('nombre,correo,telefono,direccion\nJuan García,juan@ejemplo.com,+56912345678,Av. Ejemplo 123');a.download='plantilla.csv';a.click()}}
          style={{fontSize:12,color:P.blue,background:P.blueDim,border:`1px solid ${P.blue}30`,borderRadius:6,padding:'5px 12px',cursor:'pointer'}}>⬇ Plantilla CSV</button>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);handleCSVFile(e.dataTransfer.files[0])}}
        style={{border:`2px dashed ${dragOver?P.blue:P.border}`,borderRadius:10,padding:'20px',textAlign:'center',background:dragOver?P.blueDim:'rgba(255,255,255,0.02)',cursor:'pointer',marginBottom:12}}
        onClick={()=>document.getElementById('csvInput').click()}>
        <p style={{fontSize:14,color:P.textSub,margin:0}}>📂 Arrastra tu CSV o <span style={{color:P.blue,fontWeight:600}}>haz clic</span></p>
        <input id="csvInput" type="file" accept=".csv" style={{display:'none'}} onChange={e=>handleCSVFile(e.target.files[0])}/>
      </div>
      {csvErrors.length>0&&<div style={{marginBottom:10,padding:'10px',background:P.redDim,borderRadius:8}}>{csvErrors.map((e,i)=><p key={i} style={{fontSize:12,color:P.red,margin:'2px 0'}}>{e}</p>)}</div>}
      {csvRows.length>0&&<div>
        <p style={{fontSize:12,color:P.muted,marginBottom:8,margin:'0 0 8px'}}>{csvRows.length} contactos listos</p>
        {csvDone&&<div style={{marginBottom:10,padding:'8px 12px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}><p style={{fontSize:13,color:P.green,margin:0}}>{csvDone}</p></div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>{setCsvRows([]);setCsvErrors([]);setCsvDone(null)}}>Cancelar</Btn>
          <Btn variant="blue" onClick={importCSV} disabled={csvImporting}>{csvImporting?'Importando...':'Importar '+csvRows.length}</Btn>
        </div>
      </div>}
    </GlassCard>}

    <div style={{display:'flex',gap:10,marginBottom:16}}>
      <Input value={search} onChange={setSearch} placeholder="Buscar nombre, email o teléfono..." style={{maxWidth:300}}/>
      <Sel value={statusFilter} onChange={setStatusFilter} style={{maxWidth:160}} options={[{value:'todos',label:'Todos (incl. spam)'},{value:'activos',label:'Activos (excl. spam)'},...STATUS_OPT]}/>
      {isSuperAdmin&&staffList.length>0&&<Sel value={userFilter} onChange={setUserFilter} style={{maxWidth:200}} options={[{value:'todos',label:'Todos los asesores'},...staffList.map(s=>({value:s.user_id,label:s.display_name}))]}/>}
      <Btn variant="ghost" onClick={load} style={{padding:'9px 12px'}}>↺</Btn>
    </div>

    {loading?<Spinner/>:<GlassCard style={{padding:0}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr style={{borderBottom:`1px solid ${P.border}`}}>
          {[...(isSuperAdmin?['Asesor']:[]),(isSuperAdmin?'Capital':''),'Nombre','Email','Teléfono','Estado','Origen',''].filter(Boolean).map(h=>(
            <th key={h} style={{padding:'12px 18px',textAlign:'left',fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',fontWeight:600}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {filtered.map((c,i)=>(
            <tr key={c.id} style={{borderBottom:i<filtered.length-1?`1px solid ${P.border}`:'none',cursor:'pointer',transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              onClick={()=>openContact(c)}>
              {isSuperAdmin&&<td style={{padding:'12px 18px'}}><span style={{fontSize:11,color:P.purple,background:P.purpleDim,borderRadius:4,padding:'2px 8px'}}>{c.user_id?getAdvisorName(c.user_id):'Web'}</span></td>}
              {isSuperAdmin&&<td style={{padding:'12px 18px',fontSize:12,color:P.green,fontFamily:'monospace',fontWeight:600}}>{c._capital>0?fmt(c._capital):'—'}</td>}
              <td style={{padding:'12px 18px'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:30,height:30,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:P.purple,flexShrink:0}}>{(c.full_name||'?')[0]}</div>
                  <span style={{fontSize:13,fontWeight:600,color:P.text}}>{c.full_name}</span>
                </div>
              </td>
              <td style={{padding:'12px 18px',color:P.muted,fontSize:12,fontFamily:'monospace'}}>{c.email}</td>
              <td style={{padding:'12px 18px',color:P.muted,fontSize:12}}>{c.phone}</td>
              <td style={{padding:'12px 18px'}}><Badge label={c.status} color={SCOLOR_MAP[c.status]||P.muted}/></td>
              <td style={{padding:'12px 18px'}}><div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}><Badge label={c.source||'crm'} color={c.source==='csv'?P.blue:c.source==='formulario'?P.orange:P.muted}/>{c._origStatus==='new'&&<Badge label="nuevo" color={P.orange}/>}</div></td>
              <td style={{padding:'12px 18px'}}><Btn variant="ghost" style={{padding:'4px 10px',fontSize:11}}>Ver →</Btn></td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length===0&&<div style={{textAlign:'center',padding:48,color:P.muted,fontSize:13}}>{contacts.length===0?'Aún no tienes contactos. Añade uno o importa un CSV.':'Sin resultados.'}</div>}
    </GlassCard>}

    {selected&&<Modal title={selected.full_name} onClose={()=>setSelected(null)}>
      <div>
        <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
          <Badge label={selected.status} color={SCOLOR_MAP[selected.status]||P.muted}/>
          <Badge label={selected.source||'crm'} color={selected.source==='formulario'?P.orange:selected.source==='csv'?P.blue:P.muted}/>
          {selected._capital>0&&<span style={{fontSize:13,color:P.green,fontFamily:'monospace',fontWeight:700}}>{fmt(selected._capital)}</span>}
        </div>
        {[['Email',selected.email],['Teléfono',selected.phone],['Dirección',selected.address||'—'],['Registro',fmtDate(selected.created_at)]].map(([k,v])=>(
          <div key={k} style={{paddingBottom:12,marginBottom:12,borderBottom:`1px solid ${P.border}`}}>
            <p style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:4,margin:'0 0 4px',fontWeight:600}}>{k}</p>
            <p style={{fontSize:13,color:P.text,margin:0}}>{v}</p>
          </div>
        ))}
        <div style={{marginBottom:18}}>
          <Lbl>Cambiar estado</Lbl>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {STATUS_OPT.map(s=>(
              <button key={s.value} onClick={()=>updateStatus(selected.id,s.value)}
                style={{padding:'5px 12px',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,
                  background:selected.status===s.value?SCOLOR_MAP[s.value]+'30':'rgba(255,255,255,0.04)',
                  color:selected.status===s.value?SCOLOR_MAP[s.value]:P.muted,
                  border:`1px solid ${selected.status===s.value?SCOLOR_MAP[s.value]+'50':P.border}`}}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:P.purple,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:10,margin:'0 0 10px'}}>Notas ({notes.length})</p>
          {notes.map(n=><div key={n.id} style={{padding:'10px 12px',marginBottom:8,background:'rgba(108,92,231,0.08)',borderRadius:8,borderLeft:`3px solid ${P.purple}`}}>
            <p style={{fontSize:13,color:P.textSub,margin:'0 0 4px',lineHeight:1.6}}>{n.content}</p>
            <p style={{fontSize:10,color:P.muted,margin:0}}>{fmtDate(n.created_at)}</p>
          </div>)}
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <Input value={noteText} onChange={setNoteText} placeholder="Añadir nota..." style={{flex:1}}/>
            <Btn onClick={addNote} disabled={!noteText.trim()}>+</Btn>
          </div>
        </div>
      </div>
    </Modal>}
  </div>
}
