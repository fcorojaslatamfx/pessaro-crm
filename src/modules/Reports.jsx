import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { P, STAGES, STAGE_LABEL, ETAPA_STAGE, fmt, TT } from '../lib/constants.js'
import { LOGO_URI } from '../lib/logo.js'
import { GlassCard, StatCard, Btn, SHdr } from '../lib/ui.jsx'

function exportCSV(contacts,leads){
  const e=v=>`"${String(v||'').replace(/"/g,'""')}"`
  const rows=[
    ['FORMULARIOS','','','','','',''].join(','),
    ['Nombre','Email','Teléfono','Capital USD','Gestión','Estado','Fecha'].map(e).join(','),
    ...contacts.map(c=>[c.full_name,c.email,c.mobile||c.phone||'',c.investment_capital||c._capital||'',c.management_type||'',c.status,c.submitted_at||c.created_at||''].map(e).join(',')),
    '',
    ['PIPELINE LEADS','','','','','','','','','',''].join(','),
    ['Nombre','Email','Capital','Etapa','Equipo','Contactado','Cuenta','KYC','Depósito','Score','Fecha'].map(e).join(','),
    ...leads.map(l=>[l.full_name,l.email,l.investment_range||'',l.etapa,l.team||'',l.advisor_contacted?'Sí':'No',l.account_created?'Sí':'No',l.kyc_verified?'Sí':'No',l.deposit_confirmed?'Sí':'No',l.score||0,l.created_at||''].map(e).join(','))
  ]
  const a=document.createElement('a')
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(rows.join('\n'))
  a.download=`Pessaro_CRM_${new Date().toISOString().slice(0,10)}.csv`;a.click()
}

function exportExcel(contacts,leads){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const row=cells=>`<Row>${cells.map(c=>`<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`
  const s1=[row(['Nombre','Email','Teléfono','Capital USD','Gestión','Estado','Fecha']),...contacts.map(c=>row([c.full_name,c.email,c.mobile||c.phone||'',c.investment_capital||c._capital||'',c.management_type||'',c.status,c.submitted_at||c.created_at||'']))].join('')
  const s2=[row(['Nombre','Email','Capital','Etapa','Equipo','Contactado','Cuenta','KYC','Depósito','Score','Fecha']),...leads.map(l=>row([l.full_name,l.email,l.investment_range||'',l.etapa,l.team||'',l.advisor_contacted?'Sí':'No',l.account_created?'Sí':'No',l.kyc_verified?'Sí':'No',l.deposit_confirmed?'Sí':'No',l.score||0,l.created_at||'']))].join('')
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Formularios"><Table>${s1}</Table></Worksheet><Worksheet ss:Name="Pipeline"><Table>${s2}</Table></Worksheet></Workbook>`
  const a=document.createElement('a')
  a.href='data:application/vnd.ms-excel,'+encodeURIComponent(xml)
  a.download=`Pessaro_CRM_${new Date().toISOString().slice(0,10)}.xls`;a.click()
}

function openPDF(contacts,leads){
  const now=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})
  const fmtUSD=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0)
  const totalCap=contacts.reduce((s,c)=>s+(Number(c.investment_capital||c._capital)||0),0)
  const closed=leads.filter(l=>l.etapa===5).length
  const pct=(n,t)=>t?Math.round(n/t*100):0
  const etapaRows=[['Lead',1],['Contactado',2],['Propuesta',3],['Negociación',4],['Cerrado',5]].map(([lbl,e])=>{
    const n=leads.filter(l=>l.etapa===e).length
    return `<tr><td>${lbl}</td><td>${n}</td><td>${pct(n,leads.length)}%</td></tr>`
  }).join('')
  const statusRows=[['Sin leer','new','#f59e0b'],['Leídos','read','#3b82f6'],['Respondidos','replied','#10b981'],['Archivados','archived','#6b7280']].map(([lbl,s,col])=>{
    const n=contacts.filter(c=>c.status===s).length
    return `<tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:7px"></span>${lbl}</td><td>${n}</td><td>${pct(n,contacts.length)}%</td></tr>`
  }).join('')
  const convRows=[['Contactados',leads.filter(l=>l.advisor_contacted).length],['Cuenta creada',leads.filter(l=>l.account_created).length],['KYC verificado',leads.filter(l=>l.kyc_verified).length],['Depósito confirmado',leads.filter(l=>l.deposit_confirmed).length]].map(([lbl,n])=>`<tr><td>${lbl}</td><td>${n}</td><td>${pct(n,leads.length)}%</td></tr>`).join('')
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe CRM Pessaro Capital</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#f0f4f8;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{background:#050816;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}
.brand{display:flex;align-items:center;gap:12px}
.brand img{width:38px;height:38px;border-radius:8px}
.brand strong{color:#fff;font-size:14px;display:block}
.brand small{color:#94a3b8;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
.btns{display:flex;gap:10px}
.btn{border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;padding:9px 18px;border-radius:9px}
.btn-p{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.35)}
.btn-g{background:rgba(255,255,255,.06);color:#e6ecff;border:1px solid rgba(255,255,255,.14)}
@media print{.toolbar{display:none!important}body{background:#fff}.wrap{margin:0;padding:0}.card{border-radius:0;box-shadow:none}}
.wrap{max-width:900px;margin:24px auto 48px;padding:0 20px}
.card{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.28);overflow:hidden}
.band{background:linear-gradient(135deg,#050816 0%,#0a1f5c 35%,#1e3a8a 70%,#2563eb 100%);padding:28px 44px 22px;display:flex;align-items:center;gap:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.band-logo{width:54px;height:54px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);overflow:hidden;flex-shrink:0}
.band-logo img{width:100%;height:100%;object-fit:cover}
.band-lbl{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#6190ff;font-weight:600;margin-bottom:4px}
.band h1{font-size:19px;font-weight:700;color:#fff}
.band-sub{color:#b9c5e6;font-size:12px;margin-top:3px}
.band-date{margin-left:auto;text-align:right}
.band-date .val{color:#e6ecff;font-size:13px;font-weight:600}
.gold{height:4px;background:linear-gradient(135deg,#b8860b,#d4af37,#fbbf24);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.body{padding:34px 44px 30px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:15px;text-align:center}
.kpi.dk{background:linear-gradient(135deg,#0a1f5c,#1e3a8a);border-color:#2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpi-lbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;margin-bottom:6px}
.kpi .kpi-lbl{color:#64748b}.kpi.dk .kpi-lbl{color:#93c5fd}
.kpi-val{font-size:20px;font-weight:800}
.kpi .kpi-val{color:#0a1f5c}.kpi.dk .kpi-val{color:#fff}
.kpi-sub{font-size:10px;margin-top:3px}
.kpi .kpi-sub{color:#94a3b8}.kpi.dk .kpi-sub{color:#7dd3fc}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
.sec{margin-bottom:24px}
.sec-title{font-size:10px;font-weight:700;color:#2563eb;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:7px;border-bottom:2px solid #e2e8f0}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f1f5f9;color:#64748b;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:9px 12px;text-align:left}
td{padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#1f2937}
tr:last-child td{border-bottom:none}
.disc{margin-top:22px;padding:11px 15px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;font-size:11px;color:#78350f;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.foot{margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.foot-brand{display:flex;align-items:center;gap:8px}
.foot-brand img{width:24px;height:24px;border-radius:5px}
.foot-brand span{font-size:11px;color:#94a3b8}
.foot-note{font-size:10px;color:#cbd5e1;text-align:right;line-height:1.6}
</style></head><body>
<div class="toolbar">
  <div class="brand"><img src="${LOGO_URI}" alt="Pessaro"><div><strong>Pessaro Capital</strong><small>CRM Interno</small></div></div>
  <div class="btns"><button class="btn btn-p" onclick="window.print()">🖨 Imprimir / Guardar PDF</button><button class="btn btn-g" onclick="window.close()">✕ Cerrar</button></div>
</div>
<div class="wrap"><div class="card">
  <div class="band">
    <div class="band-logo"><img src="${LOGO_URI}" alt="Pessaro"></div>
    <div><div class="band-lbl">Informe de Gestión</div><h1>Reporte CRM — Pessaro Capital</h1><div class="band-sub">Generado automáticamente · Supabase</div></div>
    <div class="band-date"><div class="band-lbl">Fecha</div><div class="val">${now}</div></div>
  </div>
  <div class="gold"></div>
  <div class="body">
    <div class="kpis">
      <div class="kpi dk"><div class="kpi-lbl">Formularios</div><div class="kpi-val">${contacts.length}</div><div class="kpi-sub">Desde pessaro.cl</div></div>
      <div class="kpi dk"><div class="kpi-lbl">Capital declarado</div><div class="kpi-val">${fmtUSD(totalCap)}</div><div class="kpi-sub">Total acumulado</div></div>
      <div class="kpi"><div class="kpi-lbl">Leads pipeline</div><div class="kpi-val">${leads.length}</div><div class="kpi-sub">${closed} cerrados</div></div>
      <div class="kpi"><div class="kpi-lbl">Tasa de cierre</div><div class="kpi-val">${pct(closed,leads.length)}%</div><div class="kpi-sub">Conversión total</div></div>
    </div>
    <div class="two">
      <div class="sec"><div class="sec-title">Pipeline por etapa</div><table><thead><tr><th>Etapa</th><th>Leads</th><th>%</th></tr></thead><tbody>${etapaRows}</tbody></table></div>
      <div class="sec"><div class="sec-title">Estado formularios</div><table><thead><tr><th>Estado</th><th>Cantidad</th><th>%</th></tr></thead><tbody>${statusRows}</tbody></table></div>
    </div>
    <div class="sec"><div class="sec-title">Conversión del pipeline</div><table><thead><tr><th>Hito</th><th>Leads</th><th>% del total</th></tr></thead><tbody>${convRows}</tbody></table></div>
    <div class="disc">⚠️ <strong>Aviso de riesgo:</strong> Este informe es de uso interno exclusivo de Pessaro Capital SpA. La rentabilidad pasada no garantiza resultados futuros. Toda inversión implica riesgo de pérdida.</div>
    <div class="foot"><div class="foot-brand"><img src="${LOGO_URI}" alt="Pessaro"><span>Pessaro Capital SpA · pessaro.cl</span></div><div class="foot-note">CRM Interno · ${now}<br>Confidencial — No distribuir</div></div>
  </div>
</div></div></body></html>`
  const w=window.open('','_blank')
  w.document.write(html)
  w.document.close()
}

export default function Reports({contacts,leads}){
  const closed   = useMemo(()=>leads.filter(l=>l.etapa===5).length,[leads])
  const totalCap = useMemo(()=>contacts.reduce((s,c)=>s+(Number(c.investment_capital||c._capital)||0),0),[contacts])
  const pipeData = useMemo(()=>STAGES.map(s=>({name:STAGE_LABEL[s],v:leads.filter(l=>ETAPA_STAGE[l.etapa]===s).length})),[leads])
  const capData  = useMemo(()=>['1k-5k','5k-20k','20k-50k','50k+'].map(r=>({name:r,v:leads.filter(l=>l.investment_range===r).length})),[leads])

  return <div>
    <SHdr title="Reportes" sub="Analíticas en tiempo real"
      action={<div style={{display:'flex',gap:8}}>
        <Btn variant="ghost" onClick={()=>exportCSV(contacts,leads)} style={{fontSize:12}}>⬇ CSV</Btn>
        <Btn variant="ghost" onClick={()=>exportExcel(contacts,leads)} style={{fontSize:12}}>⬇ Excel</Btn>
        <Btn onClick={()=>openPDF(contacts,leads)} style={{fontSize:12,background:'linear-gradient(135deg,#0a1f5c,#2563eb)',color:'#fff',border:'none',boxShadow:'0 4px 14px rgba(37,99,235,.35)'}}>🖨 PDF corporativo</Btn>
      </div>}/>
    <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
      <StatCard label="Formularios" value={contacts.length} accent={P.purple} Icon="📋"/>
      <StatCard label="Capital declarado" value={fmt(totalCap)} accent={P.green} Icon="💵"/>
      <StatCard label="Leads totales" value={leads.length} accent={P.blue} Icon="◈"/>
      <StatCard label="Cerrados" value={closed} accent={P.orange} Icon="✓"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Leads por etapa</p>
        <ResponsiveContainer width="100%" height={190}><BarChart data={pipeData} barSize={24}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.purple} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
      </GlassCard>
      <GlassCard>
        <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Leads por capital</p>
        <ResponsiveContainer width="100%" height={190}><BarChart data={capData} barSize={24}><XAxis dataKey="name" tick={{fill:P.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip {...TT} formatter={v=>[v,'Leads']}/><Bar dataKey="v" fill={P.blue} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
      </GlassCard>
    </div>
    <GlassCard>
      <p style={{fontSize:10,fontWeight:600,color:P.muted,textTransform:'uppercase',letterSpacing:'0.10em',marginBottom:16,margin:'0 0 16px'}}>Conversión del pipeline</p>
      <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
        {[['Contactados',leads.filter(l=>l.advisor_contacted).length,P.blue],['Cuenta',leads.filter(l=>l.account_created).length,P.purple],['KYC',leads.filter(l=>l.kyc_verified).length,P.orange],['Depósito',leads.filter(l=>l.deposit_confirmed).length,P.green]].map(([k,v,c])=>(
          <div key={k} style={{flex:1,minWidth:110,textAlign:'center',padding:'18px 10px',borderRadius:12,background:`${c}10`,border:`1px solid ${c}25`}}>
            <div style={{fontSize:30,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</div>
            <div style={{fontSize:11,color:P.muted,marginTop:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>{k}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  </div>
}
