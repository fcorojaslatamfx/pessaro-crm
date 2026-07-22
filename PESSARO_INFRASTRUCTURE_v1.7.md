# 📋 Pessaro Capital — Infraestructura Consolidada v1.7

**Creado:** 2026-02-25  
**Última actualización:** 2026-07-02  
**Versión:** 1.7 — Consolidada (CRM + Website + Educación)  
**Estado general:** 🟢 Operativo en producción

> ⚠️ **Este documento es el punto de control único del proyecto.** Fusiona `PESSARO_CRM_INFRASTRUCTURE.md` (v1.6) + `PESSARO_CL_ACTUALIZACION_2026_07_02.md` en una única fuente de verdad. Toda nueva herramienta, feature o modificación debe partir de lo aquí documentado.

---

## 📑 Tabla de contenidos

1. [Visión general](#visión-general)
2. [Cambios v1.6 → v1.7](#cambios-v16--v17)
3. [Stack tecnológico](#stack-tecnológico)
4. [Repos GitHub y dominios](#repos-github-y-dominios)
5. [Supabase (Backend)](#supabase-backend)
6. [Vercel (Hosting)](#vercel-hosting)
7. [pessaro.cl — Website + Educación](#pesaroclwebsite--educación)
8. [pessarocapital.com — Mirror](#pesarocapitalcomspanmirror)
9. [crm.pessaro.cl — CRM Operativo](#crmpesaroclcrm-operativo)
10. [Infraestructura de comunicaciones](#infraestructura-de-comunicaciones)
11. [WAFinance PWA](#wafinance-pwa)
12. [Equipos y visibilidad](#equipos-y-visibilidad)
13. [Estado de integraciones](#estado-de-integraciones)
14. [Pendientes críticos](#pendientes-críticos)
15. [Aprendizajes clave](#aprendizajes-clave)
16. [Contactos del equipo](#contactos-del-equipo)

---

## 🎯 Visión general

**Pessaro Capital** es una plataforma de gestión financiera especializada en PAMM/MAM (cuenta gestionada) que integra:
- **Website público** (pessaro.cl) con módulo educativo de 67 lecciones
- **CRM operativo** (crm.pessaro.cl) con WhatsApp + WAFinance + gestión de contactos
- **Mirror sincronizado** (pessarocapital.com) — actualmente desactualizado
- **Backend unificado** en Supabase con Edge Functions + PostgreSQL + RLS
- **Hosting en Vercel** con CI/CD desde GitHub

### Stack de usuarios
- 🔐 **Super Admin:** Francisco Rojas-Aranda (FRAG71D8)
- 👤 **Admin/Asesor:** Alejandra Peña Ortega (ALE7P)
- 🤝 **Equipo Radex (3):** Iván (IVAP29HW), Juan Pablo (JUAY4RZ4), Mario (MARQJUYC)
- 🤝 **Equipo Tradeview (2):** Daniel (DAN7E38C), Jose Pino (JOS5E6E1)

---

## 🔄 Cambios v1.6 → v1.7

| Cambio | Origen | Impacto | Sección afectada |
|--------|--------|--------|---|
| **Módulo educativo 67 lecciones** | merge staging→main (2026-07-01) | ✅ Producción | [pessaro.cl](#pesaroclwebsite--educación) |
| **Dominio login.pessaro.cl activo** | Descubierto en auditoría 2026-07-02 | 🟡 Sin documentación previa | [Dominios](#dominios-activos-en-vercel) |
| **Versiones Edge Functions actualizadas** | Consulta directa Supabase 2026-07-02 | 📋 Requiere actualización MD | [Edge Functions](#-edge-functions-activos) |
| **7 tablas educación (no 6)** | Conteo directo 2026-07-02 | 📊 Inventario incorrecto | [Tablas educación](#tablas-del-módulo-educativo) |
| **Blog 7 posts (no 4)** | Conteo directo 2026-07-02 | 📊 Inventario incorrecto | [Tablas web](#tablas-principales) |
| **Mirror desactualizado** | Deploy pessarocapital.com ~19 jun | 🔴 Acción crítica | [Sincronización mirror](#sincronización-pessarocapitalcom) |
| **Visibilidad de plantillas por equipo** | Deployment 2026-07-02 | ✅ Operativo | [Equipos y visibilidad](#🏷️-equipos-y-visibilidad-de-plantillas) |

---

## 🛠️ Stack tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|----------|
| **Frontend** | React 18 + TypeScript | ^18.0 | CRM web + website público |
| | React Router v6 | ^6.0 | Navegación SPA |
| | Vite | ^4.0+ | Bundling + HMR |
| | Tailwind CSS | ^3.0 | Styling |
| | Framer Motion | ^10.0 | Animaciones |
| **Backend** | Supabase (PostgreSQL) | 15+ | BD relacional + Auth |
| | Edge Functions (Deno) | v1 | Serverless logic |
| | PostgRest | latest | Auto-generated REST API |
| **Hosting** | Vercel | Pro plan | Deployment + CI/CD |
| | GitHub | Public repos | Version control |
| **Comunicaciones** | Meta WhatsApp Cloud API | v22.0 | WhatsApp Business |
| | Resend | v2 | Email transaccional |
| **Datos** | Twelve Data | free plan | Forex/Gold/Commodities |
| | Alpaca Market Data | free tier | US Equities (SPY/QQQ/USO) |
| | CoinGecko | free (no key) | Cryptocurrency |

---

## 📚 Repos GitHub y dominios

Todos los repos están bajo la org **`fcorojaslatamfx`** (públicos — lectura sin autenticación).

### 🌐 Dominios activos (verificado en Vercel 2026-07-02)

| Dominio | Repo | Tipo | Estado | Deploy |
|---------|------|------|--------|--------|
| **pessaro.cl** | pessaro_CL | Public website + Education | ✅ Live | prj_8y2vhpIKkDcWTkDc39iiyhPccUyE |
| login.pessaro.cl | pessaro_CL | Auth/Login (propósito TBD) | 🆕 Active | prj_8y2vhpIKkDcWTkDc39iiyhPccUyE |
| **crm.pessaro.cl** | pessaro-crm | CRM interno | ✅ Live | prj_PuTVHIVrF4phLF3ClvZz1anUMFKy |
| **pessarocapital.com** | pessaro | Mirror de website | 🔴 Outdated | prj_M0pvwvbKmB8voQC3LHWQqdBjhNDt |
| pessaro-cl.vercel.app | pessaro_CL | Fallback | ✅ | (mismo proyecto) |

### 📦 Repos

| Repo | URL | Rama prod | Última actualización |
|------|-----|----------|-----|
| **pessaro_CL** | github.com/fcorojaslatamfx/pessaro_CL | main | 2026-07-01 (módulo educación) |
| **pessaro-crm** | github.com/fcorojaslatamfx/pessaro-crm | master | 2026-07-02 (plantillas por equipo) |
| **pessaro** | github.com/fcorojaslatamfx/pessaro | master | 2026-06-19 (footer disclaimers) — OUTDATED |

**⚠️ Estado crítico:** Repo `pessaro` (mirror) está ~12 días atrás del código principal. Acción requerida: sincronizar commits desde `pessaro_CL/main` (a partir de `da9e666` inclusive).

---

## 🗄️ Supabase (Backend)

### Proyecto
```
Project ID:    ldlflxujrjihiybrcree
Región:        sa-east-1
Auth providers: Email + GitHub (opcional)
```

### 📊 Tablas principales

#### Contactos, leads y actividad
| Tabla | Registros | Columnas clave | Propósito |
|-------|-----------|---|---|
| `crm_contacts` | 37 | id, user_id, full_name, email, phone, status, source | Contactos personales del asesor |
| `campaign_leads` | 24 | id, phone, email, source, campaign_id, advisor_assigned | Leads de campañas |
| `contact_submissions` | — | id, email, phone, source | Leads anónimos de formularios (acceso super_admin) |
| `crm_notes` | — | id, contact_id, content, created_by, created_at | Notas sobre contactos |
| `contact_activity_log` | — | id, contact_id, activity_type, metadata, created_at | Historial de cambios (asignación, edición, invitaciones) |

#### Staff y equipos
| Tabla | Registros | Columnas clave | Propósito |
|-------|-----------|---|---|
| `crm_staff_profiles` | 8 | id, user_id, display_name, role, **team_id**, referral_code, signature_html | Perfiles de staff con team assignment |
| `crm_teams` | 3 | id, name, broker_user_id | Equipos: Radex, Tradeview, Pessaro Capital |
| `team_tools` | — | team_id, module_id, enabled | Permisos por módulo (no usado actualmente) |

**Team IDs:**
```
Radex:            0517359d-aa92-46d1-9505-f70590b80492
Tradeview:        632aa5e3-a4a6-4918-ae63-a8d1a27825c3
Pessaro Capital:  04536ab3-f27e-49cd-a437-b7a539cfdcee
```

#### Campañas
| Tabla | Registros | Columnas clave | Propósito |
|-------|-----------|---|---|
| `campaigns` | 4 | id, name, status, description | Campañas principales |
| `campaign_variants` | 16 | id, campaign_id, variant_key, landing_url | Variantes (Navy, Bold, Editorial, Minimalist) |
| `variant_advisors` | 32 | variant_id, staff_id, enabled | Asignación de variantes a asesores — **todos tienen 4/4** (fix 2026-07-02) |

#### Comunicaciones (WhatsApp)
| Tabla | Registros | Columnas clave | Propósito |
|-------|-----------|---|---|
| `whatsapp_messages` | — | id, meta_message_id, client_phone, direction, message_type, content, media_* | Mensajes in/out con metadata media |
| `whatsapp_assignments` | — | client_phone, assigned_to (FK crm_staff_profiles.id), assigned_at | Asignación de chats a asesores |
| `whatsapp_templates` | — | id, template_name, language, status | Plantillas aprobadas por Meta |

#### Módulo educativo (🆕 v1.7)
| Tabla | Registros | Columnas clave | Propósito |
|-------|-----------|---|---|
| `education_modules` | 9 | id, name, description, level, course_order | Cursos: Fundamentos, Operador Táctico, Trader Institucional, Mesa |
| `education_lessons` | 67 | id, module_id, title, content, lesson_order | Lecciones por módulo |
| `education_course_assignments` | — | id, client_email, module_id, assigned_by, created_at | Asignación de módulos a clientes |
| `education_completion` | — | id, assignment_id, completed_at | Historial de finalización |
| `education_certificates` | — | id, assignment_id, certificate_url, issued_at | Certificados PDF generados |
| `education_ratings` | — | id, lesson_id, student_email, rating, comment | Feedback de lecciones |
| `education_downloads` | — | id, lesson_id, student_email, downloaded_at | Tracking de descargas |

**Total: 7 tablas educación** (no 6 como documentado previamente).

#### Web (blog, contenido)
| Tabla | Registros | Columnas clave | Propósito |
|-------|-----------|---|---|
| `cms_blog_posts_2026_02_23_17_38` | **7** | id, title, slug, content, tags, published_at | Posts de blog (actualizado a 7, no 4) |

#### Emails
| Tabla | Registros | Columnas clave | Propósito |
|-------|-----------|---|---|
| `email_tracking` | — | id, resend_id, **sent_by**, audience, email_type, recipient_email, status | Tracking de envíos; RLS filtra por sent_by |

#### Tareas
| Tabla | Registros | Columnas clave | Propósito |
|-------|-----------|---|---|
| `crm_tasks` | — | id, task_type, contact_id, assigned_to, status, reminder_at | Tareas internas con notificación diaria |

#### Storage buckets
| Bucket | Público | Capacidad | MIME | Propósito |
|--------|---------|-----------|------|---|
| `whatsapp-attachments` | No | — | all | Media inbound/outbound WhatsApp |
| `public-assets` | Sí | 5MB | jpg/png/webp/mp4 | OG images + assets públicos |

### 🔐 RLS (Row Level Security)

Políticas principales:
```
crm_contacts:         SELECT/INSERT filtrado por user_id (asesor)
email_tracking:       SELECT filtrado por sent_by (non-SA); super_admin → all
contact_submissions:  SELECT restringido a super_admin
campaign_leads:       Filtrado en frontend por advisor_assigned / advisor_referral_code
whatsapp_messages:    Acceso por assigned_to (asesor) o super_admin
crm_tasks:           SELECT propio, INSERT/UPDATE solo assigned_to o creator
education_*:         Acceso público (sin auth) para visualización; UPDATE restringido a super_admin
```

### 🔧 Funciones SQL críticas

```sql
get_my_profile()              SECURITY DEFINER → perfil + team_id + tools[]
is_super_admin()              SECURITY DEFINER → chequea role en user_roles
is_crm_staff()                SECURITY DEFINER → existe en crm_staff_profiles
generate_referral_code()      SECURITY DEFINER → 8 chars único
```

**Triggers:**
- `trg_crm_staff_referral_code` — auto-genera referral_code en INSERT crm_staff_profiles
- `trg_contact_activity_log` — registra cambios en contact_activity_log

### 🚀 Edge Functions activos

**Estado:** 52 funciones desplegadas en total. Listamos las operativas:

#### Módulo educativo (🆕 despliegue producción ~1 jul 2026)
| Función | v | verify_jwt | Creada |
|---------|---|-----------|--------|
| `resolve-client-account` | 1 | false | ~1 jul |
| `education-otp` | 1 | false | ~30 jun |
| `generate-certificate` | 1 | true | ~29 jun |
| `check-course-access` | 1 | false | ~29 jun |
| `approve-course-assignment` | 1 | true | ~29 jun |
| `assign-course-to-client` | 1 | true | ~29 jun |

#### Website + Precios + Formularios
| Función | v | verify_jwt | Propósito |
|---------|---|-----------|-----------|
| `market_prices_2026_06_02` | **27** | false | Twelve Data + Alpaca + CoinGecko (caché ~1h) |
| `unified_forms_complete_2026_02_25_20_30` | **47** | false | Recibe forms de pessaro.cl → lead + email |
| `sitemap` | 15 | false | Mapa dinámico del sitio |
| `campaign_og_image` | 13 | false | OG images para campañas |
| `didit-webhook` | 22 | false | KYC webhook (Didit SDK) |
| `password_recovery_2026_06_18` | 3 | false | Reset password flow |
| `followup_leads_2026_03_27` | 14 | false | Seguimiento automático de leads |

#### CRM + Emails + Notificaciones
| Función | v | verify_jwt | Propósito |
|---------|---|-----------|-----------|
| `crm_send_email` | **22** | true | Envío de plantillas + firma HTML + validación team (fix 2026-07-02) |
| `push_notifications_2026_02_27` | 24 | true | Fan-out WhatsApp/email/SMS |
| `portal_ai_analysis_2026_03_13` | 15 | true | Análisis IA en portal cliente |
| `crm_invite_user` | 14 | true | Invitación de nuevo staff |

#### WhatsApp
| Función | v | verify_jwt | Propósito |
|---------|---|-----------|-----------|
| `whatsapp-webhook` | 15 | false | Inbound: texto/media, auto-asigna |
| `whatsapp-send` | 15 | true | Outbound: texto/template/media (SA) |

#### WAFinance (activo desde 2026-06-26)
| Función | v | verify_jwt | Propósito |
|---------|---|-----------|-----------|
| `wafinance_otp` | 6 | false | OTP generación/verificación |
| `wafinance_advisor` | 5 | true | Sugerencias IA para asesor |
| `task_notifications` | 1 | true | Notif + cron diario 12:00 UTC |

⚠️ **Discrepancia detectada:** Todas las versiones listadas aquí son **mayores** a las de `PESSARO_CRM_INFRASTRUCTURE.md` v1.6. Ejemplos: `market_prices` v25→v27; `crm_send_email` v18→v22; `unified_forms_complete` v45→v47.

---

## 🚀 Vercel (Hosting)

**Team ID:** `team_yWTwcJfKMrA9OeVDyqMmNxPc` (Pro plan)

| Proyecto | Project ID | Dominio | Repo | Rama prod | Última actualización |
|---|---|---|---|---|---|
| pessaro-cl | `prj_8y2vhpIKkDcWTkDc39iiyhPccUyE` | pessaro.cl | pessaro_CL | main | 2026-07-01 |
| pessaro-crm | `prj_PuTVHIVrF4phLF3ClvZz1anUMFKy` | crm.pessaro.cl | pessaro-crm | master | 2026-07-02 |
| pessarocapital | `prj_M0pvwvbKmB8voQC3LHWQqdBjhNDt` | pessarocapital.com | pessaro | master | 2026-06-19 ⚠️ |

### Build config (todos)
```
Framework: Vite
Node: 24.x (actualizado en 2026-07-02 — antes era 18.x)
Install: npm install
Build: npm run build
Output: dist/
```

### Últimos despliegues a producción

#### pessaro.cl (pessaro_CL/main)
| Fecha | Commit | Estado | Descripción |
|-------|--------|--------|---|
| 2026-07-01 | `482ebd7` | ✅ READY | merge staging→main: módulo educación completo (67 lecciones, OTP, visor fullscreen) |
| 2026-06-19 | `da9e666` | READY | feat(footer): disclaimers legales (riesgo + exención) |
| 2026-06-07 | `5203dc3` | READY | fix(minimalist): OTP vía Resend |

#### crm.pessaro.cl (pessaro-crm/master)
| Fecha | Commit | Estado | Descripción |
|-------|--------|--------|---|
| 2026-07-02 | `63e21c2` | ✅ READY | feat: filtrar plantillas por equipo (Radex/Tradeview) |
| 2026-07-01 | varios | READY | Ampliación contactos: asignación inline, modal edición |
| 2026-06-24 | RLS deploy | READY | Data isolation: email_tracking, campaign_leads, RLS |

#### pessarocapital.com (pessaro/master)
| Fecha | Commit | Estado | Descripción |
|-------|--------|--------|---|
| 2026-06-19 | latest | ⚠️ OUTDATED | Último commit: footer disclaimers — **12 días atrás** |
| Pendiente | — | 🔴 Acción | Sincronizar: commits desde `da9e666` en adelante (includes módulo educación) |

---

## 🌐 pessaro.cl — Website + Educación

### Estructura y rutas

**Sitio público:**
- `/` — Home con precios vivos, hero, propuesta de valor
- `/servicios` — PAMM/MAM overview
- `/blog` — 7 posts publicados
- `/contacto` — Formulario unificado (`unified_forms_complete` v47)
- `/campana/{variant}` — Campaign landing pages (Navy, Bold, Editorial, Minimalist) con proyector calculadora
- `/footer` — Legal disclaimers + exención de responsabilidad

**Módulo educativo (🆕 en producción desde 2026-07-01):**
- `/educacion` — Catálogo de 9 módulos × 3 niveles (Fundamentos, Operador Táctico, Trader Institucional, Mesa Pessaro)
- `/educacion/modulo/{id}` — Detalle del módulo + formulario OTP
- `/educacion/curso/{id}` — Visor fullscreen de 67 lecciones con:
  - SVG custom illustrations
  - Historial de progreso
  - Certificado PDF al completar
  - Sistema de rating (5 estrellas)
  - Descarga de contenido
  - Resolución automática de cuenta cliente → auth.uid() vía `resolve-client-account`

### Componentes destacados

| Componente | Ubicación | Propósito | Estado |
|---|---|---|---|
| Market Prices Widget | Home | Forex/Gold/Equities/Crypto en vivo | ✅ v27 |
| Campaign Calculator | `/campana/*` | Proyección de ganancias (Conservador 2%, Moderado 3.5%, Objetivo 5%) | ✅ |
| OTP Flow | `/educacion/*` | Email → Resend → código de verificación | ✅ v1 |
| Course Fullscreen Viewer | `/educacion/curso/{id}` | Visor con progreso, rating, certificados | ✅ Nuevo |
| Blog | `/blog` | 7 posts, tags, featured images | ✅ |

### Integraciones externas

- **Twelve Data API** — forex, commodities (caché 1h)
- **Alpaca Market Data** — US equities proxy (SPY/QQQ/USO)
- **CoinGecko API** — cryptocurrencies (sin key)
- **Didit KYC** — formulario con verificación
- **Meta OG/Twitter Card** — preview de módulo educativo + WAFinance

---

## 🪞 pessarocapital.com — Mirror

**Estado:** 🔴 **DESACTUALIZADO — Acción crítica requerida**

| Aspecto | Estado |
|--------|--------|
| Última sincronización | 2026-06-19 (footer disclaimers) |
| Commits atrás | ~6 commits (da9e666 en adelante) |
| Módulo educativo | ❌ NO TIENE (es el cambio más significativo) |
| Disclaimers legal | ✅ SÍ TIENE |
| Navegación | ✅ Idéntica a pessaro.cl |

### ⚠️ Acción requerida: Sincronizar repos

**Paso 1:** Verificar commits en pessaro_CL después de `da9e666`:
```bash
git log da9e666..origin/main --oneline
# Resultados esperados: ~6 commits (módulo educación + fixes)
```

**Paso 2:** Replicar commits a repo pessaro (mirror):
```bash
cd pessaro
git fetch origin fcorojaslatamfx/pessaro_CL main   # (NO es posible fetch directo entre orgs)
# Alternativa: manual cherry-pick de commits o reset a tag compatible
git merge-base origin/master origin/pessaro_CL/main  # encontrar punto común
```

**Paso 3:** Deploy a pessarocapital.com (Vercel automático al push a master).

**ETA:** 1-2 horas incluyendo validación.

---

## 💻 crm.pessaro.cl — CRM Operativo

### Módulos principales

#### 📊 Dashboard
- KPIs en tiempo real (contactos, leads, campañas)
- Gráficas de conversión por asesor
- Actividad reciente

#### 👥 Contactos
- **Listado:**
  - Búsqueda + filtros (estado, fuente, asesor)
  - **Novo (2026-07-02):** Asignar asesor directo desde dropdown en columna
  - Import masivo CSV/TXT
- **Modal detalle:**
  - Visión 360: notas, actividad, emails, tareas
  - **Novo (2026-07-02):** Botón "✏️ Editar" para actualizar nombre, email, phone, dirección, estado
  - Asignación de asesor (solo super_admin)
  - Toda edición registra `contact_activity_log`

#### 🚀 Campañas
- Gestión de variantes (Navy, Bold, Editorial, Minimalist)
- Asignación de variantes a asesores (todos tienen 4/4 activas — fix 2026-07-02)
- Tracking de UTM y conversion rates

#### 💬 WhatsApp
- Chat histórico filtrado por asesor asignado
- Envío: texto (todos), media (super_admin), templates (cuando Meta apruebe)
- Asignación automática a super_admin en inbound; reasignable a asesor
- Adjuntos: almacenados en `whatsapp-attachments` bucket + metadata

#### 📧 Emails
- **Plantillas:**
  - Bienvenida, Seguimiento, Invitación Radex, Invitación Tradeview, Depósito confirmado, Informe trimestral, Personalizado
  - **Novo (2026-07-02):** Filtrado por equipo del asesor (Radex ve "Invitación Radex" + estándar; Tradeview ve "Invitación Tradeview" + estándar; Pessaro Capital ve todas)
  - Double-layer aplicación: frontend (`visibleTemplates`) + backend (`crm_send_email` v22 con validación team)
- **Firmas:**
  - Columna `signature_html` en `crm_staff_profiles`
  - Francisco Rojas-Aranda y Jose Pino tienen firmas HTML premium (base64 embebido)
  - Auto-firma si NULL
  - Dollar-quoting obligatorio (`$sig$...$sig$`) para deploy
- **Tracking:**
  - `email_tracking` tabla con `sent_by` (FK auth.users)
  - RLS filtra por `sent_by` para non-super_admin
  - Resend API v2 para delivery + opens/clicks

#### 🎓 Educación (acceso desde CRM)
- Portal de estudiantes: cursos asignados, progreso, certificados
- Interfaz de admin: asignación de módulos, aprobación, generación de certificados

#### 📱 WAFinance
- **Chat público:** `/chat/{referralCode}` — cliente + asesor
- **Inbox del asesor:** `/wafinance-inbox` — todas las conversaciones abiertas
- **Invitación:** modal con OG preview + copiar link + envío vía `wa.me`

#### 📋 Tareas
- Creación: tipo (contacto, recordatorio, seguimiento), asignado_a, reminder_at
- Filtros: Pendientes, Hoy, Vencidas, Completadas, Todas
- Notificaciones: Edge Function `task_notifications` v1
- Cron diario: 12:00 UTC, notifica asignado + crea recordatorio

---

## 📧 Infraestructura de comunicaciones

### Resend (Email)

| Configuración | Estado |
|---|---|
| Dominio verificado | pessaro.cl (DKIM/SPF/MX ✅) |
| From address | send@pessaro.cl |
| API | v2 |
| Features | Transactional + tracking (opens/clicks) |
| Pendiente | DKIM pessarocapital.com |

**Uso:** 
- `crm_send_email` v22 envía todas las plantillas
- `unified_forms_complete` v47 envía confirmación a lead
- `email_tracking` + `email_open_webhook` para analytics

### Meta WhatsApp Cloud API

| Configuración | Estado |
|---|---|
| Phone Number ID | 1243185255538233 |
| WABA ID | 1910660326284814 |
| Número producción | +56 9 2207 1511 |
| Templates | ⏳ Pendiente aprobación Meta |
| 24-hour window | Texto solo; templates permitirán fuera de ventana |

**Webhooks:**
- `whatsapp-webhook` v15 (inbound) — text + media, auto-assign SA
- `whatsapp-send` v15 (outbound) — text/template/media

**Limitación actual:** sin templates aprobadas, solo funciona dentro de 24h de cliente iniciando chat. Meta suele aprobar en 1-3 días.

### Integrate.io / Radex Bridge (futuro)

Documentado en backlog; no activo aún.

---

## 📱 WAFinance PWA

### Arquitectura

**Sitio público:** `crm.pessaro.cl/chat/{referralCode}`
- Formulario: nombre + email + teléfono
- Edge Function `education-otp` → genera OTP vía Resend
- Verifica OTP → crea sesión (sessionStorage JWT)
- Chat realtime: cliente ↔ asesor (WebSocket via Supabase)

**Inbox del asesor:** `crm.pessaro.cl/wafinance-inbox`
- Lista de chats abiertos
- Edge Function `wafinance_advisor` v5 → sugerencias IA basadas en contexto
- Notificaciones en tiempo real

### Características

✅ **Fase 1 (Completa):**
- OTP vía Resend (`education-otp` v1)
- Chat realtime con presencia de asesor
- Historial persistente
- Media compartida (fotos, documentos)
- Imagen OG (`og-wafinance.jpg`) para preview al compartir link — **v2 (2026-07-22):** sin "100% Gratuito", destaca "Sin compromisos", "Chat exclusivo", "17 años de experiencia" y "Resultados auditados"

✅ **Fase 2 (Completa):**
- Historial de actividades por contacto (`contact_activity_log`)
- Tareas integradas: Pendientes/Hoy/Vencidas/Completadas/Todas
- Notificaciones: push + email + SMS (fan-out vía `push_notifications_2026_02_27` v24)
- Cron diario 12:00 UTC (`task_notifications` v1)

⏳ **Fase 3 (Backlog):**
- Integración MT4/MT5: tablas `mt4_positions`, `mt4_account_stats`
- Brokers soportados: IC Markets, Deriv, OANDA, Exness, XM Global
- Estado: solo documentado, no iniciado

### Invitación WAFinance

**Botón en modal:**
- Muestra preview de imagen OG (og-wafinance.jpg, v2)
- Badges: "Sin compromisos" (gold), "Chat exclusivo" (accent), "Resultados auditados" (gold) — ya no incluye "100% Gratuito"
- Texto corto: "Accede a tu chat exclusivo de asesoría"
- Botón "Copiar link" → `crm.pessaro.cl/chat/{refCode}` al clipboard
- Botón "Compartir por WhatsApp" → abre `window.open('https://wa.me/{phone}?text=...')` directamente
- **No usa Web Share API** — causa problemas en desktop; window.open es el estándar

---

## 🏷️ Equipos y visibilidad de plantillas

**Implementación:** 2026-07-02

Cada asesor pertenece a uno de 3 equipos. Las plantillas de **invitación** están restringidas:

| Equipo | Miembros | Ve "Inv. Radex" | Ve "Inv. Tradeview" | Ve estándar |
|---|---|:---:|:---:|:---:|
| **Radex** | Iván, Juan Pablo, Mario | ✅ | ❌ | ✅ |
| **Tradeview** | Daniel, Jose Pino | ❌ | ✅ | ✅ |
| **Pessaro Capital** | Francisco (SA), Alejandra | ✅ | ✅ | ✅ |

**Plantillas estándar (sin restricción):**
- Bienvenida, Seguimiento, Depósito confirmado, Informe trimestral, Personalizado
- Acceso CRM (solo SA)

**Aplicación:**
1. **Frontend** (`App.jsx`): `visibleTemplates` array filtrado por `staffProfile.crm_teams.name`
2. **Backend** (`crm_send_email` v22): mapa `TEAM_RESTRICTED` valida team_id antes de enviar; responde 403 si fuera de equipo

---

## 🔌 Estado de integraciones externas

| Servicio | Status | Bloqueo | ETA |
|---|---|---|---|
| Meta WhatsApp Business Verification | ⏳ En revisión | Templates sin aprobar | 1-3 días (Meta) |
| Resend DKIM pessarocapital.com | ⏳ Pendiente | No impacta producción | 1 día |
| Didit KYC | ✅ Operativo | Ninguno | — |
| Twelve Data / Alpaca / CoinGecko | ✅ Operativo | Ninguno | — |
| Calendly (futuro) | ⏳ Diseño | Backlog | TBD |
| MT4/MT5 (futuro) | ⏳ Documentado | Backlog | TBD |

---

## 🔴 Pendientes críticos (ordenados por impacto)

### 1. **Sincronizar mirror (pessarocapital.com)** — CRÍTICO
- **Status:** 🔴 Outdated 12+ días
- **Impacto:** Usuarios finales ven website sin módulo educativo en mirror
- **Acción:** Replicar commits desde `da9e666` (pessaro_CL/main) a `pessaro/master`
- **ETA:** 1-2h
- **Propietario:** Francisco

### 2. **Documentar login.pessaro.cl** — CRÍTICO
- **Status:** 🟡 Dominio activo sin documentación
- **Impacto:** No sabemos su propósito/flujo
- **Acción:** Auditar y documentar propósito + flujo de uso
- **Propietario:** Francisco

### 3. **Meta WhatsApp Template Approval** — IMPORTANTE
- **Status:** ⏳ Pending Meta review (1-3 días)
- **Impacto:** Botón "Iniciar chat" sin templates no funciona fuera de 24h
- **Acción:** Esperar aprobación Meta (no requiere código)
- **Propietario:** Meta

### 4. **Resend DKIM pessarocapital.com** — IMPORTANTE
- **Status:** ⏳ Pendiente setup CNAME/Zone File
- **Impacto:** Mirror puede tener delivery issues en emails desde pessarocapital.com
- **Acción:** Agregar CNAME a DNS; verificar en Resend
- **ETA:** <1h
- **Propietario:** Francisco

### 5. **Actualizar versiones Edge Functions en documentación** — IMPORTANTE
- **Status:** 🟡 v1.6 desactualizado
- **Impacto:** Documentación fuera de sync con realidad
- **Acción:** Actualizar v1.7 con versiones correctas (v27, v47, v22, etc.)
- **ETA:** <30 min
- **Propietario:** Ya hecho en v1.7

### 6. **Inventario incorrecto: Blog (4→7), Educación (6→7 tablas)** — INFORMACIÓN
- **Status:** 🟡 Conteo verificado 2026-07-02
- **Impacto:** Documentación de referencia imprecisa
- **Acción:** Actualizar conteos en MD
- **ETA:** Incluido en v1.7

---

## 📚 Aprendizajes clave (acumulado)

### Arquitectura y datos
- `contact_submissions.assigned_to` / `whatsapp_assignments.assigned_to` → FK `crm_staff_profiles.id`, NOT `auth.users.id`
- `crm_contacts.id` ≠ `auth.uid()` → resolver con `resolve-client-account` v1 antes de crear assignments educativas
- `assigned_to_user_id` en `education_course_assignments` MUST usar Supabase Auth UUID (`auth.users.id`), no `crm_contacts.id` — diferentes espacios UUID
- RLS recursion (PostgreSQL 42P17): usar `get_my_profile()` SECURITY DEFINER, nunca `EXISTS (SELECT FROM [tabla])` autoreferencial

### Frontend patterns
- Nunca reemplazar contenido existente → siempre mergear y complementar (Francisco enforces en `Educacion.tsx`)
- WAFinance invite: **solo** `window.open('https://wa.me/...')` — NO Web Share API (navigator.share() breaks desktop + sin saved contacts)
- Campaign variants (`/campana/navy`, etc.) MUST estar en root `<Routes>`, NOT en Layout wrapper (React Router v6 path duplication)
- `position:fixed;inset:0;overflow-y:auto` para campaign pages (NOT `min-height:100vh`)
- Todos los TSX/JSX generados → Python file writes (NO bash heredoc, evita `${}` interpolation)

### Git y deployment
- `-m "message"` en `git merge --no-ff` (bypass nano/vim en Windows)
- Conflict markers: `grep -rnE '^(<{7}|={7}|>{7})' src/ --exclude=index.css` (index.css líneas 8+30 son falsos positivos)
- `staging` = superset (includes todas las features activas); merge conflicts → keep staging
- Vercel branch alias: `pessaro-cl-git-[branch]-fcorojaslatamfxs-projects.vercel.app`

### Supabase
- Edge Functions **NO** pickup nuevos secrets sin full redeploy
- `CREATE POLICY IF NOT EXISTS` no soportado → `DROP POLICY IF EXISTS` + `CREATE POLICY`
- `CREATE OR REPLACE VIEW` falla si agrega columnas → `DROP VIEW IF EXISTS` + `CREATE VIEW`
- Dollar-quoting (`$sig$...$sig$`, `$POST$...$POST$`) obligatorio para multilínea + apóstrofes en SQL
- `CHECK` constraints → `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` para expandir valores

### Nuevo en v1.7
- Un merge conflict mal resuelto puede descartar silenciosamente código sin dejar rastro — SIEMPRE re-validar archivo final con `diff`
- Filtros de visibilidad (frontend) DEBEN reforzarse en backend — frontend NUNCA es barrera única de autorización
- Al crear staff manualmente (SQL directo), completar TODAS las filas relacionadas (`variant_advisors` para c/variante), no solo 1
- Mirror (pessaro/master) puede divergir significativamente de principal (pessaro_CL/main) si no se sincroniza regularmente; disciplina de sincronización crítica

---

## 📇 Contactos del equipo

| Nombre | Rol | Equipo | Ref Code | Email | Teléfono |
|---|---|---|---|---|---|
| **Francisco Rojas-Aranda** | Super Admin | Pessaro Capital | FRAG71D8 | fcorojas.fx@gmail.com | — |
| **Alejandra Peña Ortega** | Admin/Asesor | Pessaro Capital | ALE7P | — | — |
| **Daniel Malpartida** | Asesor | Tradeview | DAN7E38C | — | — |
| **Iván Serrano** | Asesor | Radex | IVAP29HW | — | — |
| **Jose Pino** | Asesor | Tradeview | JOS5E6E1 | — | — |
| **Juan Pablo Alberio** | Asesor | Radex | JUAY4RZ4 | — | — |
| **Mario Fatigante** | Asesor | Radex | MARQJUYC | — | — |

---

## 📋 Resumen de cambios v1.6 → v1.7

| Sección | Cambio |
|---------|--------|
| Título + Versionado | Consolidada v1.7 (CRM + Website integrado) |
| Edge Functions | Versiones actualizadas: v25→v27, v45→v47, v18→v22 |
| Dominios | Agregado `login.pessaro.cl` (nuevo descubierto) |
| Tablas Educación | 6→7 tablas (`education_downloads` + `education_ratings` agregadas) |
| Conteo Blog | 4→7 posts |
| Módulo Educativo | Seccion nueva: 67 lecciones, 9 módulos, OTP, certificados, visor fullscreen |
| pessaro.cl | Seccion nueva: documentación completa del website + rutas |
| pessarocapital.com | Seccion nueva: estado del mirror + acción crítica de sincronización |
| Aprendizajes | Nuevos insights de v1.7 agregados |
| Pendientes | Priorizados y cuantificados por impacto |
| Status WAFinance | Confirmado activo (v6 OTP, v5 advisor, v1 notificaciones) |
| Visibilidad plantillas | Double-layer (frontend + backend) documentado |

---

**Documento generado:** 2026-02-25  
**Última actualización:** 2026-07-02  
**Versión:** 1.7 — Consolidada (CRM + Website + Educación)  
**Mantenedor:** Francisco Rojas-Aranda  
**Próxima revisión recomendada:** Al completar sincronización de mirror, o antes de próximo deploy mayor a main.
