// generar-articulos-referencias v1
//
// Orquestador de los Artículos Exclusivos del portal de clientes.
//
// Reparto de trabajo deliberado, el mismo del análisis diario de instrumentos:
// **las fuentes las trae este código, no el modelo**. La función lee feeds RSS
// reales, extrae titular, medio, URL y fecha de cada noticia, y guarda esos
// registros LITERALMENTE como vienen del feed. Al modelo se le pasan como
// material de trabajo y sólo redacta el comentario propio de Pessaro.
//
// El motivo es el mismo que allá: un modelo al que se le pide "cita a Bloomberg"
// produce URLs plausibles pero inventadas. Una referencia falsa publicada a
// clientes de una firma de asesoría financiera es peor que no tener el artículo.
//
// Derechos: se cita y se enlaza (titular, medio, fecha, enlace). NO se reproduce
// el texto de la nota original — el cuerpo del artículo es obra propia.
//
// Firma: institucional, "Pessaro Capital". El texto lo redacta un modelo y la
// responsabilidad editorial la asume la empresa; atribuirlo a un analista con
// nombre y apellido sería inventar una persona.
//
// Disparo: pg_cron. El secreto viaja en el BODY porque la función tiene
// verify_jwt activo (mismo patrón que whatsapp-send y generar-analisis-diario).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Client-Info, apikey, Content-Type",
}

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? ""
const CRON_SECRET   = Deno.env.get("ARTICULOS_CRON_SECRET") ?? ""

const MODELO = "claude-opus-5"
const TABLA  = "client_exclusive_articles_2026_03_11"

const MAX_ANTIGUEDAD_DIAS = 4   // una noticia de la semana pasada ya no es comentario de actualidad
const MIN_FUENTES         = 2   // un artículo con una sola referencia es una nota de prensa recomendada
const MAX_FUENTES         = 8
const MIN_CUERPO          = 1200
const MAX_CUERPO          = 9000

// ── Fuentes ─────────────────────────────────────────────────────────────────
// Verificadas una a una el 2026-08-13: responden 200 y traen items parseables.
// Las oficiales (Fed, SEC) son dominio público. Las de medios se usan sólo para
// citar y enlazar el titular, nunca para reproducir el cuerpo de la nota.
//
// Descartadas en la comprobación: IMF y BLS devuelven 403 a la edge function,
// el Banco Central de Chile no publica RSS y el feed del BCE trae un solo item.
type Tipo = "oficial" | "medio"
interface Fuente { medio: string; url: string; tipo: Tipo }

const FUENTES: Fuente[] = [
  { medio: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml",                  tipo: "oficial" },
  { medio: "SEC",             url: "https://www.sec.gov/news/pressreleases.rss",                          tipo: "oficial" },
  { medio: "MarketWatch",     url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",         tipo: "medio"   },
  { medio: "CNBC",            url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",               tipo: "medio"   },
  { medio: "Investing.com",   url: "https://www.investing.com/rss/news_25.rss",                           tipo: "medio"   },
]

interface Noticia { titulo: string; medio: string; url: string; fecha: string; tipo: Tipo }

// ── Lectura de feeds ────────────────────────────────────────────────────────
// Parser por expresiones regulares en vez de un XML completo: los feeds son
// RSS 2.0 planos y sólo hacen falta title/link/pubDate. Evita arrastrar una
// dependencia de parseo XML a la edge function.

const desCData = (s: string) =>
  s.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim()

const desEntidades = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
   .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")

function campo(bloque: string, etiqueta: string): string {
  const m = bloque.match(new RegExp(`<${etiqueta}[^>]*>([\\s\\S]*?)</${etiqueta}>`, "i"))
  return m ? desEntidades(desCData(m[1])).replace(/<[^>]+>/g, "").trim() : ""
}

async function leerFeed(f: Fuente): Promise<Noticia[]> {
  try {
    const res = await fetch(f.url, {
      signal: AbortSignal.timeout(20_000),
      // Varios feeds devuelven 403 a un cliente sin user agent reconocible.
      headers: { "User-Agent": "PessaroCapital-ArticulosBot/1.0 (+https://pessaro.cl)" },
    })
    if (!res.ok) { console.error(`[feed] ${f.medio} HTTP ${res.status}`); return [] }
    const xml = await res.text()

    const bloques = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
    const corte = Date.now() - MAX_ANTIGUEDAD_DIAS * 86_400_000
    const out: Noticia[] = []

    for (const b of bloques) {
      const titulo = campo(b, "title")
      const url    = campo(b, "link") || campo(b, "guid")
      const pub    = campo(b, "pubDate") || campo(b, "dc:date")
      if (!titulo || !url || !/^https?:\/\//i.test(url)) continue

      const t = pub ? Date.parse(pub) : NaN
      // Sin fecha legible no se puede afirmar que sea actualidad: se descarta.
      if (!Number.isFinite(t) || t < corte) continue

      out.push({ titulo, medio: f.medio, url, fecha: new Date(t).toISOString(), tipo: f.tipo })
    }
    return out
  } catch (e) {
    console.error(`[feed] ${f.medio}:`, e instanceof Error ? e.message : String(e))
    return []
  }
}

// ── Redacción ───────────────────────────────────────────────────────────────
const CATEGORIAS = ["macroeconomia", "divisas", "commodities", "criptomonedas", "analisis", "estrategia", "educacion"]

const ESQUEMA = {
  type: "object",
  properties: {
    title:    { type: "string", description: "Titular del artículo, en español, 40-90 caracteres. Sin comillas ni markdown." },
    summary:  { type: "string", description: "Bajada de 180-320 caracteres que resume el artículo. Se muestra en el listado." },
    content:  { type: "string", description: `Cuerpo del artículo en español de Chile, ${MIN_CUERPO}-${MAX_CUERPO} caracteres, en párrafos separados por una línea en blanco. Sin markdown, sin encabezados, sin viñetas.` },
    category: { type: "string", enum: CATEGORIAS, description: "Categoría del artículo." },
    tags:     { type: "array", items: { type: "string" }, description: "Entre 3 y 5 etiquetas cortas en minúsculas." },
    read_time_minutes: { type: "integer", description: "Minutos de lectura estimados, entre 3 y 12." },
  },
  required: ["title", "summary", "content", "category", "tags", "read_time_minutes"],
  additionalProperties: false,
}

const SISTEMA = `Eres redactor del equipo de análisis de Pessaro Capital SpA y escribes los artículos exclusivos del portal de clientes.

Recibes una lista de noticias REALES publicadas en los últimos días, con su titular, medio, fecha y enlace. Tu trabajo es escribir un comentario propio de Pessaro que ayude al cliente a entender qué está pasando y por qué importa.

Reglas que no puedes romper:
- NO reproduzcas el texto de las notas originales. Escribe comentario propio. Puedes mencionar el hecho y el medio que lo publicó.
- NO inventes noticias, cifras, citas, fechas ni enlaces. Si algo no está en el material que recibes, no lo afirmes.
- NO des recomendaciones de compra o venta, ni precios objetivo, ni consejos de inversión personalizados. El contenido es EDUCATIVO.
- NO prometas rentabilidades ni des garantías de resultado.
- NO menciones que eres una IA ni describas tu proceso.
- NO firmes el texto ni incluyas nombres de analistas.
- Cuando te apoyes en una noticia, menciónala por su medio en el cuerpo ("según lo informado por CNBC", "la Reserva Federal comunicó que…"). Los enlaces los añade el sistema aparte: no escribas URLs.
- Escribe en español de Chile, profesional y claro, para alguien sin formación financiera. Sin emojis. Sin markdown.

Estructura el cuerpo en párrafos: qué pasó, por qué importa, y qué conviene entender del contexto. Cierra con una nota de prudencia sobre la incertidumbre del mercado, sin dar instrucciones.`

// Lenguaje que no puede salir publicado. La comprobación es tosca a propósito:
// ante la duda no se publica, igual que un nivel que no valida en el análisis
// diario. Es preferible que falte el artículo a publicar una recomendación.
const PROHIBIDO = [
  /\bcompr[ae]\s+(ahora|ya|aprovech)/i,
  /\bvend[ae]\s+(ahora|ya|todo)/i,
  /\bprecio\s+objetivo\b/i,
  /\brecomendamos\s+(comprar|vender|invertir)/i,
  /\bgarantiza(mos|do|da)?\s+(rentabilidad|retorno|ganancia)/i,
  /\brentabilidad\s+asegurada\b/i,
  /\bstop\s*loss\b/i,
  /\btake\s*profit\b/i,
]

interface Borrador {
  title: string; summary: string; content: string
  category: string; tags: string[]; read_time_minutes: number
}

async function redactar(noticias: Noticia[]): Promise<Borrador | null> {
  const material = noticias
    .map((n, i) => `${i + 1}. [${n.medio}] ${n.titulo} (${n.fecha.slice(0, 10)})`)
    .join("\n")

  const prompt = `Noticias reales de los últimos días:

${material}

Escribe un artículo para el portal de clientes que las conecte y explique qué está pasando en los mercados. No hace falta que uses todas: elige las que formen una historia coherente.`

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
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
        system: SISTEMA,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(180_000),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error(`[claude] HTTP ${res.status}:`, JSON.stringify(data).slice(0, 400))
      return null
    }
    if (data.stop_reason === "refusal") {
      console.error("[claude] rechazado:", JSON.stringify(data.stop_details ?? {}))
      return null
    }
    const texto = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
    if (!texto) return null
    return JSON.parse(texto) as Borrador
  } catch (e) {
    console.error("[claude]:", e instanceof Error ? e.message : String(e))
    return null
  }
}

// ── Validación previa a publicar ────────────────────────────────────────────
interface Validacion { ok: boolean; checks: Record<string, boolean>; motivo?: string }

function validar(b: Borrador, noticias: Noticia[]): Validacion {
  const cuerpo = (b.content ?? "").trim()
  const checks: Record<string, boolean> = {
    titulo_presente:    !!b.title?.trim() && b.title.trim().length <= 140,
    bajada_presente:    !!b.summary?.trim() && b.summary.trim().length >= 80,
    cuerpo_suficiente:  cuerpo.length >= MIN_CUERPO && cuerpo.length <= MAX_CUERPO,
    categoria_valida:   CATEGORIAS.includes(b.category),
    etiquetas:          Array.isArray(b.tags) && b.tags.length >= 2,
    lectura_razonable:  Number.isInteger(b.read_time_minutes) && b.read_time_minutes >= 2 && b.read_time_minutes <= 20,
    fuentes_suficientes: noticias.length >= MIN_FUENTES,
    // El modelo tiene prohibido escribir URLs: las referencias las pone el
    // sistema. Una URL en el cuerpo es señal de que se las inventó.
    sin_urls_inventadas: !/https?:\/\//i.test(cuerpo),
    sin_recomendaciones: !PROHIBIDO.some(rx => rx.test(cuerpo) || rx.test(b.summary ?? "") || rx.test(b.title ?? "")),
  }
  const fallos = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
  return { ok: fallos.length === 0, checks, ...(fallos.length ? { motivo: fallos.join(", ") } : {}) }
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
   .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)

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

    if (!CRON_SECRET || payload.cron_secret !== CRON_SECRET) {
      return json({ error: "No autorizado" }, 403)
    }
    if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_API_KEY no configurada" }, 500)

    // dry_run: lee feeds y valida el material, sin llamar al modelo ni escribir.
    const dryRun = payload.dry_run === true
    const forzar = payload.forzar === true
    // Por defecto el artículo entra publicado, igual que el análisis diario.
    // borrador:true lo deja en is_published=false para revisión humana.
    const borrador = payload.borrador === true

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const hoy = new Date().toISOString().slice(0, 10)

    // Guarda contra doble gasto: si ya hay artículo generado hoy no se vuelve a
    // redactar. Un doble disparo del cron cuesta las lecturas de feed y cero
    // llamadas al modelo.
    if (!dryRun && !forzar) {
      const { data: previos } = await supabase
        .from(TABLA).select("id").not("generated_by", "is", null).gte("generated_at", `${hoy}T00:00:00Z`).limit(1)
      if (previos?.length) return json({ success: true, estado: "ya_publicado_hoy" })
    }

    // 1) Material: noticias reales de los últimos días
    const porFuente = await Promise.all(FUENTES.map(leerFeed))
    const todas = porFuente.flat()

    // Se mezclan medios para que el artículo no dependa de un solo sitio, y se
    // prioriza lo más reciente. Las oficiales van primero: son dominio público
    // y dan el ancla factual (tipos, comunicados, resoluciones).
    const ordenadas = todas.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === "oficial" ? -1 : 1
      return b.fecha.localeCompare(a.fecha)
    })
    const mediosDistintos = new Set(ordenadas.map(n => n.medio)).size
    const noticias = ordenadas.slice(0, MAX_FUENTES)

    if (noticias.length < MIN_FUENTES) {
      return json({ success: false, estado: "material_insuficiente", encontradas: todas.length, medios: mediosDistintos })
    }

    if (dryRun) {
      return json({
        success: true, dry_run: true,
        encontradas: todas.length, medios: mediosDistintos,
        material: noticias.map(n => ({ medio: n.medio, titulo: n.titulo, fecha: n.fecha, url: n.url })),
      })
    }

    // 2) Redacción
    const b = await redactar(noticias)
    if (!b) return json({ success: false, estado: "sin_redaccion" })

    // 3) Validación. Lo que no valida no se publica.
    const validacion = validar(b, noticias)
    if (!validacion.ok) {
      console.error("[validacion] descartado:", validacion.motivo)
      return json({ success: false, estado: "no_valida", motivo: validacion.motivo, checks: validacion.checks })
    }

    // 4) Publicación. `sources` va con los registros del feed tal cual se
    //    leyeron — no con lo que haya escrito el modelo.
    const sources = noticias.map(n => ({ titulo: n.titulo, medio: n.medio, url: n.url, fecha: n.fecha }))

    const { data: fila, error } = await supabase
      .from(TABLA)
      .insert({
        title:             b.title.trim(),
        slug:              `${slugify(b.title)}-${hoy}`,
        summary:           b.summary.trim(),
        content:           b.content.trim(),
        category:          b.category,
        tags:              b.tags.slice(0, 5),
        read_time_minutes: b.read_time_minutes,
        // Firma institucional: la responsabilidad editorial es de la empresa.
        author_name:       "Pessaro Capital",
        author_role:       "Equipo de Análisis",
        is_published:      !borrador,
        published_at:      new Date().toISOString(),
        sources,
        generated_at:      new Date().toISOString(),
        generated_by:      "generar-articulos-referencias",
        validacion,
        // disclaimer: lo pone el DEFAULT de la tabla, obligatorio por esquema
      })
      .select("id,title,slug,category")
      .single()

    if (error || !fila) {
      console.error("[db]:", error?.message)
      return json({ success: false, estado: "error_bd", error: error?.message }, 500)
    }

    return json({
      success: true, estado: borrador ? "borrador" : "publicado",
      articulo: fila, fuentes: sources.length, medios: mediosDistintos,
    })
  } catch (err) {
    console.error("[generar-articulos-referencias] uncaught:", err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
