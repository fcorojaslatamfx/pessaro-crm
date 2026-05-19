# Pessaro Capital CRM — Changelog

## [2026-05-19] — Unificación campaign_leads + Tab Landings

### Contexto

El CRM manejaba dos tablas paralelas para la campaña Q2:

- `campaign_participants` — participantes registrados manualmente desde el CRM
- `campaign_leads` — leads que llegaban por las landing pages (gestionados por el CMS)

Esto generaba fragmentación: el equipo tenía que revisar dos lugares para ver el universo completo de leads y los datos no estaban sincronizados entre el CRM y el CMS.

---

### Cambios en `src/App.jsx`

#### 1. `CampanaModule` — Fuente única: `campaign_leads`

`campaign_participants` fue retirado como fuente de datos del módulo Campaña. El componente ahora lee directamente `globalLeads`, que es el array de `campaign_leads` cargado en el fetch principal de la aplicación.

**Antes:**
```js
supabase.from('campaign_participants').select('*').eq('campaign_id', campaign.id)
```

**Después:**
```js
// Lee globalLeads (campaign_leads) — sin fetch adicional
const leads = globalLeads || []
```

Beneficios:
- Sin fetch duplicado al montar el módulo
- Los leads que entran por `/campana/navy`, `/campana/editorial` y `/campana/bold` aparecen automáticamente en el CRM sin paso manual
- Una sola fuente de verdad compartida con el CMS

#### 2. `addLead()` — Inserción directa en `campaign_leads`

El botón **+ Añadir lead** ahora inserta directamente en `campaign_leads` con los campos:

| Campo | Valor |
|---|---|
| `source` | `'crm_manual'` |
| `referral_code` | Generado automáticamente (6 chars) |
| `advisor_assigned` | Email del usuario CRM autenticado |
| `variant` | Seleccionable: navy / editorial / bold |
| `perfil` | Seleccionable: retail / mam / asesor |
| `position_in_queue` | `leads.length + 1` |

El modal de añadir lead incluye dos campos nuevos: **Perfil** y **Landing (variant)**.

#### 3. `updateLead()` — Actualización en `campaign_leads`

Los toggles de Contactado / Cuenta / KYC / Depósito en "Mis Leads" ahora actualizan `campaign_leads` directamente:

```js
supabase.from('campaign_leads').update(updates).eq('id', id)
```

#### 4. Tab **🚀 Landings** — nuevo

Se agregó un tercer tab en `CampanaModule` con:

**Cards por variante** (Navy / Editorial / Bold):
- Total de leads registrados desde esa landing
- Depósitos confirmados
- Tasa de conversión (depósitos / leads × 100)
- Lead top scorer de la variante
- Botón **"Ver landing →"** → abre `pessaro.cl/campana/{variant}` en nueva pestaña
- Botón **"+ Ref"** → abre la landing con `?ref=DEMO`

**Tabla de links de referido:**
- Patrón: `https://pessaro.cl/campana/{variant}?ref=CODIGO`
- Botón copiar para cada variante

#### 5. Tab **👤 Mis Leads** — filtros agregados

Se agregaron filtros de **Landing** (variant) y **Perfil** en la vista de tabla de leads, consistentes con los filtros del Pipeline.

La variable `myParts` fue reemplazada por `filtered` (array de leads ya filtrado por variant/perfil).

---

### Estructura de tabs en CampanaModule

```
🏆 General   →  Leaderboard + Stats + Bonus tiers + Leads por capital
🚀 Landings  →  Cards de variantes + Links de referido         [NUEVO]
👤 Mis Leads →  Tabla editable de leads + Filtros + Añadir lead
```

---

### Base de datos

No se requirieron migraciones. `campaign_leads` ya tenía las columnas `variant` y `perfil` desde la migración `add_campaign_variant_perfil_2026_05_18`.

La vista `campaign_leads_admin` fue recreada el mismo día para incluir dichas columnas.

`campaign_participants` permanece en la base de datos (no fue eliminada) pero ya no es utilizada por el CRM. Puede archivarse en una futura limpieza.

---

### Leads de prueba insertados

Se insertaron 10 leads de prueba en `campaign_leads` para validar el flujo CMS ↔ CRM:

| Lead | Variante | Perfil | Score | Depósito |
|---|---|---|---|---|
| Matias Herrera | editorial | asesor | 200 | $52.000 |
| Diego Fuentes | navy | asesor | 90 | $8.500 |
| Camila Vargas | navy | mam | 90 | $6.200 |
| Sofia Reyes | bold | retail | 30 | — |
| Carlos Mendez | editorial | mam | 30 | — |
| Valentina Cruz | editorial | mam | 50 | — |
| Lucia Navarro | bold | retail | 30 | — |
| Ana Torres | navy | retail | 50 | — |
| Andres Morales | editorial | mam | 40 | — |
| Rodrigo Soto | bold | retail | 10 | — |

Emails actualizados a `@gmail.com` para que el CRM los reconozca correctamente.

---

### Commits asociados

```
feat(campana): unificar campaign_leads como fuente única, retirar campaign_participants
fix(campana): reemplazar participants.length por leads.length en barra de progreso
fix(campana): eliminar referencias a myParts — usar filtered
feat(campana): agregar tab Landings con cards de variantes, stats y links de referido
```

---

### Archivos modificados

```
src/App.jsx    — CampanaModule reescrito (función completa)
```
