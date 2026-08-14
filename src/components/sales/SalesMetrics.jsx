// ─── VENTAS · KPIs del asesor ────────────────────────────────────────────────
//
// Los números NO se calculan en el navegador: los devuelve la RPC sales_kpis(),
// que agrega en SQL. Traerse la cartera entera para sumarla en el cliente
// funciona con 39 contactos y deja de funcionar con 4.000, y además obligaría a
// que el navegador viera filas que quizá no le tocan.
//
// El alcance lo decide la propia función: un asesor sólo obtiene lo suyo, pida
// lo que pida; admin y super_admin pueden pedir el de un asesor concreto o el
// del equipo entero (p_user_id null).

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  P, SALES_STAGES, STAGE_LABEL, STAGE_COLOR, esCerrada,
  fmtUSD, fmtPct, GlassCard, StatCard, Spinner, Sel,
} from './ui.jsx'

const TT = {
  contentStyle:{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:8, fontSize:12 },
  labelStyle:{ color:P.textSub }, itemStyle:{ color:P.text }, cursor:{ fill:'rgba(255,255,255,0.04)' },
}

const primerDiaDelMes = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().slice(0, 10)
const hoyISO = () => new Date().toISOString().slice(0, 10)

const PERIODOS = [
  { value:'mes',       label:'Este mes' },
  { value:'trimestre', label:'Últimos 3 meses' },
  { value:'anio',      label:'Este año' },
]

function rangoDe(periodo) {
  const hoy = new Date()
  if (periodo === 'trimestre') {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
    return { desde:d.toISOString().slice(0, 10), hasta:hoyISO() }
  }
  if (periodo === 'anio') {
    return { desde:`${hoy.getFullYear()}-01-01`, hasta:hoyISO() }
  }
  return { desde:primerDiaDelMes(), hasta:hoyISO() }
}

export default function SalesMetrics({ user, isSuperAdmin, staffProfile, staffList = [] }) {
  const [kpis, setKpis]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [periodo, setPeriodo] = useState('mes')
  // '' = el propio asesor. 'todos' = equipo completo (sólo admin).
  const [asesor, setAsesor]   = useState('')

  const isAdmin = isSuperAdmin || staffProfile?.role === 'admin'
  const debounce = useRef(null)

  const cargar = useCallback(async () => {
    setError('')
    const { desde, hasta } = rangoDe(periodo)
    const params = { p_from:desde, p_to:hasta }
    // p_user_id null => equipo. La función ignora este parámetro si quien llama
    // no es admin, así que un asesor curioso no gana nada tocándolo.
    if (isAdmin) params.p_user_id = asesor === 'todos' ? null : (asesor || user.id)
    const { data, error:err } = await supabase.rpc('sales_kpis', params)
    if (err) { setError(err.message); setKpis(null) }
    else setKpis(data)
    setLoading(false)
  }, [periodo, asesor, isAdmin, user?.id])

  useEffect(() => { setLoading(true); cargar() }, [cargar])

  // Realtime: el KPI se mueve cuando cambia una etapa o se registra una gestión.
  // Se recarga con retardo en vez de por evento — mover tres contactos seguidos
  // en el pipeline dispararía tres consultas encadenadas.
  useEffect(() => {
    const recargar = () => {
      clearTimeout(debounce.current)
      debounce.current = setTimeout(cargar, 1200)
    }
    const canal = supabase.channel('sales-kpis')
      .on('postgres_changes', { event:'*', schema:'public', table:'crm_contacts' }, recargar)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'contact_activity_log' }, recargar)
      .subscribe()
    return () => { clearTimeout(debounce.current); supabase.removeChannel(canal) }
  }, [cargar])

  if (loading && !kpis) return <Spinner/>

  if (error) return (
    <GlassCard accent={P.red} style={{ marginBottom:18 }}>
      <p style={{ fontSize:13, color:P.red, margin:0 }}>No se pudieron cargar los KPIs: {error}</p>
    </GlassCard>
  )
  if (!kpis) return null

  const k = kpis
  const etapas = k.etapas || {}
  // Se recorre SALES_STAGES y no las claves del jsonb para que las etapas vacías
  // también salgan en el gráfico: un embudo con huecos se lee mejor que uno que
  // esconde las etapas sin negocios.
  const datosEtapas = SALES_STAGES.map(s => ({
    id:s.id, name:s.label, v:etapas[s.id]?.n || 0,
    monto:Number(etapas[s.id]?.monto || 0), color:s.color,
  }))
  const seg = k.seguimientos || {}
  const hayVencidos = (seg.vencidos || 0) > 0

  return (
    <div style={{ marginBottom:22 }}>
      {/* Cabecera + filtros */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        gap:12, flexWrap:'wrap', marginBottom:14 }}>
        <div>
          <h3 style={{ fontSize:14, fontWeight:700, color:P.text, margin:'0 0 2px' }}>Mi gestión comercial</h3>
          <p style={{ fontSize:11, color:P.muted, margin:0 }}>
            {k.alcance === 'equipo' ? 'Equipo completo' : 'Cartera propia'} · {k.desde} a {k.hasta}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {isAdmin && staffList.length > 0 && (
            <Sel value={asesor} onChange={setAsesor} style={{ width:'auto', minWidth:160 }}
              options={[
                { value:'', label:'Mi cartera' },
                { value:'todos', label:'Todo el equipo' },
                ...staffList.map(s => ({ value:s.user_id, label:s.display_name || 'Sin nombre' })),
              ]}/>
          )}
          <Sel value={periodo} onChange={setPeriodo} style={{ width:'auto', minWidth:140 }} options={PERIODOS}/>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:14 }}>
        <StatCard label="Tasa de cierre" value={fmtPct(k.tasa_cierre)} icon="🎯" accent={P.green}
          sub={`${k.ganados} ganados · ${k.perdidos} perdidos`}/>
        <StatCard label="Pipeline activo" value={fmtUSD(k.pipeline)} icon="💼" accent={P.purple}
          sub={`${k.activos} negocios · ${fmtUSD(k.pipeline_ponderado)} ponderado`}/>
        <StatCard label="Cartera P2P / B2B" value={`${k.p2p} / ${k.b2b}`} icon="👥" accent={P.blue}
          sub={`${fmtPct(k.pct_p2p)} personas · ${fmtPct(k.pct_b2b)} empresas`}/>
        <StatCard label="Actividades" value={k.actividades} icon="📋" accent={P.orange}
          sub={`registradas en el período`}/>
        <StatCard label="Seguimientos" value={seg.vencidos || 0}
          icon={hayVencidos ? '⚠️' : '✅'} accent={hayVencidos ? P.red : P.green}
          sub={`vencidos · ${seg.hoy || 0} hoy · ${seg.semana || 0} esta semana`}/>
      </div>

      {/* Desglose por etapa */}
      <GlassCard style={{ padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12 }}>
          <p style={{ fontSize:12, fontWeight:600, color:P.textSub, margin:0 }}>Negocios por etapa</p>
          <p style={{ fontSize:11, color:P.muted, margin:0 }}>{k.total} en total</p>
        </div>

        {k.total === 0 ? (
          <p style={{ fontSize:12, color:P.muted, margin:'12px 0', textAlign:'center' }}>
            Todavía no hay negocios en tu cartera.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={datosEtapas} barSize={26} margin={{ top:4, right:0, left:0, bottom:0 }}>
                <XAxis dataKey="name" tick={{ fill:P.muted, fontSize:9 }} axisLine={false} tickLine={false}
                  interval={0} angle={-18} textAnchor="end" height={46}/>
                <YAxis hide/>
                <Tooltip {...TT} formatter={(v, _n, item) =>
                  [`${v} negocio${v === 1 ? '' : 's'} · ${fmtUSD(item?.payload?.monto)}`, 'Etapa']}/>
                <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                  {datosEtapas.map(d => <Cell key={d.id} fill={d.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Lectura numérica: el gráfico da la forma, la lista da la cifra */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',
              gap:8, marginTop:10 }}>
              {datosEtapas.filter(d => d.v > 0).map(d => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8,
                  padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)',
                  border:`1px solid ${P.border}`, borderLeft:`3px solid ${d.color}` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:11, color:P.textSub, margin:0, whiteSpace:'nowrap',
                      overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</p>
                    <p style={{ fontSize:10, color:P.muted, margin:0 }}>{fmtUSD(d.monto)}</p>
                  </div>
                  <span style={{ fontSize:15, fontWeight:800, color:d.color }}>{d.v}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </GlassCard>
    </div>
  )
}

// Reexporto lo que consume App.jsx desde la ficha y los filtros, para que el
// módulo de ventas tenga una sola puerta de entrada.
export { SALES_STAGES, STAGE_LABEL, STAGE_COLOR, esCerrada }
