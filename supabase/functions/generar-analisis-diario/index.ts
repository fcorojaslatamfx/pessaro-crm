// generar-analisis-diario v1
//
// Orquestador del Análisis Diario de Instrumentos.
//
// Reparto de trabajo deliberado: **los números los calcula este código, no el
// modelo**. Soporte, resistencia, tendencia y precio de referencia salen de
// datos de mercado reales (Twelve Data / Alpaca / CoinGecko) y se validan antes
// de publicar. Claude sólo redacta las dos narrativas a partir de esos datos.
// Un modelo sin serie de precios produciría niveles plausibles pero inventados,
// y esto se publica a clientes de una firma de asesoría financiera.
//
// Todo lo publicado lleva el disclaimer educativo, que además es obligatorio a
// nivel de esquema (NOT NULL + CHECK). Ver 20260813_analisis_instrumentos.sql.
//
// Disparo: pg_cron a las 08:00 de Chile. El secreto viaja en el BODY porque la
// función tiene verify_jwt activo (mismo patrón que whatsapp-send).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Client-Info, apikey, Content-Type",
}

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY") ?? ""
const CRON_SECRET    = Deno.env.get("ANALISIS_CRON_SECRET") ?? ""
const TD_KEY         = Deno.env.get("TWELVE_DATA_API_KEY") ?? ""
const ALPACA_KEY     = Deno.env.get("ALPACA_KEY_ID") ?? ""
const ALPACA_SEC     = Deno.env.get("ALPACA_SECRET_KEY") ?? ""

const MODELO = "claude-opus-5"
const DIAS_HISTORIA = 30
const MIN_VELAS = 10

// ── Universo: los 9 instrumentos que ya cubre market_prices_2026_06_02 ──────
type Fuente = "twelve_data" | "alpaca" | "coingecko"
interface Instrumento { clave: string; fuente: Fuente; simbolo: string; clase: string }

const INSTRUMENTOS: Instrumento[] = [
  { clave: "EUR/USD", fuente: "twelve_data", simbolo: "EUR/USD", clase: "Divisa" },
  { clave: "GBP/USD", fuente: "twelve_data", simbolo: "GBP/USD", clase: "Divisa" },
  { clave: "USD/JPY", fuente: "twelve_data", simbolo: "USD/JPY", clase: "Divisa" },
  { clave: "XAU/USD", fuente: "twelve_data", simbolo: "XAU/USD", clase: "Metal precioso" },
  { clave: "SPX500",  fuente: "alpaca",      simbolo: "SPY",     clase: "Índice bursátil" },
  { clave: "NAS100",  fuente: "alpaca",      simbolo: "QQQ",     clase: "Índice bursátil" },
  { clave: "WTI/USD", fuente: "alpaca",      simbolo: "USO",     clase: "Energía" },
  { clave: "BTC/USD", fuente: "coingecko",   simbolo: "bitcoin", clase: "Criptoactivo" },
  { clave: "ETH/USD", fuente: "coingecko",   simbolo: "ethereum",clase: "Criptoactivo" },
]

interface Vela { alto: number; bajo: number; cierre: number }
interface Serie { velas: Vela[]; fuente: Fuente; datosAt: string }

// ── Descarga de series históricas ──────────────────────────────────────────
// Se piden por fuente y no por instrumento para no agotar el rate limit de
// Twelve Data (plan gratuito: pocas peticiones por minuto).

async function serieTwelveData(simbolos: string[]): Promise<Record<string, Serie>> {
  const out: Record<string, Serie> = {}
  if (!TD_KEY || !simbolos.length) return out
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(simbolos.join(","))}` +
      `&interval=1day&outputsize=${DIAS_HISTORIA}&apikey=${TD_KEY}&dp=6`
    const res  = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    const data = await res.json()
    // Con un solo símbolo la respuesta viene plana; con varios, indexada por símbolo
    const bloques: Record<string, any> = simbolos.length === 1 ? { [simbolos[0]]: data } : data
    for (const sim of simbolos) {
      const b = bloques?.[sim]
      if (!b || b.status === "error" || !Array.isArray(b.values)) continue
      const velas: Vela[] = b.values
        .map((v: any) => ({ alto: parseFloat(v.high), bajo: parseFloat(v.low), cierre: parseFloat(v.close) }))
        .filter((v: Vela) => Number.isFinite(v.alto) && Number.isFinite(v.bajo) && Number.isFinite(v.cierre))
        .reverse() // Twelve Data devuelve lo más reciente primero
      if (velas.length) out[sim] = { velas, fuente: "twelve_data", datosAt: new Date().toISOString() }
    }
  } catch (e) {
    console.error("[twelve_data]", e instanceof Error ? e.message : String(e))
  }
  return out
}

async function serieAlpaca(simbolos: string[]): Promise<Record<string, Serie>> {
  const out: Record<string, Serie> = {}
  if (!ALPACA_KEY || !ALPACA_SEC || !simbolos.length) return out
  try {
    const desde = new Date(Date.now() - DIAS_HISTORIA * 2 * 86_400_000).toISOString().slice(0, 10)
    // OJO: el limit de Alpaca es el total de barras de la respuesta, repartido
    // entre TODOS los símbolos, no por símbolo. Con un limit ajustado, los
    // primeros símbolos se lo comen y los últimos llegan con serie corta
    // (así se quedó WTI/USD fuera en la primera prueba). Se pide holgado y se
    // recorta por símbolo más abajo.
    const url = `https://data.alpaca.markets/v2/stocks/bars?symbols=${encodeURIComponent(simbolos.join(","))}` +
      `&timeframe=1Day&start=${desde}&limit=10000&adjustment=raw`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { "APCA-API-KEY-ID": ALPACA_KEY, "APCA-API-SECRET-KEY": ALPACA_SEC },
    })
    const data = await res.json()
    for (const sim of simbolos) {
      const barras = data?.bars?.[sim]
      if (!Array.isArray(barras) || !barras.length) continue
      const velas: Vela[] = barras
        .map((b: any) => ({ alto: b.h, bajo: b.l, cierre: b.c }))
        .filter((v: Vela) => Number.isFinite(v.alto) && Number.isFinite(v.bajo) && Number.isFinite(v.cierre))
        .slice(-DIAS_HISTORIA)
      if (velas.length) out[sim] = { velas, fuente: "alpaca", datosAt: new Date().toISOString() }
    }
  } catch (e) {
    console.error("[alpaca]", e instanceof Error ? e.message : String(e))
  }
  return out
}

async function serieCoinGecko(id: string): Promise<Serie | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${DIAS_HISTORIA}`
    const res  = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const data = await res.json()
    if (!Array.isArray(data) || !data.length) return null
    // [timestamp, open, high, low, close]
    const velas: Vela[] = data
      .map((d: any[]) => ({ alto: d[2], bajo: d[3], cierre: d[4] }))
      .filter((v: Vela) => Number.isFinite(v.alto) && Number.isFinite(v.bajo) && Number.isFinite(v.cierre))
      .slice(-DIAS_HISTORIA)
    return velas.length ? { velas, fuente: "coingecko", datosAt: new Date().toISOString() } : null
  } catch (e) {
    console.error("[coingecko]", id, e instanceof Error ? e.message : String(e))
    return null
  }
}

// ── Cálculo determinista de niveles y tendencia ────────────────────────────
// Canal de Donchian sobre las últimas N velas: el mínimo y el máximo del
// período son niveles explicables y auditables, no una opinión del modelo.
interface Niveles {
  soporte: number; resistencia: number; precio: number
  tendencia: "ALCISTA" | "BAJISTA" | "NEUTRA"
  sma20: number; velas: number
}

function calcularNiveles(serie: Serie): Niveles {
  const v = serie.velas
  const ventana = v.slice(-20)
  const soporte     = Math.min(...ventana.map(x => x.bajo))
  const resistencia = Math.max(...ventana.map(x => x.alto))
  const precio      = v[v.length - 1].cierre
  const sma20       = ventana.reduce((s, x) => s + x.cierre, 0) / ventana.length

  // Tendencia: posición del precio respecto a la media y pendiente de la media.
  // Umbral del 0,3 % para no llamar tendencia al ruido.
  const mitad   = Math.max(1, Math.floor(ventana.length / 2))
  const smaPrev = ventana.slice(0, mitad).reduce((s, x) => s + x.cierre, 0) / mitad
  const pendiente = (sma20 - smaPrev) / (smaPrev || 1)
  const distancia = (precio - sma20) / (sma20 || 1)

  let tendencia: Niveles["tendencia"] = "NEUTRA"
  if (distancia > 0.003 && pendiente > 0)      tendencia = "ALCISTA"
  else if (distancia < -0.003 && pendiente < 0) tendencia = "BAJISTA"

  return { soporte, resistencia, precio, tendencia, sma20, velas: v.length }
}

// ── Validación de los niveles ───────────────────────────────────────────────
// Un instrumento que no pasa TODAS las comprobaciones no se publica. Es
// preferible que falte el análisis del día a publicar un nivel incoherente.
interface Validacion { ok: boolean; checks: Record<string, boolean>; motivo?: string }

function validarNiveles(n: Niveles): Validacion {
  const rango = (n.resistencia - n.soporte) / (n.precio || 1)
  const checks: Record<string, boolean> = {
    serie_suficiente:      n.velas >= MIN_VELAS,
    positivos:             n.soporte > 0 && n.resistencia > 0 && n.precio > 0,
    soporte_bajo_resist:   n.soporte < n.resistencia,
    precio_en_rango:       n.precio >= n.soporte * 0.97 && n.precio <= n.resistencia * 1.03,
    rango_razonable:       rango >= 0.002 && rango <= 0.6,
    finitos:               [n.soporte, n.resistencia, n.precio, n.sma20].every(Number.isFinite),
  }
  const fallos = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
  return { ok: fallos.length === 0, checks, ...(fallos.length ? { motivo: fallos.join(", ") } : {}) }
}

const redondea = (x: number) => Number(x.toPrecision(8))

// ── Redacción con Claude ────────────────────────────────────────────────────
// Structured outputs: el API garantiza el JSON contra el esquema, así que no
// hace falta pedir "devuelve sólo JSON" ni parsear a la defensiva.
// El modelo NO decide números ni tendencia: los recibe y los explica.
const ESQUEMA = {
  type: "object",
  properties: {
    analisis_staff: {
      type: "string",
      description: "Análisis técnico detallado para el asesor: lectura de los niveles, contexto de la tendencia, qué vigilar en la sesión y qué invalidaría la lectura. 700-1200 caracteres.",
    },
    analisis_cliente: {
      type: "string",
      description: "Explicación divulgativa y educativa para el cliente, en lenguaje llano, sin jerga innecesaria. Explica qué significan los niveles y la tendencia. 500-900 caracteres.",
    },
  },
  required: ["analisis_staff", "analisis_cliente"],
  additionalProperties: false,
}

const SISTEMA = `Eres analista de mercados de Pessaro Capital SpA y escribes el análisis diario de instrumentos.

Recibes datos de mercado REALES ya calculados: precio de referencia, soporte, resistencia y tendencia. Tu trabajo es EXPLICARLOS, nunca inventarlos ni contradecirlos.

Reglas que no puedes romper:
- No inventes ni alteres cifras. Usa exactamente los números que recibes.
- No des recomendaciones de compra o venta, ni precios objetivo, ni consejos de inversión personalizados. El contenido es EDUCATIVO.
- No prometas rentabilidades ni des garantías de resultado.
- No menciones que eres una IA ni describas tu proceso.
- Escribe en español de Chile, profesional y claro. Sin emojis. Sin markdown ni encabezados: texto corrido en párrafos.

Escribes dos textos:
- analisis_staff: para el asesor. Técnico y accionable en términos de lectura de mercado (qué vigilar, qué invalidaría el escenario), sin recomendar operaciones.
- analisis_cliente: para el cliente en el portal. Divulgativo y educativo: explica qué es un soporte, qué es una resistencia y qué implica la tendencia en este caso concreto, de forma que alguien sin formación financiera lo entienda.`

async function redactar(inst: Instrumento, n: Niveles): Promise<{ staff: string; cliente: string } | null> {
  const prompt = `Instrumento: ${inst.clave} (${inst.clase})
Precio de referencia: ${n.precio}
Soporte calculado (mínimo de 20 sesiones): ${redondea(n.soporte)}
Resistencia calculada (máximo de 20 sesiones): ${redondea(n.resistencia)}
Media de 20 sesiones: ${redondea(n.sma20)}
Tendencia determinada por el sistema: ${n.tendencia}
Sesiones analizadas: ${n.velas}

Redacta los dos textos explicando esta situación.`

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
        system: SISTEMA,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(180_000),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error(`[claude] ${inst.clave} HTTP ${res.status}:`, JSON.stringify(data).slice(0, 400))
      return null
    }
    if (data.stop_reason === "refusal") {
      console.error(`[claude] ${inst.clave} rechazado:`, JSON.stringify(data.stop_details ?? {}))
      return null
    }
    const texto = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
    if (!texto) return null
    const json = JSON.parse(texto)
    const staff   = String(json.analisis_staff   ?? "").trim()
    const cliente = String(json.analisis_cliente ?? "").trim()
    if (!staff || !cliente) return null
    return { staff, cliente }
  } catch (e) {
    console.error(`[claude] ${inst.clave}:`, e instanceof Error ? e.message : String(e))
    return null
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

  try {
    const payload = await req.json().catch(() => ({}))

    // El secreto va en el body: la función tiene verify_jwt activo, así que el
    // Authorization debe ser un JWT válido (el cron manda la anon key).
    if (!CRON_SECRET || payload.cron_secret !== CRON_SECRET) {
      return json({ error: "No autorizado" }, 403)
    }
    if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_API_KEY no configurada" }, 500)

    // dry_run: recorre datos, cálculo y validación pero no llama al modelo ni escribe
    const dryRun = payload.dry_run === true
    // Sin forzar, un instrumento que ya tiene análisis de hoy no se vuelve a
    // redactar. Protege de un doble disparo del cron o de una ejecución manual
    // repetida: el upsert deja los datos bien, pero la llamada al modelo se
    // paga igual.
    const forzar = payload.forzar === true
    const soloInstrumento: string | null = payload.instrumento ?? null
    const lista = soloInstrumento
      ? INSTRUMENTOS.filter(i => i.clave === soloInstrumento)
      : INSTRUMENTOS
    if (!lista.length) return json({ error: `Instrumento desconocido: ${soloInstrumento}` }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1) Series históricas, agrupadas por fuente
    const [td, alp] = await Promise.all([
      serieTwelveData(lista.filter(i => i.fuente === "twelve_data").map(i => i.simbolo)),
      serieAlpaca(lista.filter(i => i.fuente === "alpaca").map(i => i.simbolo)),
    ])
    const cg: Record<string, Serie> = {}
    for (const i of lista.filter(x => x.fuente === "coingecko")) {
      const s = await serieCoinGecko(i.simbolo)
      if (s) cg[i.simbolo] = s
    }

    const hoy = new Date().toISOString().slice(0, 10)
    let yaPublicados = new Set<string>()
    if (!dryRun && !forzar) {
      const { data: previos } = await supabase
        .from("analisis_instrumentos").select("instrumento").eq("fecha", hoy)
      yaPublicados = new Set((previos ?? []).map((r: any) => r.instrumento))
    }

    const resultados: any[] = []

    // 2) Preparar: niveles + validación (barato, sin red)
    interface Pendiente { inst: Instrumento; niveles: Niveles; validacion: Validacion; serie: Serie }
    const pendientes: Pendiente[] = []

    for (const inst of lista) {
      const serie = inst.fuente === "twelve_data" ? td[inst.simbolo]
                  : inst.fuente === "alpaca"      ? alp[inst.simbolo]
                  : cg[inst.simbolo]

      if (!serie) { resultados.push({ instrumento: inst.clave, estado: "sin_datos" }); continue }

      if (yaPublicados.has(inst.clave)) {
        resultados.push({ instrumento: inst.clave, estado: "ya_publicado_hoy" })
        continue
      }

      const niveles    = calcularNiveles(serie)
      const validacion = validarNiveles(niveles)

      // Un nivel que no valida NO se publica. Falta el análisis del día antes
      // que publicar una cifra incoherente a clientes.
      if (!validacion.ok) {
        resultados.push({ instrumento: inst.clave, estado: "niveles_invalidos", motivo: validacion.motivo })
        continue
      }

      if (dryRun) {
        resultados.push({
          instrumento: inst.clave, estado: "dry_run",
          tendencia: niveles.tendencia,
          soporte: redondea(niveles.soporte),
          resistencia: redondea(niveles.resistencia),
          precio: redondea(niveles.precio),
          velas: niveles.velas, fuente: serie.fuente,
        })
        continue
      }

      pendientes.push({ inst, niveles, validacion, serie })
    }

    // 3) Redacción + escritura EN PARALELO.
    //    En serie, 9 llamadas al modelo superan el límite de 150 s de la edge
    //    function y la ejecución se corta a medias. Con tandas cortas entra de
    //    sobra. La concurrencia se mantiene baja para no disparar rate limits.
    const CONCURRENCIA = 3

    async function procesar(p: Pendiente) {
      const { inst, niveles, validacion, serie } = p
      const textos = await redactar(inst, niveles)
      if (!textos) return { instrumento: inst.clave, estado: "sin_redaccion" }

      const { data: fila, error: errPub } = await supabase
        .from("analisis_instrumentos")
        .upsert({
          instrumento:       inst.clave,
          fecha:             hoy,
          tendencia:         niveles.tendencia,
          soporte:           redondea(niveles.soporte),
          resistencia:       redondea(niveles.resistencia),
          analisis_cliente:  textos.cliente,
          precio_referencia: redondea(niveles.precio),
          fuente_datos:      serie.fuente,
          datos_at:          serie.datosAt,
          validacion:        { ...validacion, sma20: redondea(niveles.sma20), velas: niveles.velas },
          // disclaimer: lo pone el DEFAULT de la tabla, obligatorio por esquema
        }, { onConflict: "instrumento,fecha" })
        .select("id")
        .single()

      if (errPub || !fila) {
        console.error(`[db] ${inst.clave}:`, errPub?.message)
        return { instrumento: inst.clave, estado: "error_bd", error: errPub?.message }
      }

      const { error: errStaff } = await supabase
        .from("analisis_instrumentos_staff")
        .upsert({ analisis_id: fila.id, analisis_staff: textos.staff }, { onConflict: "analisis_id" })
      if (errStaff) console.error(`[db-staff] ${inst.clave}:`, errStaff.message)

      return {
        instrumento: inst.clave, estado: "publicado",
        tendencia: niveles.tendencia,
        soporte: redondea(niveles.soporte),
        resistencia: redondea(niveles.resistencia),
      }
    }

    for (let i = 0; i < pendientes.length; i += CONCURRENCIA) {
      const tanda = await Promise.all(pendientes.slice(i, i + CONCURRENCIA).map(procesar))
      resultados.push(...tanda)
    }

    const publicados = resultados.filter(r => r.estado === "publicado").length
    return json({ success: true, dry_run: dryRun, total: lista.length, publicados, resultados })
  } catch (err) {
    console.error("[generar-analisis-diario] uncaught:", err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
