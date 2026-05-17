import { P } from './constants.js'

export function Badge({label,color}){
  return <span style={{display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',background:color+'20',color,border:`1px solid ${color}35`}}>{label}</span>
}

export function GlassCard({children,style={},accent}){
  return <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:14,padding:20,position:'relative',overflow:'hidden',...style}}>
    {accent&&<div style={{position:'absolute',top:-30,right:-30,width:100,height:100,background:`radial-gradient(circle,${accent}25,transparent 70%)`,borderRadius:'50%',pointerEvents:'none'}}/>}
    {children}
  </div>
}

export function StatCard({label,value,sub,Icon,accent=P.purple}){
  return <GlassCard accent={accent} style={{flex:1,minWidth:150}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',margin:0}}>{label}</p>
      <div style={{width:28,height:28,borderRadius:8,background:accent+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>{Icon}</div>
    </div>
    <div style={{display:'inline-flex',background:accent+'18',border:`1px solid ${accent}35`,borderRadius:8,padding:'5px 12px',marginBottom:sub?6:0}}>
      <span style={{fontSize:16,fontWeight:700,color:accent,fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
    </div>
    {sub&&<p style={{fontSize:11,color:P.muted,marginTop:4,margin:'4px 0 0'}}>{sub}</p>}
  </GlassCard>
}

export function Input({value,onChange,placeholder,type='text',style={}}){
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',...style}}/>
}

export function Sel({value,onChange,options,style={}}){
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${P.border}`,borderRadius:8,padding:'9px 12px',color:P.text,fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',...style}}>
    {options.map(o=><option key={o.value} value={o.value} style={{background:P.surface}}>{o.label}</option>)}
  </select>
}

export function Btn({children,onClick,variant='primary',style={},disabled=false}){
  const vs={
    primary:{background:`linear-gradient(135deg,#7c6fee,${P.purple})`,color:'#fff',border:'none',fontWeight:600,boxShadow:`0 4px 14px ${P.purple}40`},
    ghost:{background:'rgba(255,255,255,0.04)',color:P.textSub,border:`1px solid ${P.border}`,fontWeight:500},
    blue:{background:`linear-gradient(135deg,#1a9bff,${P.blue})`,color:'#fff',border:'none',fontWeight:600},
    danger:{background:P.redDim,color:P.red,border:`1px solid ${P.red}35`,fontWeight:500},
    green:{background:P.greenDim,color:P.green,border:`1px solid ${P.green}35`,fontWeight:600},
  }
  return <button onClick={onClick} disabled={disabled}
    style={{padding:'9px 16px',borderRadius:8,fontSize:13,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,display:'inline-flex',alignItems:'center',gap:6,...vs[variant],...style}}>{children}</button>
}

export function Modal({title,onClose,children,accent=P.purple}){
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
    <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,width:'100%',maxWidth:540,maxHeight:'90vh',overflow:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.6)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:8,height:8,borderRadius:'50%',background:accent}}/><h3 style={{margin:0,fontSize:16,fontWeight:700,color:P.text}}>{title}</h3></div>
        <button onClick={onClose} style={{background:'none',border:'none',color:P.muted,cursor:'pointer',fontSize:20}}>✕</button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>
}

export function Lbl({children}){
  return <label style={{fontSize:11,color:P.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>{children}</label>
}

export function Spinner(){
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60}}><div style={{width:28,height:28,border:`3px solid ${P.border}`,borderTop:`3px solid ${P.purple}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>
}

export function SHdr({title,sub,action}){
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
    <div><h2 style={{fontSize:20,fontWeight:700,color:P.text,marginBottom:4,margin:'0 0 4px'}}>{title}</h2>{sub&&<p style={{fontSize:13,color:P.muted,margin:0}}>{sub}</p>}</div>
    {action}
  </div>
}
