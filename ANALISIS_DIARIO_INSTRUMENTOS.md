# Análisis Diario de Instrumentos

> **Proyecto Supabase:** `ldlflxujrjihiybrcree` (compartido entre `pessaro-crm` y `pessaro_CL`)
> **Alta:** 2026-08-13 · **Última actualización:** 2026-08-14 (§8, reglas de fecha)

Análisis diario automático de 9 instrumentos (divisas, metales, energía, índices y cripto), publicado en el **portal de clientes** (pessaro.cl) y en el **panel del asesor** (crm.pessaro.cl). No se envía por WhatsApp ni por ningún otro canal push.

---

## 1. Principio de diseño: los números no los inventa el modelo

Es la decisión que sostiene todo lo demás. **Soporte, resistencia, tendencia y precio de referencia los calcula el código** a partir de series de precios reales; el modelo (`claude-opus-5`) sólo **redacta** las dos narrativas a partir de esas cifras.

Un modelo sin serie de precios habría producido niveles plausibles pero fabricados, y esto se publica a clientes de una firma de asesoría financiera.

| Dato | Origen | Método |
|---|---|---|
| `soporte` | Serie real | Mínimo de las últimas 20 sesiones (canal de Donchian) |
| `resistencia` | Serie real | Máximo de las últimas 20 sesiones |
| `tendencia` | Serie real | Posición del precio frente a la media de 20 + pendiente de la media, con umbral del 0,3 % para no llamar tendencia al ruido |
| `precio_referencia` | Serie real | Último cierre |
| `analisis_staff` / `analisis_cliente` | Claude Opus 5 | Redacción sobre los datos anteriores |

**Validación antes de publicar.** Un instrumento que no pasa **todas** las comprobaciones no se publica; es preferible que falte el análisis del día a publicar una cifra incoherente:

`serie_suficiente` (≥10 sesiones) · `positivos` · `soporte_bajo_resist` · `precio_en_rango` (dentro de ±3 % del canal) · `rango_razonable` (amplitud entre 0,2 % y 60 % del precio) · `finitos`

El resultado queda guardado en la columna `validacion` de cada fila, junto con `fuente_datos` y `datos_at`: cualquier análisis publicado es auditable — *¿sobre qué precio y qué serie se dijo esto?*

---

## 2. Aviso de carácter educativo — obligatorio

**Requisito legal del sitio.** Cada fila lleva su propio `disclaimer`, y el esquema impide que falte:

```sql
disclaimer text not null default '…',
constraint analisis_disclaimer_presente check (length(btrim(disclaimer)) >= 80)
```

No es posible insertar un análisis sin aviso: es `NOT NULL`, tiene DEFAULT y un CHECK de longitud mínima. **El portal de clientes debe renderizarlo siempre**, junto al análisis, no en un pie de página lejano ni tras un desplegable.

El prompt del sistema además prohíbe explícitamente al modelo dar recomendaciones de compra o venta, precios objetivo, consejos personalizados o promesas de rentabilidad.

Texto vigente:

> Este análisis tiene carácter exclusivamente educativo e informativo. No constituye asesoría de inversión, recomendación de compra o venta, ni oferta de instrumentos financieros. Los niveles señalados se calculan a partir de datos de mercado históricos y pueden variar sin previo aviso. Invertir en mercados financieros conlleva riesgo de pérdida de capital. Pessaro Capital SpA no garantiza resultados.

---

## 3. Modelo de datos — dos tablas, no una

**RLS es row-level, no column-level.** Una sola tabla con `SELECT` para `authenticated` habría dado a los clientes del portal —que autentican contra este mismo proyecto— acceso a la columna del análisis técnico interno. Por eso la parte de staff vive en su propia tabla.

### `analisis_instrumentos` — visible para clientes y staff

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `instrumento` | text | `EUR/USD`, `XAU/USD`, `BTC/USD`… |
| `fecha` | date | Único junto con `instrumento` |
| `tendencia` | text | `ALCISTA` \| `BAJISTA` \| `NEUTRA` |
| `soporte`, `resistencia` | numeric(18,6) | CHECK: `soporte < resistencia` |
| `analisis_cliente` | text | Divulgativo y educativo |
| `precio_referencia` | numeric(18,6) | Último cierre usado |
| `fuente_datos` | text | `twelve_data` \| `alpaca` \| `coingecko` |
| `datos_at` | timestamptz | Cuándo se leyeron los datos |
| `validacion` | jsonb | Comprobaciones superadas |
| `disclaimer` | text | Obligatorio (ver §2) |

RLS: `SELECT` para `authenticated`. Escritura sólo `service_role`.

### `analisis_instrumentos_staff` — sólo staff del CRM

| Columna | Tipo |
|---|---|
| `id` | uuid |
| `analisis_id` | uuid, FK única a `analisis_instrumentos` |
| `analisis_staff` | text |

RLS: `SELECT` sólo si `is_crm_staff()`. Escritura sólo `service_role`.

**Verificado en producción:** un usuario con rol `client` ve 1 fila pública y **0** filas internas; un asesor ve 1 y 1.

---

## 4. Integración en `pessaro_CL` (portal de clientes)

La tabla ya está en la publicación `supabase_realtime`, así que funcionan las dos vías.

### Lectura simple

```js
// El día, en horario local. NO uses toISOString(): es UTC, y desde las ~20:00
// de Chile pediría el día siguiente y devolvería 0 filas (ver §8).
const d = new Date()
const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const { data, error } = await supabase
  .from('analisis_instrumentos')
  .select('instrumento, fecha, tendencia, soporte, resistencia, analisis_cliente, precio_referencia, disclaimer')
  .eq('fecha', hoy)
  .order('instrumento')
```

### Con Realtime (se actualiza solo al publicarse el análisis de la mañana)

```js
useEffect(() => {
  cargar()
  const canal = supabase
    .channel('analisis-cliente')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'analisis_instrumentos' },
        () => cargar())
    .subscribe()
  return () => { supabase.removeChannel(canal) }
}, [])
```

### Reglas para el portal

1. **Renderiza siempre `disclaimer`** junto al análisis. Es el requisito legal.
2. **No consultes `analisis_instrumentos_staff`.** RLS devolverá 0 filas para un cliente; la tabla no es para el portal.
3. **No pidas `analisis_staff`** en el `select`: esa columna no existe en la tabla pública.
4. Muestra `precio_referencia` y `datos_at` si el diseño lo permite — dan contexto y hacen honesto el análisis.
5. **Abre en el último día publicado, no en «hoy» a secas.** Si el cron se retrasa, ver el día anterior con su fecha es mejor que un panel vacío. Trae primero los días disponibles (`select fecha … order by fecha desc`) y usa el primero como valor inicial.
6. **Trata `fecha` como día de calendario en horario local** — es de tipo `date`, no un instante. Ver §8.

---

## 5. Orquestador

**Edge function:** `generar-analisis-diario` (Deno). `verify_jwt` activo.

**Disparo:** pg_cron `analisis-diario-instrumentos`, `0 12 * * *` UTC.

> ⚠️ **Zona horaria.** pg_cron evalúa en UTC y no admite zona por job. 12:00 UTC = **08:00 en Chile en horario estándar**; durante el horario de verano chileno (UTC-3, aprox. septiembre–abril) caerá a las **09:00 locales**. Cambiar `cron.timezone` globalmente desplazaría también los otros jobs diarios, así que la corrección es ajustar la expresión dos veces al año, o asumir la hora de verano.

**Autorización:** `ANALISIS_CRON_SECRET` en el **body** (la función tiene `verify_jwt` activo, así que el `Authorization` lleva la anon key). Mismo patrón que `whatsapp-send`.

**Parámetros del body:**

| Campo | Efecto |
|---|---|
| `cron_secret` | Obligatorio |
| `dry_run: true` | Descarga datos, calcula y valida, **sin llamar al modelo ni escribir**. Útil para verificar niveles sin gastar. |
| `instrumento: "XAU/USD"` | Procesa uno solo |
| `forzar: true` | Rehace un instrumento ya publicado hoy |

**Guarda contra doble gasto:** sin `forzar`, un instrumento que ya tiene análisis de hoy no se vuelve a redactar. Un doble disparo del cron cuesta 4 segundos y cero llamadas al modelo.

**Concurrencia:** las llamadas al modelo van en tandas de 3. En serie, 9 instrumentos superaban el límite de 150 s de la edge function y la ejecución se cortaba a medias; en paralelo el ciclo completo tarda ~55 s.

### Diagnóstico

```sql
-- ¿Corrió el cron?
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname='analisis-diario-instrumentos')
order by start_time desc limit 5;

-- ¿Qué respondió?
select status_code, content::text from net._http_response order by id desc limit 3;

-- ¿Qué hay publicado hoy?
select instrumento, tendencia, soporte, resistencia, precio_referencia, fuente_datos
from analisis_instrumentos where fecha = current_date order by instrumento;

-- ¿Salieron los nueve? (comparado con los días anteriores)
select fecha, count(*), string_agg(instrumento, ', ' order by instrumento)
from analisis_instrumentos group by fecha order by fecha desc limit 5;
```

> ⚠️ **Una publicación incompleta no es un fallo del cron.** El job puede terminar `succeeded` —sólo dispara la petición HTTP— y aun así faltar instrumentos, porque lo que no valida no se publica y una fuente caída deja fuera a los suyos. El **2026-08-14** salieron **5 de 9**: faltaron EUR/USD, GBP/USD, USD/JPY y XAU/USD, que son **exactamente los cuatro de Twelve Data**. Si faltan los de un mismo proveedor, mira la cuota de ese proveedor antes que el planificador.

---

## 6. Instrumentos cubiertos

| Instrumento | Clase | Fuente |
|---|---|---|
| EUR/USD, GBP/USD, USD/JPY | Divisas | Twelve Data |
| XAU/USD | Metal precioso | Twelve Data |
| SPX500, NAS100 | Índices | Alpaca (SPY, QQQ) |
| WTI/USD | Energía | Alpaca (USO) |
| BTC/USD, ETH/USD | Criptoactivos | CoinGecko |

Los índices y el WTI se aproximan mediante ETF (SPY, QQQ, USO), que es lo que ya usaba `market_prices_2026_06_02`. **Los niveles corresponden al ETF, no al subyacente**; conviene tenerlo presente al leerlos y, si se quiere precisión, cambiar la fuente a un proveedor de futuros.

## 7. Fuera de alcance

Backtesting de los niveles, gráficos y análisis intradía.

El **histórico navegable sí existe** desde el 2026-08-13: la tabla guardaba todos los días desde el alta, y tanto el panel del CRM como el portal tienen ya su selector de día.

---

## 8. Fechas: día de calendario, en horario local

`analisis_instrumentos.fecha` es de tipo **`date`**: el día en que se publicó el análisis, no un instante. Esa distinción ha costado dos fallos en dos días, uno a cada lado del recorrido, y ambos con el mismo origen — tratar un día de calendario como si fuera un momento en el tiempo.

| Fallo | Dónde | Qué pasaba |
|---|---|---|
| **2026-08-13** — el panel se vaciaba cada noche | Al **consultar** | El día se calculaba con `new Date().toISOString()`, que es UTC. Desde las ~20:00 de Chile el día UTC ya había cambiado y la consulta pedía el día siguiente: 0 filas y un «revisa el planificador» que no venía a cuento. Se arreglaba solo por la mañana. |
| **2026-08-14** — el CRM fechaba un día antes que el portal | Al **mostrar** | `new Date('2026-08-14')` parsea medianoche **UTC**; pintado en hora de Chile (UTC−4) retrocede a las 20:00 del día anterior. El desplegable decía `13-08-2026 · hoy` con las mismas filas que el portal fechaba como 14 de agosto. |

Las dos reglas, que valen igual para `crm.pessaro.cl` y para el portal de `pessaro_CL`:

```js
// Calcular el día: en local, nunca toISOString()
const d = new Date()
const hoy = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

// Mostrar el día: forzar la hora, para que no lo parsee como UTC
const fmt = f => new Date(`${f}T00:00:00`).toLocaleDateString('es-CL')
```

Las marcas `timestamptz` —`datos_at`, `created_at`— son lo contrario: sí son instantes y **deben** convertirse a la zona del usuario, así que van con `new Date(v)` tal cual.

Comprobación rápida en cualquiera de los dos repos, con `TZ=America/Santiago`: `'2026-08-14'` tiene que dar **14-08-2026**, y `'2026-08-14T13:04:00Z'`, también.
