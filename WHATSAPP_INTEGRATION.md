# WhatsApp Cloud API — Integración Pessaro CRM

> **Stack:** Supabase Edge Functions (Deno/TS) + React + Supabase PostgreSQL + Realtime
> **Proyecto Supabase:** `ldlflxujrjihiybrcree`
> **CRM repo:** `pessaro-crm` → `crr.pessaro.cl`
> **Edge Functions existentes:** `unified_forms_complete_2026_02_25_20_30` (v37)

---

## 1. Arquitectura

```
┌─────────────┐     ┌───────────────────────┐     ┌──────────────┐
│  React CRM  │────▶│  Supabase Edge Funcs  │────▶│  Meta Graph  │
│  crr.pessaro│◀────│  (send / webhook)     │◀────│  API v21.0   │
│  .cl        │     │                       │     │              │
└──────┬──────┘     └───────────┬───────────┘     └──────────────┘
       │                        │
       │   Realtime subscribe   │
       ◀────────────────────────┘
              whatsapp_messages (INSERT)
```

- **Frontend (React):** Bandeja de entrada, envío de mensajes, campañas masivas, plantillas
- **Edge Functions:** Firman peticiones salientes, procesan webhooks entrantes, nunca exponen tokens al cliente
- **PostgreSQL + Realtime:** Historial persistente de mensajes, actualizaciones en vivo al CRM

---

## 2. Requisitos previos en Meta

1. Crear app en [developers.facebook.com](https://developers.facebook.com)
2. Agregar producto "WhatsApp" a la app
3. Obtener:
   - `PHONE_NUMBER_ID` — ID del número de teléfono registrado
   - `WABA_ID` — WhatsApp Business Account ID
   - `PERMANENT_TOKEN` — Token de acceso permanente (System User → Generate Token)
4. Crear un `VERIFY_TOKEN` propio (string secreto inventado, ej: `PessaroWA2026SecretHook`)
5. Configurar Webhook URL: `https://ldlflxujrjihiybrcree.supabase.co/functions/v1/whatsapp-webhook`
6. Suscribir campos: `messages`, `message_deliveries`, `message_reads`

---

## 3. Secrets en Supabase

Agregar via CLI o Dashboard → Settings → Vault:

```bash
supabase secrets set WA_PHONE_NUMBER_ID="TU_PHONE_NUMBER_ID"
supabase secrets set WA_WABA_ID="TU_WABA_ID"
supabase secrets set WA_PERMANENT_TOKEN="TU_TOKEN_PERMANENTE"
supabase secrets set WA_VERIFY_TOKEN="PessaroWA2026SecretHook"
```

**IMPORTANTE:** Después de agregar secrets, hay que hacer **redeploy** de las edge functions para que `Deno.env.get()` los detecte.

---

## 4. Modelo de Datos (SQL)

```sql
-- ─── Credenciales WhatsApp (referencia, los valores reales van en Vault) ────
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id  TEXT NOT NULL,
  waba_id          TEXT NOT NULL,
  display_phone    TEXT NOT NULL,          -- "+56 9 2207 1511"
  business_name    TEXT DEFAULT 'Pessaro Capital',
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Historial de Mensajes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_message_id  TEXT UNIQUE,            -- ID devuelto por Meta
  client_phone     TEXT NOT NULL,          -- Formato E.164: "+56912345678"
  client_name      TEXT,                   -- Nombre del contacto si disponible
  direction        TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type     TEXT NOT NULL,          -- 'text', 'template', 'image', 'document', 'button', 'interactive'
  content          JSONB NOT NULL,         -- {text: "...", media_url: "...", template_name: "..."}
  template_name    TEXT,                   -- Nombre de plantilla si es template
  status           TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  error_code       TEXT,
  error_message    TEXT,
  staff_id         UUID REFERENCES crm_staff_profiles(id), -- Asesor que envió (outbound)
  campaign_id      UUID REFERENCES campaigns(id),          -- Campaña asociada si aplica
  lead_id          UUID REFERENCES campaign_leads(id),     -- Lead asociado si aplica
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wa_messages_phone ON whatsapp_messages(client_phone);
CREATE INDEX idx_wa_messages_direction ON whatsapp_messages(direction);
CREATE INDEX idx_wa_messages_created ON whatsapp_messages(created_at DESC);
CREATE INDEX idx_wa_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_wa_messages_campaign ON whatsapp_messages(campaign_id);

-- ─── Plantillas aprobadas por Meta ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name    TEXT NOT NULL UNIQUE,   -- Nombre en Meta (ej: "campana_minimalist")
  language         TEXT DEFAULT 'es',
  category         TEXT,                   -- 'MARKETING', 'UTILITY', 'AUTHENTICATION'
  status           TEXT DEFAULT 'PENDING', -- 'APPROVED', 'PENDING', 'REJECTED'
  header_type      TEXT,                   -- 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', null
  body_text        TEXT,                   -- Texto con variables {{1}}, {{2}}
  footer_text      TEXT,
  buttons          JSONB,                  -- [{type: 'URL', text: '...', url: '...'}]
  variables_count  INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Campañas de WhatsApp (batch sends) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  template_id      UUID REFERENCES whatsapp_templates(id),
  campaign_id      UUID REFERENCES campaigns(id),          -- FK a campaña CRM
  variant_key      TEXT,                                    -- 'minimalist', 'navy', etc.
  target_filter    JSONB,                                   -- Filtro de leads: {variant: 'minimalist', etapa: [1,2]}
  total_recipients INT DEFAULT 0,
  sent_count       INT DEFAULT 0,
  delivered_count  INT DEFAULT 0,
  read_count       INT DEFAULT 0,
  failed_count     INT DEFAULT 0,
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'paused')),
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Habilitar Realtime para chat en vivo ───────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;

-- ─── RLS básico ─────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a usuarios autenticados con rol interno
CREATE POLICY "Staff can read messages" ON whatsapp_messages
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can insert messages" ON whatsapp_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff can read templates" ON whatsapp_templates
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can read campaigns" ON whatsapp_campaigns
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can read config" ON whatsapp_config
  FOR SELECT USING (auth.role() = 'authenticated');
```

---

## 5. Edge Function: Webhook Receptor (`whatsapp-webhook`)

**Nombre de función:** `whatsapp-webhook`
**JWT:** `verify_jwt: false` (Meta no envía JWT)
**Archivo:** `index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ─── GET: Validación del Webhook (Meta lo llama 1 vez al configurar) ───
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const VERIFY_TOKEN = Deno.env.get('WA_VERIFY_TOKEN') || '';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado por Meta');
      return new Response(challenge, { status: 200 });
    }
    console.warn('❌ Verificación fallida — token no coincide');
    return new Response('Forbidden', { status: 403 });
  }

  // ─── POST: Mensajes entrantes y actualizaciones de estado ──────────────
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      if (!changes) return new Response('OK', { status: 200 });

      // ── Actualización de estado (sent → delivered → read) ──────────
      if (changes.statuses?.length) {
        for (const s of changes.statuses) {
          const update: Record<string, string> = { status: s.status };
          if (s.errors?.[0]) {
            update.error_code = String(s.errors[0].code);
            update.error_message = s.errors[0].title || s.errors[0].message || '';
          }
          await supabase
            .from('whatsapp_messages')
            .update(update)
            .eq('meta_message_id', s.id);
        }
      }

      // ── Mensaje entrante ───────────────────────────────────────────
      if (changes.messages?.length) {
        for (const msg of changes.messages) {
          const fromPhone = msg.from; // E.164 sin "+"
          const contactName = changes.contacts?.[0]?.profile?.name || '';
          let contentData: Record<string, unknown> = {};

          switch (msg.type) {
            case 'text':
              contentData = { text: msg.text.body };
              break;
            case 'button':
              contentData = { text: msg.button?.text, payload: msg.button?.payload };
              break;
            case 'interactive':
              contentData = {
                type: msg.interactive?.type,
                title: msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title,
                id: msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id,
              };
              break;
            case 'image':
            case 'document':
            case 'video':
            case 'audio':
              contentData = {
                media_id: msg[msg.type]?.id,
                mime_type: msg[msg.type]?.mime_type,
                caption: msg[msg.type]?.caption || '',
              };
              break;
            case 'location':
              contentData = { lat: msg.location?.latitude, lng: msg.location?.longitude };
              break;
            default:
              contentData = { raw_type: msg.type };
          }

          // Insertar — gatilla Realtime automáticamente
          const { error } = await supabase.from('whatsapp_messages').insert({
            meta_message_id: msg.id,
            client_phone: `+${fromPhone}`,
            client_name: contactName,
            direction: 'inbound',
            message_type: msg.type,
            content: contentData,
            status: 'delivered',
          });
          if (error) console.error('Insert error:', error.message);

          // (Opcional) Auto-vincular con lead si existe por teléfono
          const { data: lead } = await supabase
            .from('campaign_leads')
            .select('id')
            .eq('phone', `+${fromPhone}`)
            .maybeSingle();
          if (lead) {
            await supabase
              .from('whatsapp_messages')
              .update({ lead_id: lead.id })
              .eq('meta_message_id', msg.id);
          }
        }
      }

      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('Webhook error:', err);
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
});
```

---

## 6. Edge Function: Envío de Mensajes (`whatsapp-send`)

**Nombre de función:** `whatsapp-send`
**JWT:** `verify_jwt: true` (solo usuarios autenticados del CRM)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
}

const GRAPH_API = 'https://graph.facebook.com/v21.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const PHONE_ID = Deno.env.get('WA_PHONE_NUMBER_ID');
    const TOKEN = Deno.env.get('WA_PERMANENT_TOKEN');
    if (!PHONE_ID || !TOKEN) return json({ error: 'WA credentials not configured' }, 500);

    const { action, ...payload } = await req.json();

    // ─── Enviar mensaje de texto libre ───────────────────────────────
    if (action === 'send_text') {
      const { to, text, staff_id, lead_id, campaign_id } = payload;
      if (!to || !text) return json({ error: 'to y text requeridos' }, 400);

      const res = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace(/\+/g, ''),
          type: 'text',
          text: { preview_url: true, body: text },
        }),
      });
      const result = await res.json();

      if (result.messages?.[0]?.id) {
        await supabase.from('whatsapp_messages').insert({
          meta_message_id: result.messages[0].id,
          client_phone: to,
          direction: 'outbound',
          message_type: 'text',
          content: { text },
          status: 'sent',
          staff_id: staff_id || null,
          lead_id: lead_id || null,
          campaign_id: campaign_id || null,
        });
        return json({ success: true, message_id: result.messages[0].id });
      }
      return json({ success: false, error: result.error?.message || 'Unknown Meta error', meta_response: result }, 400);
    }

    // ─── Enviar plantilla aprobada por Meta ──────────────────────────
    if (action === 'send_template') {
      const { to, template_name, language, components, staff_id, lead_id, campaign_id } = payload;
      if (!to || !template_name) return json({ error: 'to y template_name requeridos' }, 400);

      const res = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace(/\+/g, ''),
          type: 'template',
          template: {
            name: template_name,
            language: { code: language || 'es' },
            components: components || [],
          },
        }),
      });
      const result = await res.json();

      if (result.messages?.[0]?.id) {
        await supabase.from('whatsapp_messages').insert({
          meta_message_id: result.messages[0].id,
          client_phone: to,
          direction: 'outbound',
          message_type: 'template',
          template_name,
          content: { template_name, components },
          status: 'sent',
          staff_id: staff_id || null,
          lead_id: lead_id || null,
          campaign_id: campaign_id || null,
        });
        return json({ success: true, message_id: result.messages[0].id });
      }
      return json({ success: false, error: result.error?.message || 'Meta error', meta_response: result }, 400);
    }

    // ─── Envío masivo (campaña) ──────────────────────────────────────
    if (action === 'send_campaign') {
      const { wa_campaign_id } = payload;
      if (!wa_campaign_id) return json({ error: 'wa_campaign_id requerido' }, 400);

      const { data: waCampaign } = await supabase
        .from('whatsapp_campaigns')
        .select('*, whatsapp_templates(*)')
        .eq('id', wa_campaign_id)
        .single();
      if (!waCampaign) return json({ error: 'Campaña no encontrada' }, 404);

      // Obtener leads según filtro
      let query = supabase.from('campaign_leads').select('id,full_name,phone,email,variant');
      const filter = waCampaign.target_filter || {};
      if (filter.variant) query = query.eq('variant', filter.variant);
      if (filter.etapa) query = query.in('etapa', filter.etapa);
      if (waCampaign.campaign_id) query = query.eq('campaign_id', waCampaign.campaign_id);

      const { data: leads } = await query;
      if (!leads?.length) return json({ error: 'No hay leads que coincidan con el filtro' }, 400);

      await supabase.from('whatsapp_campaigns').update({
        status: 'sending',
        started_at: new Date().toISOString(),
        total_recipients: leads.length,
      }).eq('id', wa_campaign_id);

      let sent = 0, failed = 0;
      const template = waCampaign.whatsapp_templates;

      for (const lead of leads) {
        if (!lead.phone) { failed++; continue; }
        try {
          const firstName = lead.full_name?.split(' ')[0] || '';
          const components = [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: firstName },
              ],
            },
          ];
          // Si el template tiene botón URL con variable
          if (template?.buttons) {
            const urlBtn = (template.buttons as any[]).find((b: any) => b.type === 'URL');
            if (urlBtn) {
              components.push({
                type: 'button' as any,
                sub_type: 'url' as any,
                index: '0' as any,
                parameters: [{ type: 'text', text: waCampaign.variant_key || 'minimalist' }],
              } as any);
            }
          }

          const res = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: lead.phone.replace(/\+/g, ''),
              type: 'template',
              template: { name: template?.template_name, language: { code: 'es' }, components },
            }),
          });
          const result = await res.json();

          if (result.messages?.[0]?.id) {
            await supabase.from('whatsapp_messages').insert({
              meta_message_id: result.messages[0].id,
              client_phone: lead.phone,
              direction: 'outbound',
              message_type: 'template',
              template_name: template?.template_name,
              content: { template_name: template?.template_name, first_name: firstName },
              status: 'sent',
              campaign_id: waCampaign.campaign_id,
              lead_id: lead.id,
            });
            sent++;
          } else {
            failed++;
          }

          // Rate limiting: Meta permite ~80 msgs/segundo para tier básico
          await new Promise(r => setTimeout(r, 100));
        } catch {
          failed++;
        }
      }

      await supabase.from('whatsapp_campaigns').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        sent_count: sent,
        failed_count: failed,
      }).eq('id', wa_campaign_id);

      return json({ success: true, sent, failed, total: leads.length });
    }

    return json({ error: 'action no reconocida' }, 400);
  } catch (err) {
    console.error('Send error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

---

## 7. Frontend: Componentes React para el CRM

### A. Hook: `useWhatsAppChat` — Realtime subscription

```typescript
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WaMessage {
  id: string;
  meta_message_id: string;
  client_phone: string;
  client_name: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: { text?: string; media_url?: string; [key: string]: unknown };
  status: string;
  created_at: string;
}

export function useWhatsAppChat(clientPhone: string) {
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial del historial
  const loadHistory = useCallback(async () => {
    if (!clientPhone) return;
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('client_phone', clientPhone)
      .order('created_at', { ascending: true });
    setMessages((data as WaMessage[]) || []);
    setLoading(false);
  }, [clientPhone]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Suscripción Realtime — nuevos mensajes y cambios de estado
  useEffect(() => {
    if (!clientPhone) return;

    const channel = supabase
      .channel(`wa-chat-${clientPhone}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `client_phone=eq.${clientPhone}`,
        },
        (payload) => setMessages(prev => [...prev, payload.new as WaMessage])
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `client_phone=eq.${clientPhone}`,
        },
        (payload) =>
          setMessages(prev =>
            prev.map(m => (m.id === (payload.new as WaMessage).id ? (payload.new as WaMessage) : m))
          )
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientPhone]);

  // Enviar mensaje
  const sendText = useCallback(async (text: string, staffId?: string) => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        action: 'send_text',
        to: clientPhone,
        text,
        staff_id: staffId,
      }),
    });
    return res.json();
  }, [clientPhone]);

  return { messages, loading, sendText, reload: loadHistory };
}
```

### B. Componentes UI sugeridos para el CRM

| Componente | Descripción | Ubicación en CRM |
|---|---|---|
| `WhatsAppInbox` | Lista de conversaciones agrupadas por `client_phone`, último mensaje, badge no leídos | Sidebar o módulo "Mensajes" |
| `ChatWindow` | Burbujas inbound/outbound, ticks de estado (✓✓), input de texto, botón plantilla | Panel central al seleccionar conversación |
| `TemplatePicker` | Modal para seleccionar plantilla aprobada, llenar variables, previsualizar | Dentro de `ChatWindow` |
| `CampaignSender` | Crear campaña WA: elegir plantilla, filtrar leads, programar envío, ver métricas | Tab "Campañas WA" en módulo Campañas |
| `StatusIndicator` | Badge que muestra `sent` → `delivered` → `read` con colores | En cada burbuja de mensaje |

---

## 8. Egress y dominios a habilitar

En Supabase Edge Functions (si hay allowlist), agregar:

```
graph.facebook.com
```

---

## 9. Plantillas sugeridas para Meta

### Template: `campana_minimalist`
- **Categoría:** MARKETING
- **Idioma:** es
- **Body:** `Hola {{1}}, Pessaro Capital abrió cupos limitados para su Portafolio Q2 2026. Gestión profesional de CFDs con retorno histórico verificable. Inversión mínima USD 5.000.`
- **Botón:** URL → `https://pessaro.cl/campana/{{1}}` (variable = variant key)
- **Footer:** `Pessaro Capital · pessaro.cl`

### Template: `otp_verification`
- **Categoría:** AUTHENTICATION
- **Body:** `Tu código de verificación para Pessaro Capital es: {{1}}. Válido por 10 minutos.`
- **Botón:** COPY_CODE → `{{1}}`

### Template: `advisor_contact`
- **Categoría:** UTILITY
- **Body:** `Hola {{1}}, soy {{2}} de Pessaro Capital. Te contacto por tu interés en el Portafolio Q2. ¿Tienes unos minutos para conversar?`
- **Botón:** QUICK_REPLY → `Sí, hablemos` / `Programar reunión`

---

## 10. Checklist de implementación

- [ ] Crear app en Meta Business Suite
- [ ] Registrar número de WhatsApp Business
- [ ] Obtener Phone Number ID, WABA ID, Permanent Token
- [ ] Guardar secrets en Supabase Vault
- [ ] Ejecutar SQL de tablas
- [ ] Desplegar `whatsapp-webhook` (verify_jwt: false)
- [ ] Configurar Webhook URL en Meta → verificar con GET
- [ ] Desplegar `whatsapp-send` (verify_jwt: true)
- [ ] Enviar mensaje de prueba desde CRM
- [ ] Recibir respuesta → verificar en Supabase Realtime
- [ ] Crear y aprobar plantillas en Meta
- [ ] Integrar componentes React en CRM
- [ ] Probar campaña masiva con subset de leads

---

## 11. Limitaciones y costos

- **Ventana de 24h:** Solo puedes responder mensajes de texto libre dentro de 24h desde el último mensaje del cliente. Fuera de esa ventana, solo plantillas aprobadas.
- **Rate limits:** Tier 1 = 1.000 msgs/24h business-initiated. Sube con verificación y volumen.
- **Costos por mensaje:** Varía por país. Chile ~$0.04 USD conversation (marketing), ~$0.02 (utility).
- **Aprobación de plantillas:** 24-48h típico. Marketing templates requieren opt-in del usuario.
