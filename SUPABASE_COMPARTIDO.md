# Supabase compartido — pessarocl ↔ pessaro-crm

**Este archivo vive duplicado, literal, en la raíz de los dos repos** (`pessarocl` y `pessaro-crm`, `github.com/fcorojaslatamfx/pessaro-crm`). No hay submódulo ni symlink entre ellos — son repos separados. Si lo editas en uno, edítalo igual en el otro y anota la fecha en el historial de cambios del final.

**Por qué existe:** ambos repos despliegan contra el **mismo proyecto Supabase**, y varios errores reales del proyecto salieron de tratarlos como si fueran independientes (desplegar una función desde el repo equivocado, apagar un switch de Auth pensando que solo afecta a uno). Este documento es la lista corta de lo que **no se puede decidir mirando un solo repo**. No reemplaza `CLAUDE.md` (pessarocl) ni `PESSARO_CRM_INFRASTRUCTURE.md`/`CHANGELOG_CRM.md` (pessaro-crm) — esos siguen siendo la fuente de verdad de cada repo por separado.

**Regla de lectura:** antes de tocar Supabase Auth (CAPTCHA, rate limits, providers, plantillas de email), `whatsapp-webhook`, `whatsapp-send`, cualquier tabla o política RLS de la lista de abajo, o cualquier cosa marcada "sin corregir" acá — lee este archivo primero, en el repo en el que estés.

## El proyecto

| Proyecto Supabase | Ref | Quién lo usa |
|---|---|---|
| `Pessaro Capital - Web - CRM - Academia - Agente AI` | `ldlflxujrjihiybrcree` | **pessarocl** (`pessaro.cl`, `staging.pessaro.cl`), el espejo (`pessarocapital.com`, repo `pessaro`), **pessaro-crm** (`crm.pessaro.cl`) y la Academia |
| `brige` | `clyhqxzrmakteuraeaau` | Bridge — Auth independiente, no le afecta nada de este documento |
| `pessaro-trading-portal` | `ckouxsidjkqhqfwvmakn` | Portal de trading — Auth independiente, no le afecta nada de este documento |

**No hay base de staging separada.** `staging.pessaro.cl`, el piloto/producción de WABA y cualquier prueba manual escriben sobre la misma base que ve producción. Antes de "probar algo", decide cómo lo vas a identificar y limpiar (convención usada hasta ahora: un valor distintivo en `created_via`/`origen`, y borrar solo lo que nace con ese marcador — nunca por email o teléfono a ojo, puede haber un cliente real detrás).

## Qué se despliega desde dónde (la trampa real)

`whatsapp-webhook` existe en el árbol de **los dos repos**, pero solo una copia es la desplegada:

| | pessarocl (la fuente real) | pessaro-crm (copia vieja, no desplegar) |
|---|---|---|
| Bot WABA | sí | no |
| Firma de Meta (`x-hub-signature`) | sí | no |
| `verify_jwt` en `config.toml` | `false`, declarado | no declarado |

Desplegar `whatsapp-webhook` desde `pessaro-crm` borra el bot de producción **y** lo redespliega con `verify_jwt = true` (default del CLI), lo que hace que Meta reciba 401 en silencio y el canal de WhatsApp completo quede mudo, sin error visible en ningún dashboard. Ya pasó que el CRM se usó como origen de despliegue para otra función (`documento_acceso`, 2026-08-18) — no es un riesgo teórico. **Antes de un `supabase functions deploy whatsapp-webhook`, confirma desde qué repo lo estás corriendo.**

Al revés: `whatsapp-send`, `generar-analisis-diario`, `generar-articulos-referencias`, `documento_acceso`, `support_*` **solo existen en pessaro-crm** — editarlas en pessarocl no tiene ningún efecto.

## Seguridad de Auth/roles compartidos — leer antes de tocar

**No hay detalle de hallazgos abiertos en este archivo a propósito** (los dos repos son públicos en GitHub; describir aquí un problema de permisos sin corregir sería publicar la receta antes del parche). Antes de tocar cualquiera de estos puntos, pide a Claude Code que consulte su memoria local del proyecto — ahí sí vive el detalle completo, y esa memoria nunca se commitea:

- Cualquier función que decida permisos leyendo `user_metadata` (en vez de una tabla de roles server-side): confirma con Claude Code si hay algún hallazgo abierto sobre esa función antes de asumir que el chequeo es confiable.
- Cualquier política RLS de `INSERT`/`UPDATE` sobre tablas de perfil de cliente o KYC: verifica el `WITH CHECK` real en `pg_policies`, no lo que diga un comentario o una migración vieja — puede haber quedado desactualizado.
- El switch de CAPTCHA/Attack Protection de Supabase Auth es **por proyecto, no por app**. Encenderlo en `ldlflxujrjihiybrcree` afecta a los 4 frontends a la vez (pessaro.cl, staging, el espejo, crm.pessaro.cl), aunque solo pessarocl tenga el código de Turnstile (`src/lib/captcha.ts`). Antes de tocarlo, portar el mismo widget + `VITE_TURNSTILE_SITE_KEY` a los otros frontends o el login de todos queda `400 captcha_failed`. Estado actual: en stand-by, ver `HISTORICO.md` (pessarocl).

Si trabajas sin Claude Code o su memoria no está disponible, pregunta a Francisco antes de asumir que un chequeo de rol/permiso compartido está bien.

## El teléfono no tiene un formato único

La migración `20260813_telefonos_solo_digitos.sql` (repo pessaro-crm) dejó en solo dígitos las 6 tablas de la cadena WhatsApp/CRM (`crm_contacts`, `campaign_leads`, `contact_submissions`, `whatsapp_messages`, `whatsapp_assignments`, `whatsapp_opt_outs`), pero **no** las del portal (pessarocl): `client_profiles_2026_02_08_22_02`, `risk_profiles_2026_02_08_21_16`, `newsletter_subscriptions`, `education_downloads`, `live_chat_otp`, `crm_staff_profiles` siguen mezclando `+56...` y `56...`. Cualquier consulta que cruce un teléfono entre las dos familias de tablas busca **los dos formatos** (`.in([phone, '+' + phone])`), nunca `.eq()`.

## Edge Functions (Deno): sin lockfile, con versión pineada en cada import

**Nunca trackear `deno.lock`** en ninguno de los dos repos (ambos lo ignoran en `.gitignore`). Un `deno.lock` generado localmente (típicamente por la extensión de Deno de VS Code, sin que nadie lo pida) puede traer una versión de formato distinta a la que espera el entorno de despliegue de Supabase y romper `supabase functions deploy` con errores de `eszip` — es un problema real y documentado del CLI (`supabase/cli#1584`, `supabase/supabase#17901`, `supabase/cli#621`), no hipotético. Si ves un `deno.lock` en el árbol de trabajo, bórralo; no lo agregues al commit.

En su lugar, la reproducibilidad de los imports remotos se logra **pineando la versión exacta en cada `import`** — nunca solo el major:

```typescript
// ❌ Prohibido — versión flotante: esm.sh resuelve "lo último 2.x" en cada
// deploy, así que el mismo código puede correr con dependencias distintas
// sin que nadie haya tocado una línea.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ✅ Obligatorio — versión exacta.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
```

Antes de modificar, crear o desplegar cualquier Edge Function: (1) confirma que no se está arrastrando un `deno.lock`; (2) revisa que cada `import` de CDN (`esm.sh`, `deno.land`) tenga versión exacta — si encuentras `@2` u otro pin de solo major, corrígelo a la versión estable vigente del proyecto antes de tocar el resto del archivo.

## Convención de roles

Los roles del sistema están en **español**: `cliente`, `interno`, `asesor`, `super_admin`. No existe `client` en inglés — un valor en inglés escrito por error no matchea ninguna política ni ningún chequeo de rol, y falla en silencio.

## Historial de cambios de este documento

- 2026-08-19 — creado. Primera versión incluía detalle de hallazgos de seguridad sin corregir; se reescribió antes de commitear nada porque ambos repos son públicos — el detalle vive solo en memoria local de Claude Code, nunca en este archivo.
- 2026-08-19 — agregada la sección de Edge Functions/Deno (prohibido trackear `deno.lock`, versión pineada en cada import), tras encontrar un `deno.lock` suelto en `pessaro-crm` y confirmar 14 imports flotantes de `@supabase/supabase-js@2` entre los dos repos.
