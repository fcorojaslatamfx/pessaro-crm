import { useState, useEffect, useMemo, Suspense, lazy } from 'react'
import { supabase } from './lib/supabase.js'
import { P } from './lib/constants.js'
import { LOGO_URI } from './lib/logo.js'
import { Spinner } from './lib/ui.jsx'
import Login from './modules/Login.jsx'
import Dashboard from './modules/Dashboard.jsx'

// ─── LAZY MODULES (code-split por ruta) ──────────────────────────────────────
const LazyContacts      = lazy(()=>import('./modules/Contacts.jsx'))
const LazyPipeline      = lazy(()=>import('./modules/Pipeline.jsx'))
const LazyCampanaModule = lazy(()=>import('./modules/CampanaModule.jsx'))
const LazyTasks         = lazy(()=>import('./modules/Tasks.jsx'))
const LazyEmails        = lazy(()=>import('./modules/Emails.jsx'))
const LazyReports       = lazy(()=>import('./modules/Reports.jsx'))
const LazyEquipo        = lazy(()=>import('./modules/Equipo.jsx'))
const LazyAdminCampaigns= lazy(()=>import('./modules/AdminCampaigns.jsx'))

export default function App(){
  const[user,setUser]          = useState(null)
  const[checking,setChecking]  = useState(true)
  const[isSuperAdmin,setSA]    = useState(false)
  const[module,setModule]      = useState('dashboard')
  const[contacts,setContacts]  = useState([])
  const[leads,setLeads]        = useState([])
  const[staffProfile,setSP]    = useState(null)
  const[campaigns,setCampaigns]= useState([])
  const[loading,setLoading]    = useState(true)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const checkRole=async(u)=>{
      if(!u){setSA(false);return}
      try{
        const{data}=await supabase.rpc('get_my_role')
        setSA(data==='super_admin')
      }catch(e){
        console.warn('get_my_role fallback:',e)
        setSA(u?.user_metadata?.role==='super_admin'||u?.app_metadata?.role==='super_admin')
      }
    }
    supabase.auth.getSession().then(async({data:{session}})=>{
      const u=session?.user??null
      setUser(u)
      await checkRole(u)
      setChecking(false)
    }).catch(()=>setChecking(false))
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(_,session)=>{
      const u=session?.user??null
      setUser(prev=>{
        if(prev?.id===u?.id) return prev
        return u
      })
      await checkRole(u)
    })
    return()=>subscription.unsubscribe()
  },[])

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!user)return
    const load=async()=>{
      setLoading(true)
      try{
        const[r1,r2,r3,r4]=await Promise.all([
          supabase.from('contact_submissions').select('id,full_name,email,mobile,investment_capital,management_type,comments,form_type,status,submitted_at').order('submitted_at',{ascending:false}).limit(200),
          supabase.from('campaign_leads').select('id,full_name,email,phone,investment_range,etapa,advisor_assigned,advisor_contacted,account_created,kyc_verified,deposit_confirmed,score,team,created_at').order('created_at',{ascending:false}),
          supabase.from('crm_staff_profiles').select('*').eq('user_id',user.id).maybeSingle(),
          supabase.from('campaigns').select('*').eq('status','activa').order('created_at'),
        ])
        setContacts(r1.data||[])
        setLeads(r2.data||[])
        setSP(r3.data||null)
        setCampaigns(r4.data||[])
      }catch(e){console.error('data load:',e)}
      finally{setLoading(false)}
    }
    load()
  },[user?.id])

  // ── Global CSS ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    const s=document.createElement('style')
    s.textContent=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{background:${P.bg};color:${P.text};font-family:'Inter',sans-serif;}input,select,textarea{font-family:'Inter',sans-serif!important;}::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}input::placeholder,textarea::placeholder{color:${P.muted}!important;}select option{background:${P.surface};}input:focus,select:focus,textarea:focus{border-color:rgba(108,92,231,0.5)!important;}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`
    document.head.appendChild(s)
    return()=>document.head.removeChild(s)
  },[])

  if(checking)return<div style={{minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,border:`3px solid ${P.border}`,borderTop:`3px solid ${P.purple}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>
  if(!user)return<Login onLogin={setUser}/>

  const logout=async()=>{await supabase.auth.signOut();setUser(null);setSA(false)}

  // ── NAV ─────────────────────────────────────────────────────────────────────
  const NAV=useMemo(()=>[
    {id:'dashboard',label:'Dashboard',icon:'⊞'},
    {id:'contacts', label:'Contactos', icon:'📋'},
    {id:'pipeline', label:'Pipeline',  icon:'◈'},
    ...campaigns.map(c=>({id:'camp_'+c.id,label:c.name,icon:'🚀',color:P.green})),
    {id:'tasks',    label:'Tareas',    icon:'✓'},
    {id:'emails',   label:'Emails',    icon:'✉'},
    {id:'reports',  label:'Reportes',  icon:'▦'},
    {id:'equipo',   label:'Equipo',    icon:'👥'},
    ...(isSuperAdmin?[{id:'admin_campaigns',label:'Campañas',icon:'⚙',color:P.orange}]:[]),
  ],[campaigns,isSuperAdmin])

  const validMods=useMemo(()=>new Set(NAV.map(n=>n.id)),[NAV])
  const currentMod=validMods.has(module)?module:'dashboard'

  // Resolve campaign for camp_* modules
  const campId   = currentMod.startsWith('camp_') ? currentMod.slice(5) : null
  const campaign = useMemo(()=>campId?campaigns.find(c=>c.id===campId):null,[campId,campaigns])

  return <div style={{display:'flex',minHeight:'100vh',background:P.bg}}>
    {/* Sidebar */}
    <div style={{width:218,background:P.sidebar,borderRight:`1px solid ${P.border}`,display:'flex',flexDirection:'column',flexShrink:0,position:'sticky',top:0,height:'100vh'}}>
      <div style={{padding:'22px 18px',borderBottom:`1px solid ${P.border}`,display:'flex',alignItems:'center',gap:12}}>
        <img src={LOGO_URI} width={32} height={32} style={{borderRadius:6,objectFit:'cover',display:'block'}} alt="Pessaro"/>
        <div><div style={{fontSize:14,fontWeight:800,color:P.text,letterSpacing:'-0.01em'}}>Pessaro</div><div style={{fontSize:10,color:P.purple,letterSpacing:'0.10em',textTransform:'uppercase',fontWeight:600}}>Capital CRM</div></div>
      </div>
      <nav style={{padding:'10px 8px',flex:1,overflowY:'auto'}}>
        {NAV.map(item=>{
          const active=currentMod===item.id
          const ic=item.color||P.purple
          return <button key={item.id} onClick={()=>setModule(item.id)}
            style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:8,marginBottom:2,cursor:'pointer',textAlign:'left',
              background:active?ic+'22':'transparent',color:active?ic:P.muted,
              border:active?`1px solid ${ic}35`:'1px solid transparent',
              fontSize:13,fontWeight:active?600:400,transition:'all 0.12s'}}>
            <span style={{fontSize:15,width:18,textAlign:'center',opacity:active?1:0.7}}>{item.icon}</span>
            <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</span>
            {active&&<div style={{width:5,height:5,borderRadius:'50%',background:ic,flexShrink:0}}/>}
          </button>
        })}
      </nav>
      <div style={{padding:'10px 18px',borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',background:P.greenDim,border:`1px solid ${P.green}30`,borderRadius:8}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:P.green}}/><span style={{fontSize:10,color:P.green,fontWeight:600}}>Supabase conectado</span>
        </div>
      </div>
      <div style={{padding:'14px 18px'}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:P.purpleDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:P.purple}}>{(staffProfile?.display_name||user?.email||'?')[0].toUpperCase()}</div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:P.text}}>{staffProfile?.display_name||user?.email?.split('@')[0]}</div>
            <div style={{fontSize:10,color:P.muted}}>{staffProfile?.title||'Equipo interno'}</div>
          </div>
        </div>
        {staffProfile&&<div style={{padding:'4px 8px',background:P.purpleDim,border:`1px solid ${P.purpleBorder}`,borderRadius:5,marginBottom:8}}><p style={{fontSize:10,color:P.purple,margin:0,fontFamily:'monospace'}}>✉ {staffProfile.pessaro_email}</p></div>}
        {isSuperAdmin&&<div style={{padding:'3px 8px',background:P.orangeDim,border:`1px solid ${P.orange}30`,borderRadius:5,marginBottom:8}}><p style={{fontSize:10,color:P.orange,margin:0,fontWeight:600}}>⚙ Super Admin</p></div>}
        <button onClick={logout} style={{fontSize:11,color:P.muted,background:'none',border:'none',cursor:'pointer',padding:0}}>Cerrar sesión →</button>
      </div>
    </div>

    {/* Main content */}
    <div style={{flex:1,padding:'28px 32px',overflowY:'auto',minHeight:'100vh'}}>
      {loading&&currentMod==='dashboard'
        ? <Spinner/>
        : <Suspense fallback={<Spinner/>}>
            {currentMod==='dashboard' && <Dashboard contacts={contacts} leads={leads} onNav={setModule}/>}
            {currentMod==='contacts'  && <LazyContacts user={user} isSuperAdmin={isSuperAdmin}/>}
            {currentMod==='pipeline'  && <LazyPipeline leads={leads} setLeads={setLeads} isSuperAdmin={isSuperAdmin}/>}
            {campId && campaign        && <LazyCampanaModule key={currentMod} campaign={campaign} user={user} isSuperAdmin={isSuperAdmin} globalLeads={leads}/>}
            {currentMod==='tasks'     && <LazyTasks contacts={contacts} leads={leads}/>}
            {currentMod==='emails'    && <LazyEmails contacts={contacts} leads={leads} staffProfile={staffProfile} user={user}/>}
            {currentMod==='reports'   && <LazyReports contacts={contacts} leads={leads}/>}
            {currentMod==='equipo'    && <LazyEquipo user={user} isSuperAdmin={isSuperAdmin}/>}
            {currentMod==='admin_campaigns' && <LazyAdminCampaigns campaigns={campaigns} setCampaigns={setCampaigns} user={user}/>}
          </Suspense>
      }
    </div>
  </div>
}
