# 📋 Pessaro Capital CRM — Infraestructura Definitiva

**Creado:** 2026-02-25  
**Última actualización:** 2026-07-21  
**Estado general:** 🟢 Operativo (WhatsApp + Campañas + Contactos + Emails + Soporte)

---

## 📑 Tabla de contenidos

1. [Visión general](#visión-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Supabase (Backend)](#supabase-backend)
4. [Vercel (Hosting)](#vercel-hosting)
5. [GitHub (Repos)](#github-repos)
6. [Estado de integraciones externas](#estado-de-integraciones-externas)
7. [Funcionalidad operativa](#funcionalidad-operativa)
8. [Mejoras pendientes](#mejoras-pendientes)
9. [Instrucciones críticas](#instrucciones-críticas)
10. [Contactos del equipo](#contactos-del-equipo)
11. [WAFinance — Chat en vivo](#wafinance)
12. [Soporte — Tickets OTP](#soporte-tickets-otp)

---

## 🎯 Visión general

**Pessaro Capital** es una plataforma de gestión de relaciones con clientes (CRM) especializada en servicios financieros, con integración completa de WhatsApp, campañas de marketing y gestión de contactos.

### Usuarios finales
- **Super Admin:** Francisco Rojas-Aranda (FRAG71D8) — Control total
- **Admin:** Alejandra Peña Ortega (ALE7P) — Moderation
- **Asesores:** Daniel (DAN7E38C), Iván (IVAP29HW), Juan Pablo (JUAY4RZ4), Mario (MARQJUYC), Jose Pino (JOS5E6E1)

### Alcance actual
- ✅ Dashboard administrativo completo
- ✅ Gestión de contactos + import masivo CSV/TXT
- ✅ Campañas con variantes (Navy, Bold, Editorial, Minimalist)
- ✅ WhatsApp: adjuntos (super_admin), texto (todo staff), asignación a asesores
- ✅ Emails: plantillas, seguimiento
- ✅ Análisis: reportes, KPIs, previsiones
- ✅ **Aislamiento de datos por rol** (2026-06-24): cada asesor ve solo SUS contactos, emails, leads y KPIs
- ✅ **Soporte (Tickets OTP)** (2026-07-21): portal público `/soporte` para clientes (verificación OTP email) + inbox de staff en el CRM, aislado por asesor asignado
- 🔜 **WAFinance** — Chat en vivo integrado al CRM con:
  - Formulario de registro + OTP email verification (5 min expiry)
  - Lead auto-insertado en campaign_leads (advisor_referral_code)
  - Botón "Invitar por WhatsApp" en CRM → abre wa.me con mensaje personalizado crm.pessaro.cl/chat/:referralCode
  - Chat Realtime con Push Notifications al asesor

---

## 🛠️ Stack tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|----------|
| **Frontend** | React 18 + TypeScript | ^18.0 | CRM web responsivo |
| | React Router v6 | ^6.0 | Navegación SPA |
| | Vite | ^4.0 | Bundling + HMR |
| | Tailwind CSS | ^3.0 | Styling |
| | Framer Motion | ^10.0 | Animaciones |
| | shadcn/ui | latest | Componentes base |
| **Backend** | Supabase (PostgreSQL) | 15+ | BD relacional |
| | Edge Functions (Deno) | v1 | Serverless logic |
| | PostgRest | latest | Auto-generated REST API |
| **Hosting** | Vercel | Pro plan | Deployment + CI/CD |
| **Comunicaciones** | Meta WhatsApp Cloud API | v22.0 | WhatsApp Business |
| | Resend | latest | Email transaccional |
| **Versionamiento** | GitHub | public | Repos (pessaro-crm, pessaro, pessarocl) |

---

## 🗄️ Supabase Backend

### Proyecto ID
```
ldlflxujrjihiybrcree
```

### 📊 Tablas principales

#### Contactos y leads
| Tabla | Columnas clave | Propósito |
|-------|---|---|
| `crm_contacts` | id, user_id, full_name, email, phone, address, notes, status, source | Contactos personales del usuario |
| `campaign_leads` | id, phone, email, source, status, campaign_id | Leads de campañas (WhatsApp + emails) |
| `crm_notes` | id, contact_id, content, created_by, created_at | Notas dinámicas sobre contactos |
| `crm_staff_profiles` | id, user_id, display_name, role, referral_code, team_id, pessaro_email, phone | Perfiles de staff (asesor, admin, super_admin) |

#### Campañas
| Tabla | Columnas clave | Propósito |
|-------|---|---|
| `campaigns` | id, name, status, description, created_by, created_at | Campañas principales (ej: "Campaña Q2 2026") |
| `campaign_variants` | id, campaign_id, variant_key, label, color, landing_url, status | Variantes por campaña (Navy, Bold, Editorial, Minimalist) |
| `variant_advisors` | id, variant_id, staff_id, enabled, granted_by, granted_at | Asignación de variantes a asesores |

#### WhatsApp
| Tabla | Columnas clave | Propósito |
|-------|---|---|
| `whatsapp_messages` | id, meta_message_id, client_phone, direction, message_type, content, status, media_storage_path, media_mime, media_size, media_meta_id, created_at | Mensajes (in/out) con metadata de media |
| `whatsapp_assignments` | client_phone, assigned_to (FK crm_staff_profiles.id), assigned_by, assigned_at | Asignación de chats a asesores |
| `whatsapp_templates` | id, template_name, language, status, variables_count, body_text, footer_text | Plantillas aprobadas por Meta |

#### Emails
| Tabla | Columnas clave | Propósito |
|-------|---|---|
| `email_tracking` | id, resend_id, **sent_by (FK auth.users)**, audience, email_type, recipient_email, recipient_name, subject, status, sent_at, metadata | Tracking de emails enviados (RLS: asesor ve solo sus envíos) |
| `cms_email_queue` | id, recipient, template_name, variables, status, sent_at | Cola de emails enviados |
| `cms_blog_posts_2026_02_23_17_38` | id, title, slug, content, tags, featured_image, status, published_at | Posts del blog |

#### Soporte (Tickets OTP) — 🆕 2026-07-21
| Tabla | Columnas clave | Propósito |
|-------|---|---|
| `support_tickets` | id, ticket_number (PSR-#####), contact_id, client_email, client_phone, client_name, subject, category, priority, status, assigned_to (FK crm_staff_profiles.id), team_id, otp_verified | Tickets de soporte creados por clientes vía portal público |
| `support_ticket_messages` | id, ticket_id, sender_type (client/staff/system), sender_staff_id, content, attachment_path | Hilo de mensajes por ticket |
| `support_otp_sessions` | id, client_email, client_phone, channel (email/sms), code_hash (SHA-256), attempts, expires_at, verified_at, session_token | Sesiones OTP del portal de soporte (patrón WAFinance) |

#### Otros
| Tabla | Columnas clave | Propósito |
|-------|---|---|
| `user_roles_2026_02_08_22_02` | user_id, role | Roles de autenticación |
| `crm_teams` | id, name, description | Equipos de trabajo |
| `team_tools` | team_id, module_id, enabled | Permisos por módulo (campañas, mensajes, emails, etc.) |

### 🔐 RLS (Row Level Security)

#### Bucket `whatsapp-attachments` (privado, 100MB)
```
MIMEs permitidos: image/jpeg, image/png, application/pdf, .docx, .xlsx

Policies:
├─ INSERT:   is_crm_staff()  [super_admin + admin + asesor]
├─ SELECT:   is_crm_staff()  [super_admin + admin + asesor]
├─ UPDATE:   is_super_admin()
└─ DELETE:   is_super_admin()
```

#### Bucket `support-attachments` (privado, 5MB) — ⏳ PENDIENTE DE CREACIÓN
```
MIMEs permitidos (planeado): image/jpeg, image/png, image/webp, application/pdf

Estado: columna support_ticket_messages.attachment_path ya existe en el schema,
pero el bucket no se ha creado (ningún flujo de adjuntos implementado aún en
support_otp/support_tickets/SupportPortal/SupportTicketView/SupportInbox).
Crear vía Dashboard/API de Storage cuando se implemente la subida de adjuntos,
siguiendo el patrón de whatsapp-attachments.
```

#### Tablas SQL críticas
```
crm_contacts:
├─ SELECT:  auth.uid() = user_id (solo su propios contactos)
└─ INSERT:  auth.uid() = user_id (solo puede crear para sí mismo)

email_tracking: (ACTUALIZADO 2026-06-24)
├─ SELECT:  is_super_admin() OR sent_by = auth.uid()
└─ Efecto:  Cada asesor ve SOLO los emails que él envió. SA ve todos.

contact_submissions: (ACTUALIZADO 2026-06-24)
├─ SELECT:  is_super_admin() (SOLO super_admin puede ver formularios web)
└─ Efecto:  Asesores NO ven formularios web, solo sus crm_contacts.

campaign_leads:
├─ SELECT:  true (RLS abierto, FILTRADO en frontend por advisor_assigned/advisor_referral_code)
├─ INSERT:  Webhook de Meta o admin
└─ Frontend: myLeads filtrado en render por emailPrefix match o referral_code match

variant_advisors:
├─ UPDATE:  role = 'super_admin' (solo admin puede asignar variantes)

whatsapp_messages:
├─ SELECT:  role = 'super_admin' OR (assigned_to en whatsapp_assignments)

support_tickets: (NUEVO 2026-07-21)
├─ SELECT/UPDATE:  is_super_admin() OR (is_crm_staff() AND assigned_to = mi perfil)
└─ Efecto:  Cada asesor ve/edita solo los tickets asignados a él. SA ve todos.

support_ticket_messages: (NUEVO 2026-07-21)
├─ SELECT/INSERT:  is_super_admin() OR (is_crm_staff() AND EXISTS ticket asignado al staff)
└─ Efecto:  Aislamiento por ticket asignado (join a support_tickets, no recursivo — tabla distinta)

support_otp_sessions: (NUEVO 2026-07-21)
└─ Sin policies para authenticated/anon → solo accesible via service_role (Edge Functions)
```

### 🔧 Funciones SQL críticas

#### `get_my_profile()`
```sql
SECURITY DEFINER, SET search_path = public
Retorna: { id, user_id, display_name, role, referral_code, tools: [...], team_id }
Propósito: Auth check + autorización de módulos
Tools soportados: dashboard, contactos, pipeline, campanas, tareas, emails, reportes, whatsapp, equipo
```

#### `is_super_admin()`
```sql
SECURITY DEFINER
Retorna: boolean
Verifica: role = 'super_admin' en user_roles_2026_02_08_22_02
```

#### `is_crm_staff()`
```sql
SECURITY DEFINER
Retorna: boolean
Verifica: EXISTS(crm_staff_profiles.user_id = auth.uid())
```

#### `generate_referral_code(p_display_name text)`
```sql
SECURITY DEFINER (nueva, creada 2026-06-24)
Retorna: text (8 chars: 3 prefijo + 5 random)
Patrón: primeras letras del nombre + caracteres aleatorios (sin 0/O/1/I/L)
Propósito: Auto-generar códigos únicos para referidos
Unicidad: Verifica col. referral_code para evitar duplicados
```

#### Triggers
```
trg_crm_staff_referral_code (BEFORE INSERT on crm_staff_profiles)
├─ Si referral_code IS NULL, ejecuta generate_referral_code(display_name)
├─ Creado: 2026-06-24
└─ Propósito: Auto-llenar códigos en nuevo staff
```

### 🚀 Edge Functions (Deno Runtime)

#### Webhook WhatsApp
```
Nombre:     whatsapp-webhook
Versión:    13 (actualizado 2026-06-24)
verify_jwt: false
Métodos:    GET (verificación Meta), POST (webhooks)

Funcionalidad:
├─ GET:  /hub.challenge para verificación de webhook
├─ POST: Recibe eventos de Meta:
│   ├─ messages (inbound):
│   │   ├─ Texto, botones, interactivos
│   │   ├─ Imagen, documento, video, audio (⭐ NEW v13: descarga + sube a Storage)
│   │   ├─ Location
│   │   └─ Auto-asigna a super_admin si sin asignación
│   ├─ statuses: delivered, read, failed (guardado en BD)
│   └─ Push notifications fan-out a usuario asignado o super_admin

Secretos requeridos:
├─ WA_PERMANENT_TOKEN (auth Meta)
├─ WA_VERIFY_TOKEN (verificación webhook)
└─ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Paths Storage (inbound media):
└─ whatsapp-attachments/inbound/YYYY/MM/{uuid}.{ext}
```

#### Send WhatsApp
```
Nombre:     whatsapp-send
Versión:    13 (actualizado 2026-06-24)
verify_jwt: true

Actions:
├─ send_text:
│   ├─ Parámetro: to (cliente), body (texto)
│   ├─ Validación: caller debe ser staff CRM
│   ├─ Ownership: cliente debe estar en whatsapp_assignments asignado a caller OR en crm_contacts del caller
│   └─ Retorna: { success: bool, message_id: string, status: 'sent'|'failed' }
│
├─ send_template:
│   ├─ Parámetro: to, template_name, language, components (variables)
│   ├─ Validación: caller = staff CRM, plantilla debe estar APPROVED
│   └─ Propósito: Enviar plantillas aprobadas por Meta
│
├─ send_media: (SOLO super_admin)
│   ├─ Parámetro: to, media_type, file_path (Storage), caption (opcional), assign_to_user_id (opcional)
│   ├─ Validación: caller role = 'super_admin'
│   ├─ Subida: Descarga del Storage → sube a Meta /v22.0/{phone-id}/media → obtiene media_id
│   ├─ Límites: JPG/PNG 5MB, PDF/DOCX/XLSX 100MB
│   ├─ Retorna: { success, message_id, media_id }
│   └─ Asignación: Si assign_to_user_id, upsert whatsapp_assignments
│
└─ start_chat: (para cualquier staff CRM)
    ├─ Parámetro: to, template_name, language, components
    ├─ Validación: caller = staff CRM, cliente en crm_contacts del caller
    ├─ Propósito: Iniciar chat con plantilla cuando cliente nunca ha escrito
    └─ Auto-asignación: Asigna chat al caller si no estaba asignado
```

#### Soporte (Tickets OTP) — 🆕 2026-07-21
```
support_otp (v2):
├─ verify_jwt: false (público, sin Supabase Auth — patrón wafinance_otp)
├─ Action request: código 6 dígitos, hash SHA-256, envío vía Resend, rate limit 3/10min
└─ Action verify: máx 5 intentos, emite session_token (TTL 24h)

support_tickets (v1):
├─ verify_jwt: false (público, valida session_token server-side en cada action)
├─ Actions: create_ticket, list_my_tickets, get_ticket, add_message
└─ Resuelve contact_id por email contra crm_contacts; hereda asesor/equipo o asigna a super_admin

support_notify (v1):
├─ verify_jwt: true (solo invocación server-to-server desde support_tickets)
├─ Notifica por email (Resend) al asesor asignado al crear ticket / nuevo mensaje de cliente
└─ Fan-out opcional vía push_notifications_2026_02_27 (contrato de payload asumido, no verificado end-to-end)

Rutas frontend: /soporte (portal cliente), /soporte/ticket/:ticketNumber (hilo), módulo "Soporte" en sidebar CRM (SupportInbox)

⏳ Pendiente Fase 2: mensatek_send (SMS OTP + avisos vía Mensatek, verify_jwt: true) — ver §Mejoras pendientes
```

#### Otros Edge Functions críticos
```
password_recovery_2026_06_18 (v1):
├─ verify_jwt: false
├─ Acción: Genera link de reset + envía vía Resend
└─ Timeout: 8 seg (Promise.race)

push_notifications_2026_02_27 (v22):
├─ Action: send_to_user (fan-out a dispositivos)
├─ Canales: WhatsApp, email, SMS
└─ Prioridad: Crítica para alertas

market_prices_2026_06_02 (v25):
├─ Proveedor: Twelve Data (forex/XAU) + Alpaca (SPY/QQQ/USO snapshot) + CoinGecko (crypto)
├─ Caché: ~1h
└─ Egress whitelist: Twelve Data ✅, CoinGecko ✅, Alpaca ✅

crm_send_email (v19, actualizado 2026-06-24):
├─ Proveedor: Resend
├─ From: send@pessaro.cl
├─ Template: HTML custom
└─ ⭐ NEW v19: Inserta sent_by = user.id en email_tracking (aislamiento por asesor)

unified_forms_complete_2026_02_25_20_30 (v45):
├─ Proveedor: Recibe from pessaro.cl contact forms
├─ Acción: Insert campaign_leads + send email + push notification

inbox_manager_2026_04_26 (v11):
├─ Proveedor: Maneja sistema de tareas internas
```

---

## 🚀 Vercel Hosting

### Proyectos

#### 1. pessaro-cl (público www)
```
Project ID:  prj_8y2vhpIKkDcWTkDc39iiyhPccUyE
Team ID:     team_yWTwcJfKMrA9OeVDyqMmNxPc
Domain:      pessaro.cl
Repo:        fcorojaslatamfxs/pessarocl (GitHub)
Branch:      master → auto-deploy
Environment: production (Node.js)

Últimas características (actualizado 2026-06-24):
├─ Precios en vivo (forex + crypto + ETFs)
├─ Blog integrado (posts de Supabase)
├─ Footer con disclaimers legales
└─ Landing páginas optimizadas
```

#### 2. pessarocapital.com (espejo)
```
Project ID:  prj_M0pvwvbKmB8voQC3LHWQqdBjhNDt
Team ID:     team_yWTwcJfKMrA9OeVDyqMmNxPc
Domain:      pessarocapital.com
Repo:        fcorojaslatamfxs/pessaro (GitHub)
Branch:      master → auto-deploy
Purpose:     Espejo de pessaro.cl (mismo contenido, dominio alternativo)

⚠️ Pendiente:
└─ Resend DKIM verificación para pessarocapital.com
```

#### 3. CRM (pessaro-crm)
```
Project ID:  prj_PuTVHIVrF4phLF3ClvZz1anUMFKy
Team ID:     team_yWTwcJfKMrA9OeVDyqMmNxPc
Domain:      crm.pessaro.cl
Repo:        fcorojaslatamfxs/pessaro-crm (GitHub)
Branch:      master → auto-deploy + staging (preview)
Environment: Node.js 20

Stack:
├─ Frontend: React 18 + Vite
├─ Compilación: TypeScript → JS
├─ Bundler: Esbuild (via Vite)
└─ Deploy: Vercel + Supabase Edge Functions

Características activas (actualizado 2026-06-24):
├─ Dashboard con KPIs
├─ Gestión de contactos + import CSV/TXT (con revisión duplicados)
├─ Campañas con variantes + referral links
├─ WhatsApp: chats, adjuntos, asignación
├─ Emails: plantillas + seguimiento
├─ Reportes: gráficos, exportación
└─ Equipo: usuarios, roles, permisos
```

### Configuración crítica

#### Firewall
```
Plan: Pro (no Enterprise)
Método: Custom Firewall Rules
Bypass: NOT configurado (requiere Enterprise)
```

#### Secrets / Env vars
```
VITE_SUPABASE_URL:       https://ldlflxujrjihiybrcree.supabase.co
VITE_SUPABASE_ANON_KEY:  [anon key — público en cliente]
VITE_MAPBOX_TOKEN:       [si usan mapas]
SENTRY_DSN:              [si usan error tracking]
```

#### Build
```
Framework:  Vite
Install:   npm install
Build:     npm run build
Output:    dist/
Node:      18.x+
```

---

## 📚 GitHub Repos

### 1. pessarocl
```
URL:         https://github.com/fcorojaslatamfxs/pessarocl
Branch:      master (producción)
Deploy:      Vercel auto (pessaro.cl)
Última actualización: 2026-06-24

Contenido:
├─ src/
│   ├─ pages/    (landing, blog, prices)
│   ├─ components/
│   ├─ lib/      (supabase.js, utils)
│   └─ App.jsx
├─ public/
└─ vite.config.js

Cambios recientes:
└─ Footer con disclaimers legales (amber warning + red liability)
```

### 2. pessaro
```
URL:         https://github.com/fcorojaslatamfxs/pessaro
Branch:      master (producción)
Deploy:      Vercel auto (pessarocapital.com)
Última actualización: 2026-06-24

Propósito: Espejo idéntico a pessarocl
Contenido: Mismo que pessarocl
Sincronización: Manual (debe actualizarse junto con pessarocl)
```

### 3. pessaro-crm
```
URL:         https://github.com/fcorojaslatamfxs/pessaro-crm
Branch main: master (producción) → crm.pessaro.cl
Branch alt:  staging (preview) → rama de pruebas

Última actualización: 2026-06-24
Última actualización: git push (feat: import CSV/TXT con revisión duplicados + WhatsApp staff)

Estructura:
├─ src/
│   ├─ components/
│   │   ├─ whatsapp/
│   │   │   ├─ ChatWindow.jsx          (640 líneas — adjuntos super_admin)
│   │   │   ├─ WhatsAppInbox.jsx       (386 líneas — chats + iniciar)
│   │   │   ├─ StartChatModal.jsx      (226 líneas — plantillas)
│   │   │   ├─ CampaignSender.jsx
│   │   │   ├─ TemplatePicker.jsx
│   │   │   └─ ...otros
│   │   └─ ...otros (Emails, Reports, Dashboard, etc.)
│   ├─ lib/
│   │   └─ supabase.js
│   ├─ App.jsx                          (4245 líneas — routing principal)
│   └─ index.css
├─ package.json (React 18, Vite, Tailwind)
└─ vite.config.js
```

### Workflow recomendado

```
1. Feature branch: git checkout -b feat/description
2. Develop + test en staging
3. Push a staging: git push origin feat/description
4. PR + review
5. Merge a master: git merge --no-ff
6. Auto-deploy: Vercel webhook (1-2 min a crm.pessaro.cl)

⚠️ CRÍTICO:
├─ SIEMPRE grabar conflict markers antes de push
│   grep -rnE '^(<{7}|={7}|>{7})' src/
├─ Esbuild check de sintaxis JSX
│   npx esbuild --loader:.jsx=jsx App.jsx
└─ Balance de braces/parens (herramienta Node.js)
```

---

## 🔌 Estado de integraciones externas

### Meta WhatsApp Business

```
Status:              ⏳ PENDIENTE VERIFICACIÓN
Account:            +56 9 2207 1511 (Phone ID: 1243185255538233)
WABA ID:            1910660326284814
Token:              ✅ WA_PERMANENT_TOKEN configurado
API Version:        v22.0

Funcionalidad actual:
├─ ✅ Inbound: recibe mensajes texto + media (imagen, doc, audio)
├─ ✅ Outbound: envía texto + media (imagen, PDF, doc, xlsx)
├─ ✅ Plantillas: soporte (sin aprobadas aún — requiere verificación)
└─ ⏳ Templates APPROVED: vacío (Meta no verifica cuenta)

Bloqueantes:
├─ Account no APPROVED por Meta → sin plantillas → sin ventana 24h
├─ Solución: Enviar docs a Meta, esperar revisión (~1-3 días)
└─ Efectos cuando se apruebe: botón 🚀 "Iniciar chat" pasará a funcional

No se requiere cambio de código — UI ya soporta.
```

### Resend (Email)

```
Status:              ✅ OPERATIVO
Domain:             pessaro.cl
DKIM:               ✅ verificado
SPF:                ✅ verificado
MX:                 ✅ verificado
From:               send@pessaro.cl (verified)
API Key:            ✅ RESEND_API_KEY en Supabase vault

Pendiente:
└─ pessarocapital.com: CNAME + DKIM (workaround: Zone File upload)

Implementación:
├─ Edge function crm_send_email (v19)
├─ HTML templates en DB (cms_email_queue)
└─ Logs: Resend dashboard

Caso de uso:
├─ Confirmación de registro
├─ Reset de password
├─ Notificaciones de leads
└─ Campañas transaccionales
```

### Twelve Data (Market Data)

```
Status:             ✅ OPERATIVO
Plan:               Free (consultas limitadas)
Endpoints:
├─ Forex (EUR/USD, etc.) → Real-time
├─ XAU (oro) → Real-time
└─ Egress whitelist: ✅ permitido

Caché: ~1h en BD (tabla si existe)
Función: market_prices_2026_06_02 (v25)

⚠️ Nota:
└─ Cuota diaria: ~100-200 requests. Si testing pesado, agotarse rápido.
```

### CoinGecko (Crypto prices)

```
Status:             ✅ OPERATIVO
Plan:               Free (sin key)
Egress whitelist:   ✅ permitido
Propósito:          BTC, ETH, ADA precios
Función:            market_prices_2026_06_02 (v25)
```

### Alpaca (Stock/ETF snapshots)

```
Status:             ✅ OPERATIVO
Endpoint:           /v2/stocks/snapshots?symbols=SPY,QQQ,USO
Egress whitelist:   ✅ permitido
Función:            market_prices_2026_06_02 (v25)

Nota: Solo daily bar (dailyBar.c) — no real-time
```

### Mensatek (SMS) — Fase 2, diferida

```
Status:              ⏳ NO INICIADO (diseño documentado en SPEC, sin cuenta ni secret)
Alcance planeado:     OTP por SMS (channel='sms' en support_otp_sessions, columna ya prevista)
                      + avisos SMS de respuesta de ticket
NO reemplaza:         Meta WhatsApp Cloud API sigue siendo el canal WA oficial (+56 9 2207 1511)

Requisitos previos:
├─ Cuenta Mensatek + evaluación de costo por SMS a Chile
├─ Secret MENSATEK_API_KEY en Supabase Vault (⚠️ requiere redeploy de functions tras agregarse)
└─ Registrar como proveedor SMS en push_notifications_2026_02_27 (hoy declara fan-out
   SMS sin proveedor real — hueco documental a cerrar cuando se implemente)

Edge Function planeada: mensatek_send v1 (verify_jwt: true)
```

---

## ✅ Funcionalidad operativa

### 🔐 Autenticación
```
Método:     Supabase Auth (email/password)
Storage:    JWT en localStorage
Roles:      super_admin, admin, asesor
Autorización: RPC get_my_profile() + tools array

Flujo:
1. Login email/password → Supabase Auth
2. get_my_profile() retorna role + tools
3. Frontend oculta/muestra módulos según tools
4. RLS bloquea queries en BD si no auth
5. Edge Functions verifican JWT + role
```

### 📞 Contactos

```
Status:      ✅ TOTALMENTE OPERATIVO
Acciones:
├─ Listar: filtro por usuario + búsqueda por nombre/email/phone
├─ Crear: form modal con validación
├─ Editar: inline editing
├─ Eliminar: con confirmación
├─ Exportar: CSV + Excel + PDF
├─ Importar: CSV/TXT masivo con:
│   ├─ Auto-detección de separador (coma, tab, punto-coma)
│   ├─ Detección de duplicados por email
│   ├─ ✅ Modal de revisión POR CONTACTO (Omitir / Actualizar / Duplicar)
│   ├─ Relleno de campos vacíos solo en existentes (no sobrescribe)
│   └─ Resumen final: X nuevos, Y actualizados, Z omitidos

Columnas:   nombre, correo, teléfono, dirección, notas, estado, origen
Almacén:    crm_contacts (auth.uid() = user_id)

Plantillas descargables:
├─ CSV:  https://crm.pessaro.cl/descargar/plantilla_contactos.csv
└─ TXT:  https://crm.pessaro.cl/descargar/plantilla_contactos.txt
```

### 🚀 Campañas

```
Status:      ✅ TOTALMENTE OPERATIVO
Hub principal: Campaña Q2 2026 (4 variantes)

Variantes (campaign_variants):
├─ Navy       (landing_url: /campana/navy)
├─ Bold       (landing_url: /campana/bold)
├─ Editorial  (landing_url: /campana/editorial)
└─ Minimalist (landing_url: /campana/minimalist)

Asignación de variantes (variant_advisors):
├─ Super admin:   todas las variantes
├─ Alejandra:     todas las variantes
├─ Daniel:        Navy, Bold, Editorial, Minimalist
├─ Iván:          Editorial, Navy, Minimalist, Bold
├─ Juan Pablo:    Minimalist, Navy, Editorial, Bold
├─ Mario:         Bold, Editorial, Navy, Minimalist
└─ Jose Pino:     Bold

Referral codes (actualizado 2026-06-24):
├─ Alejandra Peña:        ALE7P
├─ Daniel Malpartida:     DAN7E38C ✅ NUEVO
├─ Francisco Rojas:       FRAG71D8
├─ Iván Serrano:          IVAP29HW ✅ NUEVO
├─ Jose Pino:             JOS5E6E1
├─ Juan Pablo Alberio:    JUAY4RZ4 ✅ NUEVO
├─ Mario Fatigante:       MARQJUYC ✅ NUEVO
└─ Super Administrador:   SUPTCXRB ✅ NUEVO

Funcionalidad:
├─ Ver landing (siempre visible)
├─ Copiar mi link (visible si tiene referral_code) ✅
├─ Ver mis links de referido (sección con todos códigos + copiar)
└─ Gestión de asesores (super_admin: toggle/agregar/remover)

URLs de referencia:
├─ https://pessaro.cl/campana/navy?ref=ALE7P
├─ https://pessaro.cl/campana/bold?ref=DAN7E38C
└─ ... etc

Tracking:
└─ campaign_leads registra conversiones (phone, email, source, status)
```

### 💬 WhatsApp

```
Status:      ✅ OPERATIVO (adjuntos, texto, asignación)
             ⏳ Start_chat UI listo (espera plantillas Meta)

Chats activos:
├─ Ver histórico de conversaciones
├─ Filtros: todas / sin asignar (super_admin) / mis (asesores)
├─ Búsqueda por nombre/teléfono
└─ Contador de no leídos

Capacidades por rol:

  Super Admin:
  ├─ 📎 Botón adjuntos (imagen, PDF, DOCX, XLSX)
  ├─ Enviar texto libremente
  ├─ Asignar chat a otro asesor
  ├─ Ver todos los chats
  └─ Gestión de plantillas

  Admin (Alejandra):
  ├─ Enviar texto a chats asignados
  └─ Ver chats asignados (RLS)

  Asesores (Daniel, Iván, JP, Mario, Jose):
  ├─ Ver chats asignados a ellos
  ├─ Ver sus contactos personales sin chat (nuevo 2026-06-24)
  ├─ Enviar texto a sus asignaciones
  ├─ 🚀 Botón "Iniciar chat" con plantilla aprobada (funcional cuando Meta apruebe)
  └─ ❌ NO pueden asignar ni ver adjuntos (super_admin only)

Almacenamiento de media:
├─ Inbound (cliente → nosotros): Storage/inbound/YYYY/MM/{uuid}.ext
├─ Outbound (nosotros → cliente): Storage/{YYYY}/{MM}/{uuid}.ext
└─ RLS: is_crm_staff() para acceso

Mensajes:
├─ Tipo: texto, imagen, documento, audio, video, location
├─ Status: sent, delivered, read, failed
├─ Media metadata: size, mime, name (para PDF, DOC, etc.)
└─ Error tracking: error_code, error_message (ej: 131047 = re-engagement)

Limitaciones conocidas (Meta Cloud API):
├─ Mensajes libres: solo dentro de 24h de último mensaje del cliente
├─ Fuera de 24h: solo plantillas aprobadas
├─ Error 131047: "Re-engagement message" (cliente sin responder >24h)
```

### 📧 Emails

```
Status:      ✅ OPERATIVO
Proveedor:   Resend (resend.com)
From:        send@pessaro.cl (verificado)
Templates:   Almacenadas en BD (cms_email_queue)

Casos de uso:
├─ Confirmación de registro
├─ Reset de password (edge function password_recovery_2026_06_18)
├─ Notificaciones de leads (campaign_leads)
├─ Confirmación de cita (via calendar/Calendly)
└─ Newsletters (manual vía admin)

Edge function: crm_send_email (v19)
├─ Parámetro: to, template_name, variables (objeto)
├─ Retorna: { success, message_id, error }
└─ Logs: cms_email_queue

Plantillas disponibles:
├─ INVITACION_TRADEVIEW
├─ BIENVENIDA_LEAD
├─ PERSONALIZAD O (flexible)
└─ ... más según necesidad

⚠️ Pendiente:
└─ Resend DKIM para pessarocapital.com (actualmente solo pessaro.cl)
```

### 📊 Reportes

```
Status:      ✅ OPERATIVO
Dashboard:
├─ KPIs: leads, conversiones, revenue
├─ Gráficos: línea, barras, donut
├─ Filtros: fecha, campaña, asesor, estado
└─ Exportación: CSV, PDF, Excel

Datos fuente:
├─ campaign_leads (leads + status)
├─ whatsapp_messages (volumen, engagement)
├─ crm_contacts (segmentación)
└─ variant_advisors (rendimiento por asesor)

Tipos de reporte:
├─ Conversiones por variante
├─ Actividad WhatsApp
├─ Performance de asesores
└─ Crecimiento de contactos
```

### 👥 Equipo

```
Status:      ✅ OPERATIVO
Gestión:
├─ Ver staff activo
├─ Editar perfiles (super_admin)
├─ Asignar roles (super_admin)
├─ Cambiar permisos por módulo (super_admin via team_tools)
└─ Ver calendario Calendly integrado

Staff actual:
├─ Francisco Rojas-Aranda (super_admin)
├─ Alejandra Peña Ortega (admin/asesor)
├─ Daniel Malpartida (asesor)
├─ Iván Serrano (asesor)
├─ Juan Pablo Alberio (asesor)
├─ Mario Fatigante (asesor)
└─ Jose Pino (asesor)

Roles:
├─ super_admin: control total
├─ admin: moderation + reportes (Alejandra)
└─ asesor: acceso a su asignaciones (Daniel, Iván, JP, Mario, Jose)
```

### 🎫 Soporte (Tickets OTP)

```
Status:      ✅ OPERATIVO (Fase 1 — desplegado 2026-07-21)
Portal público: crm.pessaro.cl/soporte

Flujo cliente:
1. Form (nombre, email, teléfono opcional, categoría, asunto, mensaje)
2. Verificación OTP por email (Resend, código 6 dígitos, TTL 10 min, rate limit 3/10min)
3. Ticket creado (PSR-#####), asignado automáticamente:
   ├─ Si el email matchea un crm_contacts con asesor → hereda asesor/equipo
   └─ Si no → asignado a super_admin (patrón whatsapp-webhook)
4. Hilo en /soporte/ticket/:ticketNumber (requiere re-OTP si expiró session_token, TTL 24h)

Inbox de staff (módulo "Soporte" en sidebar CRM):
├─ Filtros: Abiertos / En proceso / Cerrados / Míos
├─ Respuesta inline + cambio de estado
├─ Asignación de asesor (solo super_admin)
└─ RLS: asesor ve/responde solo tickets asignados a él; SA ve todos

Edge Functions: support_otp (v2), support_tickets (v1), support_notify (v1)
Tablas: support_tickets, support_ticket_messages, support_otp_sessions

⏳ Pendiente:
├─ Bucket support-attachments (adjuntos aún no implementados en frontend/edge functions)
└─ Fase 2: OTP y avisos por SMS vía Mensatek (ver §Mejoras pendientes)
```

---

## 📈 Mejoras pendientes

### 🔴 Críticas (bloquean flujo)

1. **Meta WhatsApp Business Verification**
   - Acción: Enviar docs a Meta Business Manager
   - Efecto: Habilita plantillas aprobadas + botón 🚀 "Iniciar chat" en CRM
   - ETA: 1-3 días (Meta)
   - No requiere código

2. **Resend DKIM para pessarocapital.com**
   - Acción: Agregar CNAME o usar Zone File upload
   - Efecto: Emails desde pessarocapital.com
   - ETA: inmediato
   - No requiere código

3. **WAFinance — Chat en vivo integrado al CRM** 🆕
   - Nombre: WAFinance por Pessaro Capital
   - Icono: Logo Pessaro encerrado en smartphone
   - Propósito: Chat en vivo sin depender de Meta, cada asesor comparte su link único
   - Ruta pública: `crm.pessaro.cl/chat/:referralCode`
   - **🆕 Botón "Invitar por WhatsApp" en CRM**: abre wa.me con mensaje personalizado + link del chat
   - Stack: Supabase Realtime + React (PWA) + Push Notifications + OTP email verification
   - Tablas nuevas: `live_chat_sessions`, `live_chat_messages`, `live_chat_otp`
   - Edge Function nueva: `wafinance_otp` (genera/verifica OTP, crea sesión + lead)
   - Esfuerzo estimado: ~15-19 horas (incluye botón WhatsApp)
   - Implementación: Claude Code + Claude Design
   - Ver sección [WAFinance](#wafinance) para arquitectura completa

### 🟡 Importantes (mejoran UX)

1. **Banner "Ventana 24h" en WhatsApp**
   - Mostrar aviso cuando han pasado >24h sin respuesta del cliente
   - Bloquear botón "Enviar adjunto" si está fuera de ventana
   - Componente: ChatWindow.jsx
   - Esfuerzo: 1-2 horas

2. **Webhook v13 — Media inbound visible en chat**
   - ✅ YA HECHO (webhook v13 deploy 2026-06-24)
   - Imágenes del cliente se renderizan correctamente
   - PDF muestra como tarjeta

3. **Integración con Calendly en Equipo**
   - Mostrar disponibilidad de asesores
   - Enlace directo a booking
   - Esfuerzo: 4-6 horas

4. **Fase 2 Mensatek SMS** 🆕
   - OTP + avisos de tickets de soporte por SMS (`support_otp_sessions.channel = 'sms'`)
   - Requiere: cuenta Mensatek, `MENSATEK_API_KEY` en Vault, Edge Function `mensatek_send`
   - NO reemplaza WhatsApp (Meta Cloud API sigue siendo el canal oficial)
   - Esfuerzo: ver SPEC_SOPORTE_TICKETS_OTP_2026_07_19.md §6

### 🟢 Nice-to-have (enhancements)

1. **Análisis con IA en Portal Clientes**
   - Recomendaciones automáticas basadas en actividad
   - Predicción de churn
   - Edge function: portal_ai_analysis_2026_03_13 (v13)
   - Esfuerzo: 3-4 horas

2. **Reportes automatizados por email**
   - Envío diario/semanal de KPIs a super_admin
   - Scheduled via Supabase cron (si disponible)
   - Esfuerzo: 2-3 horas

3. **Blog en pessarocapital.com**
   - Replicar posts desde pessaro.cl (mismo Supabase)
   - Sincronización automática
   - Esfuerzo: 1-2 horas

4. **Notificaciones push (desktop/mobile)**
   - Cuando llega mensaje WhatsApp
   - Cuando se crea nuevo lead
   - Edge function: push_notifications_2026_02_27 (ya existe, v22)
   - Esfuerzo: 2-3 horas refine

5. **Búsqueda avanzada con filtros complejos**
   - Contactos: por rango de fecha, múltiples fuentes, etc.
   - Leads: por variante, estado, asignación
   - Esfuerzo: 3-4 horas

### ⚪ Backlog (investigación)

1. **Integración con Zapier/Make**
   - Automatizar flujos entre CRM + herramientas externas
   - Sincronización con Google Sheets
   - Esfuerzo: 5-8 horas

2. **Dark mode**
   - Toggle en settings
   - Esfuerzo: 2-3 horas

3. **Soporte multiidioma**
   - EN, ES (ya tiene), PT
   - i18next o similar
   - Esfuerzo: 4-6 horas

---

## 🚨 Instrucciones críticas

### ✋ ANTES de cualquier cambio en BD

```bash
# 1. Verificar que no hay migrations conflictivas
SELECT * FROM public.schema_version
WHERE version = (SELECT MAX(version) FROM public.schema_version);

# 2. Backup de datos críticos (si aplica)
# 3. Test en staging branch de Vercel (si frontend)
# 4. Ejecutar migration en Supabase
# 5. Re-deploy del frontend si toca código
```

### 📝 Antes de cualquier git push

```bash
# 1. Verificar conflict markers
grep -rnE '^(<{7}|={7}|>{7})' src/

# 2. Validar sintaxis JSX
npx esbuild --loader:.jsx=jsx --bundle=false src/App.jsx --outfile=/tmp/out.js

# 3. Verificar balance de braces/parens
node -e "const c=require('fs').readFileSync('src/App.jsx','utf8');const x={'{':0,'}':0,'(':0,')':0};for(const ch of c)if(ch in x)x[ch]++;console.log('Balance:',x);"

# 4. Commit + push
git add .
git commit -m "feat/fix: descripción clara"
git push origin [branch-name]
```

### 🔄 Workflow de cambios

```
1. DESARROLLO
   ├─ Crear rama: git checkout -b feat/descripcion
   ├─ Editar código/BD
   ├─ Test local (si hay testing setup)
   └─ Grabar estado actual

2. VALIDACIÓN
   ├─ Conflict markers check
   ├─ Sintaxis JSX check
   ├─ Balance braces check
   └─ Si hay cambios BD: grabar migration SQL

3. PUSH
   ├─ git add src/... (SOLO archivos necesarios)
   ├─ git commit -m "tipo: descripción (archivo.jsx)"
   └─ git push origin feat/descripcion

4. REVIEW (si PR)
   ├─ Esperar feedback
   └─ Merge a master (NO squash — mantener historial)

5. DEPLOY
   ├─ Vercel detecta push a master
   ├─ Build + deploy automático (1-2 min)
   └─ Verificar en https://crm.pessaro.cl
```

### ⚡ Emergencia: Rollback

```
Si deploy roto:

1. Revert commit (git revert)
   git revert HEAD --no-edit
   git push origin master

2. O reset a commit anterior (si es culpa del último)
   git reset --hard [commit-sha-anterior]
   git push origin master -f  (fuerza, con cuidado)

3. Vercel re-deploy automático
```

### 🔐 Secrets management

```
Supabase Vault (en Settings → Vault):
├─ RESEND_API_KEY         (Resend)
├─ RESEND_FROM_PESSARO    (Resend domain)
├─ INTERNAL_EMAIL_PESSARO (notificaciones internas)
├─ WA_PERMANENT_TOKEN     (Meta)
├─ WA_VERIFY_TOKEN        (Meta webhook)
└─ ... otros

Vercel Env Vars (en Project → Settings → Environment Variables):
├─ VITE_SUPABASE_URL      (público)
├─ VITE_SUPABASE_ANON_KEY (público)
└─ ... otros
```

### 📞 Contacto rápido en emergencia

```
Responsable principal:  Francisco Rojas-Aranda
Email:                 fcorojas.fx@gmail.com
Teléfono:              +56 9 2207 1511
Rol:                   Super Admin, Full Stack
Responsabilidades:     Git, Vercel, Supabase, comunicación con Meta/Resend
```

---

## 📇 Contactos del equipo

| Nombre | Rol | Email | Teléfono | Referral Code |
|---|---|---|---|---|
| Francisco Rojas-Aranda | Super Admin | francisco@pessaro.cl | +56 9 ... | FRAG71D8 |
| Alejandra Peña Ortega | Admin/Asesor | alejandra.pena.o@gmail.com | ... | ALE7P |
| Daniel Malpartida | Asesor | ... | ... | DAN7E38C |
| Iván Serrano | Asesor | ... | ... | IVAP29HW |
| Jose Pino | Asesor | jpino71@gmail.com | ... | JOS5E6E1 |
| Juan Pablo Alberio | Asesor | ... | ... | JUAY4RZ4 |
| Mario Fatigante | Asesor | ... | ... | MARQJUYC |

---

## 📚 Referencias externas

### Documentación oficial
- **Supabase**: https://supabase.com/docs
- **Vercel**: https://vercel.com/docs
- **Meta WhatsApp Cloud API**: https://developers.facebook.com/docs/whatsapp/cloud-api
- **Resend**: https://resend.com/docs
- **React 18**: https://react.dev
- **Vite**: https://vitejs.dev

### Herramientas internas
- **CRM**: https://crm.pessaro.cl
- **Blog Pessaro.cl**: https://pessaro.cl/blog
- **Meta Business Manager**: https://business.facebook.com
- **Supabase Console**: https://app.supabase.com/project/ldlflxujrjihiybrcree

---

---

## 🏗️ Estrategia de arquitectura: Híbrido Supabase + LLM (vs Rocket.Chat / MoneyChat)

### ¿Por qué NO replicamos Rocket.Chat?

Rocket.Chat es una plataforma empresarial robusta con arquitectura de microservicios, compliance GDPR/HIPAA/FINRA y marketplace de 180+ integraciones, pero:
- **Overhead innecesario**: +180KB bundle, MongoDB + Redis vs tu Supabase
- **Overkill**: canales, threads, call center, video conferencing → features que WAFinance no necesita
- **Stack incompatible**: Meteor + TypeScript vs tu React + Supabase

**Conclusión:** Para chat 1-a-1 simple, Rocket.Chat es 10x más complejo de lo requerido.

---

### ¿Por qué NO usamos MoneyChat?

MoneyChat es un chatbot LLM (GPT-4) para gestionar dinero: conecta APIs bancarias (Chase, BoA), analiza transacciones, genera budgets automáticos, pero:
- **No es chat en vivo real-time**: es chatbot conversacional, no mensajería sincrónica
- **Stack Python**: incompatible con tu Supabase/React
- **Standalone**: no integrado a CRM, sin RLS, sin roles/permisos
- **Enfoque personal finance**: no asesoría profesional

**Conclusión:** MoneyChat enseña **conceptos de contexto IA** que sí usaremos (LLM + datos financieros), pero no la base técnica.

---

### ✅ Enfoque elegido: Híbrido Supabase + LLM

**Lo mejor de ambos mundos:**

| Aspecto | Rocket.Chat | MoneyChat | **WAFinance (elegido)** |
|---------|-------------|-----------|------------------------|
| Realtime | ✅ Websocket | ❌ HTTP polling | ✅ Supabase Realtime |
| LLM Context | ❌ No | ✅ GPT-4 | ✅ Claude API |
| Chat 1-a-1 | ✅ (+ overkill) | ❌ | ✅ Minimalista |
| RLS / Roles | ✅ 180+ permisos | ❌ | ✅ Postgres RLS |
| Stack compatible | ❌ Meteor | ❌ Python | ✅ Supabase/React |
| Banco integrado | ❌ | ✅ Chase/BoA | ✅ Plaid (Fase 2) |
| Costo operacional | 💰💰💰 | 💰 LLM | 💰 Supabase + Claude |

---

## 📱 WAFinance — Chat en vivo (próxima implementación)

### Concepto
**WAFinance por Pessaro Capital** es un sistema de chat en vivo integrado al CRM que permite a cada asesor compartir un link único para comunicarse con sus contactos en tiempo real, sin depender de la aprobación de Meta para WhatsApp Business.

### Identidad visual
```
Nombre:    WAFinance por Pessaro Capital
Icono:     Logo Pessaro encerrado en silueta de smartphone
Paleta:    Hereda colores del CRM (#0a1628 navy, #6c5ce7 purple, #f0a500 gold)
Tipografía: Inter (misma del CRM)
Dominio:   crm.pessaro.cl/chat/:referralCode
```

### Arquitectura con verificación OTP + LLM Asesor
```
Visitante abre crm.pessaro.cl/chat/ALE7P
                ↓
Formulario: Nombre + Email + Teléfono móvil (los 3 obligatorios)
                ↓
Click "Verificar" → Edge Function genera OTP 6 dígitos
                ↓
Resend envía código al email (plantilla WAFinance branded)
                ↓
Visitante ingresa código → verificación <5 min (expira)
                ↓
✅ Verificado:
├─ Se crea live_chat_session
├─ Se inserta lead en campaign_leads (advisor_referral_code = código del asesor)
├─ Capa IA (nuevo): Edge Function wafinance_advisor
│  ├─ Captura contexto: perfil inversión, capital, tolerancia riesgo
│  ├─ Cada mensaje → Claude API con contexto del lead
│  └─ Asesor ve sugerencias IA + recomendaciones
└─ Chat en vivo activo via Supabase Realtime
                ↓
Asesor recibe push notification → responde desde el CRM
                ↓
Opcional (Fase 2): Lead conecta su banco (Plaid) → análisis automático
```

### Tablas requeridas
```sql
live_chat_sessions:
├─ id (UUID PK)
├─ visitor_name (TEXT NOT NULL)
├─ visitor_email (TEXT NOT NULL, verificado por OTP)
├─ visitor_phone (TEXT NOT NULL)
├─ advisor_code (TEXT NOT NULL)       -- ALE7P, DAN7E38C, etc.
├─ advisor_staff_id (UUID FK crm_staff_profiles)
├─ status (TEXT: active, closed, archived)
├─ created_at (TIMESTAMPTZ)
└─ last_message_at (TIMESTAMPTZ)

live_chat_messages:
├─ id (UUID PK)
├─ session_id (UUID FK live_chat_sessions)
├─ direction (TEXT: inbound, outbound)
├─ content (TEXT NOT NULL)
├─ sender_name (TEXT)
├─ read_at (TIMESTAMPTZ)
└─ created_at (TIMESTAMPTZ)

live_chat_otp:
├─ id (UUID PK)
├─ email (TEXT NOT NULL)
├─ code (TEXT NOT NULL, 6 dígitos)
├─ phone (TEXT NOT NULL)
├─ visitor_name (TEXT NOT NULL)
├─ advisor_code (TEXT NOT NULL)
├─ verified (BOOLEAN DEFAULT false)
├─ attempts (INT DEFAULT 0, max 3)
├─ expires_at (TIMESTAMPTZ, created_at + 5 min)
└─ created_at (TIMESTAMPTZ DEFAULT now())

lead_advisor_context: (NUEVO — para LLM asesor)
├─ id (UUID PK)
├─ session_id (UUID FK live_chat_sessions)
├─ investment_profile (TEXT: conservador, moderado, agresivo)
├─ investment_capital (INT)
├─ risk_tolerance (TEXT)
├─ previous_portfolio (JSONB)
├─ advisor_notes (TEXT)
├─ updated_at (TIMESTAMPTZ)
└─ created_at (TIMESTAMPTZ)

RLS:
├─ Sessions: asesor ve solo sus sesiones (advisor_staff_id), SA ve todas
├─ Messages: acceso via session_id → hereda permisos de la sesión
├─ OTP: INSERT anon (visitante crea), SELECT/UPDATE via Edge Function (service_role)
├─ Advisor Context: asesor ve solo su contexto, SA ve todas
└─ INSERT público (anon): visitante puede insertar mensajes inbound post-verificación
```

### Edge Functions requeridas
```
wafinance_otp (nueva, verify_jwt: false):
├─ Action: generate
│   ├─ Recibe: name, email, phone, advisor_code
│   ├─ Valida: advisor_code existe en crm_staff_profiles
│   ├─ Rate limit: max 3 OTP por email por hora
│   ├─ Genera: código 6 dígitos (crypto random)
│   ├─ Guarda: en live_chat_otp (expira en 5 min)
│   ├─ Envía: email via Resend con plantilla branded
│   └─ Retorna: { otp_id }
│
└─ Action: verify
    ├─ Recibe: otp_id, code
    ├─ Valida: código correcto, no expirado, <3 intentos
    ├─ Si OK:
    │   ├─ Marca OTP como verified
    │   ├─ Crea live_chat_session
    │   ├─ Inserta lead en campaign_leads (advisor_referral_code = advisor_code)
    │   ├─ Crea lead_advisor_context (vacío, asesor completa después)
    │   ├─ Dispara push notification al asesor
    │   └─ Retorna: { session_id, verified: true }
    └─ Si falla: incrementa intentos, retorna error

wafinance_advisor (NUEVA, verify_jwt: true): LLM Context para asesor
├─ Proveedor: Anthropic Claude API (o OpenAI GPT-4)
├─ Recibe: session_id, user_message, action=suggest_response
├─ Proceso:
│   ├─ Fetch lead_advisor_context (perfil, capital, tolerancia riesgo)
│   ├─ Fetch últimos 5 mensajes (contexto de conversación)
│   ├─ Llamar Claude con system prompt contextualizado:
│   │   "Eres asesor de Pessaro Capital para lead con perfil [X],
│   │    capital $[Y], tolerancia riesgo [Z]. El lead acaba de decir: [msg]
│   │    Proporciona respuesta profesional + 2 recomendaciones de portafolio"
│   └─ Retorna: { suggested_response, recommendations: [...] }
├─ Costo: ~$0.02-0.05 por sugerencia (Claude Opus)
└─ Usado por: Asesor en CRM, botón "💡 Generar respuesta IA"
```

### Componentes a implementar
```
1. Página pública:              crm.pessaro.cl/chat/:referralCode (formulario + OTP + chat)
2. Edge Function OTP:           wafinance_otp (genera/verifica OTP, crea sesión + lead)
3. Edge Function LLM Asesor:    wafinance_advisor (Claude API context) 🆕
4. Vista CRM:                   Nueva pestaña "Chat en vivo" con botón "💡 Asesoría IA"
5. Realtime:                    Supabase Realtime subscriptions (ya existe infraestructura)
6. Push notifications:          Reutiliza push_notifications_2026_02_27 v22
7. Email template OTP:          Plantilla branded para código de verificación
8. Botón invitación WA:         Modal en CRM con link único crm.pessaro.cl/chat/:referralCode

FASE 2 (Opcional):
9. Integración bancaria:        Plaid API para conexión de cuentas + análisis automático
```

### Infraestructura reutilizable
```
✅ Supabase Realtime         → suscripciones en tiempo real (ya en WhatsApp)
✅ Push notifications v22    → alertas al asesor
✅ Referral codes            → link único por asesor (ALE7P, DAN7E38C, etc.)
✅ Resend (send@pessaro.cl)  → envío de OTP verificado
✅ PWA                       → notificaciones desktop y mobile
✅ Dominio crm.pessaro.cl    → ruta /chat/:code
✅ Paleta y componentes CRM  → GlassCard, Btn, Badge, etc.
✅ campaign_leads            → auto-inserción de lead verificado
🆕 Claude API (o GPT-4)      → LLM para asesoría contextualizada + sugerencias IA
```

### Herramientas de implementación
```
Claude Design  → UX/UI del widget público + icono WAFinance
Claude Code    → Implementación técnica (tablas, Edge Functions, componentes)
Staging first  → Validar en staging antes de merge a master
```

### Esfuerzo estimado
```
FASE 1 (Chat en vivo + LLM Asesor):
Tablas + RLS + Realtime:              2-3h
Edge Function OTP + template email:   3-4h
Página pública /chat/:code + OTP UI:  4-5h
Vista CRM (inbox del asesor):         4-5h
Push notifications al asesor:         1-2h
Botón "Invitar por WhatsApp" en CRM:  1-2h
Edge Function wafinance_advisor (IA): 2-3h
Total FASE 1:                         ~17-24h

FASE 2 (MetaTrader 4/5 - Trading Integration):
Edge Function MT4/MT5 connector:       5-6h (REST API to MT4/MT5 bridge)
Live trading data sync:                3-4h (account balance, positions, profit/loss realtime)
Dashboard trading analytics:           4-5h (equity curve, performance metrics, drawdown tracking)
Risk management advisories:            3-4h (IA alerts: "drawdown 15%, consider closing position X")
Account linking + auth:                2-3h (secure OAuth para MT4/MT5)
Total FASE 2:                          ~17-22h
```

### FASE 2: Integración MetaTrader 4/5 (Trading Integration)

**Objetivo:** Conectar las cuentas de trading MT4/MT5 de los clientes → datos en vivo en el chat con WAFinance → asesor puede ver equity, posiciones, P&L en tiempo real durante la conversación.

#### Arquitectura MT4/MT5

```
Cliente abre cuenta MT4/MT5 (ej: IC Markets, Deriv, OANDA)
                ↓
WAFinance pide conectar su broker (OAuth-style con credenciales)
                ↓
Edge Function mt4_connector:
├─ Valida credenciales (email MT4 + password)
├─ Conecta a MetaQuotes API o broker REST API
├─ Guarda token en Supabase (encriptado)
├─ Sync inicial: descarga histórico de posiciones + estadísticas
└─ Webhook: MetaTrader → Supabase Realtime (cada tick de mercado)
                ↓
Dashboard en WAFinance:
├─ Equity curve (gráfico de balance histórico)
├─ Posiciones abiertas en vivo (symbol, size, entry, current P&L)
├─ Estadísticas: total profit, win rate, max drawdown, risk per trade
└─ Alertas IA: "riesgo alto detected", "drawdown 20%", "considerar cierre"
                ↓
Chat contexto: "Tu EURUSD está +250 pips, ganancias de hoy $2,400"
Asesor responde con Claude: "Excelente. Próximo target $2,800, stop loss ajustado a breakeven"
```

#### Tablas requeridas (FASE 2)

```sql
mt4_accounts:
├─ id (UUID PK)
├─ session_id (UUID FK live_chat_sessions)
├─ broker_name (TEXT: IC Markets, Deriv, OANDA, etc.)
├─ mt4_login (INT - número de cuenta MT4)
├─ account_email (TEXT)
├─ token (TEXT ENCRYPTED - credencial de API)
├─ token_expires_at (TIMESTAMPTZ)
├─ verified_at (TIMESTAMPTZ)
├─ synced_at (TIMESTAMPTZ)
└─ created_at (TIMESTAMPTZ)

mt4_positions:
├─ id (UUID PK)
├─ account_id (UUID FK mt4_accounts)
├─ ticket (INT - MT4 position ID)
├─ symbol (TEXT: EURUSD, GOLD, etc.)
├─ position_type (TEXT: BUY, SELL)
├─ volume (DECIMAL)
├─ entry_price (DECIMAL)
├─ current_price (DECIMAL)
├─ current_pnl (DECIMAL)
├─ pnl_percent (DECIMAL)
├─ opened_at (TIMESTAMPTZ)
├─ closed_at (TIMESTAMPTZ)
└─ updated_at (TIMESTAMPTZ)

mt4_account_stats:
├─ id (UUID PK)
├─ account_id (UUID FK mt4_accounts)
├─ balance (DECIMAL)
├─ equity (DECIMAL)
├─ margin_used (DECIMAL)
├─ margin_free (DECIMAL)
├─ margin_level (DECIMAL)
├─ total_profit (DECIMAL)
├─ today_profit (DECIMAL)
├─ win_rate (DECIMAL, %)
├─ max_drawdown (DECIMAL)
├─ max_drawdown_pct (DECIMAL)
├─ total_trades (INT)
├─ winning_trades (INT)
├─ losing_trades (INT)
├─ updated_at (TIMESTAMPTZ)
└─ created_at (TIMESTAMPTZ)

RLS:
├─ mt4_accounts: solo el asesor y SA ven la cuenta del cliente
├─ mt4_positions: acceso via account_id + session_id
├─ mt4_account_stats: mismos permisos que positions
```

#### Edge Functions (FASE 2)

```
mt4_connector (NEW, verify_jwt: true):
├─ Action: link_account
│   ├─ Recibe: session_id, broker_name, mt4_login, account_email, password
│   ├─ Valida credenciales en el broker (o API oficial)
│   ├─ Si OK:
│   │   ├─ Guarda credenciales encriptadas en mt4_accounts
│   │   ├─ Sync inicial de histórico (últimas 100 posiciones cerradas)
│   │   ├─ Descarga stats actuales (balance, equity, drawdown, etc.)
│   │   ├─ Crea webhook en el broker para sync realtime
│   │   └─ Retorna: { account_id, verified: true, balance: $X }
│   └─ Si error: { verified: false, reason: "invalid credentials" }
│
├─ Action: get_account_summary
│   ├─ Recibe: session_id
│   ├─ Fetch mt4_account_stats + mt4_positions abiertas
│   └─ Retorna: { balance, equity, positions: [...], win_rate, drawdown }
│
└─ Action: get_position_details
    ├─ Recibe: position_id
    ├─ Fetch detalles completos + histórico de precios
    └─ Retorna: { entry_price, current_price, pnl, risk_reward_ratio, ...}

mt4_realtime_sync (webhook handler, verify_jwt: false):
├─ Recibe POST desde broker webhook (MT4 price tick, position change, etc.)
├─ Actualiza mt4_positions y mt4_account_stats
├─ Dispara push notification al asesor: "Position EURUSD now +300 pips"
└─ Emite evento Realtime → chat refrescar datos en vivo

mt4_risk_advisor (NEW, verify_jwt: true):
├─ Action: analyze_risk
│   ├─ Recibe: session_id
│   ├─ Fetch todas las posiciones abiertas + histórico
│   ├─ Llama Claude con contexto:
│   │   "Analiza estas posiciones de forex.
│   │    EURUSD +200 pips, GBPUSD -150 pips, XAUUSD flat
│   │    Drawdown actual 12%, max histórico 25%
│   │    Risk: ¿qué recomendaciones de gestión de riesgo?"
│   ├─ Claude responde con recomendaciones
│   └─ Retorna: { recommendations: [...], risk_level: "medium" }
│
└─ Action: alert_if_critical
    ├─ Si drawdown > 20%: "⚠️ DRAWDOWN CRÍTICO 22%, considera revisar tu estrategia"
    ├─ Si margin_level < 150%: "⚠️ MARGEN BAJO, riesgo de margin call"
    └─ Emite push notification + alert en chat
```

#### Componentes CRM (FASE 2)

```
1. Modal "Conectar MT4/MT5": formulario broker + credenciales
2. Dashboard trading: equity curve, positions table, stats cards
3. Tab "Trading Analytics" en Chat: 
   ├─ Resumen de cuenta actual
   ├─ Posiciones abiertas con P&L en vivo
   ├─ Historial de últimas 20 posiciones cerradas
   └─ Recomendaciones IA de riesgo
4. Alerts en tiempo real: posición abierta, drawdown, margin level
5. Chatbot contexto: Claude puede referirse a "tu EURUSD está en ganancia de $xxx"
```

#### Integraciones soportadas (FASE 2)

```
Brokers con APIs disponibles:
├─ ✅ IC Markets (MT4/MT5 REST API)
├─ ✅ Deriv (MT5 WebSocket API)
├─ ✅ OANDA (REST API)
├─ ✅ Exness (MT4/MT5)
├─ ✅ XM Global (MT4/MT5)
└─ Otros brokers vía MetaQuotes cloud (si disponible)

Nota: Cada broker requiere wrapper API diferente. 
Esfuerzo estimado: +2-3h por nuevo broker después del primero.
```

---

## 📄 Versión y cambios

| Fecha | Versión | Cambios |
|---|---|---|
| 2026-02-25 | 1.0 | Documentación inicial |
| 2026-03-15 | 1.1 | Agregados edge functions, tabla crm_notes |
| 2026-04-26 | 1.2 | Inbox manager, staff management |
| 2026-06-18 | 1.3 | Password recovery, WhatsApp webhook v12 |
| 2026-06-24 | 1.4 | Webhook v13 (media inbound), CSV/TXT con duplicados, start_chat, referral codes auto-gen |
| 2026-06-24 | 1.5 | ✅ Aislamiento datos por rol (email_tracking.sent_by, RLS contact_submissions, filtro leads en render), crm_send_email v19, campañas con links referido en tarjeta, Dashboard/Pipeline/Reports aislados. 🆕 Documentación WAFinance con OTP + botón "Invitar por WhatsApp" en CRM |
| 2026-07-21 | **1.6 (ACTUAL)** | 🆕 Módulo Soporte (Tickets OTP): tablas support_tickets/support_ticket_messages/support_otp_sessions, RLS aislada por asesor asignado, Edge Functions support_otp/support_tickets/support_notify, portal público /soporte + inbox staff. Bucket support-attachments y Fase 2 Mensatek SMS quedan pendientes. |

---

**Documento generado:** 2026-06-24  
**Próxima revisión recomendada:** 2026-07-24 (1 mes)  
**Mantenedor:** Francisco Rojas-Aranda (fcorojas.fx@gmail.com)

> ⚠️ Este documento es la **guía definitiva** del proyecto. Mantenerlo actualizado es **crítico** para onboarding de nuevos dev y troubleshooting futuro.
