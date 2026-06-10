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
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const PHONE_ID = Deno.env.get('WA_PHONE_NUMBER_ID');
    const TOKEN = Deno.env.get('WA_PERMANENT_TOKEN');
    if (!PHONE_ID || !TOKEN) return json({ error: 'WA credentials not configured' }, 500);
    const { action, ...payload } = await req.json();

    if (action === 'send_text') {
      const { to, text, staff_id, lead_id, campaign_id } = payload;
      if (!to || !text) return json({ error: 'to y text requeridos' }, 400);
      const res = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\+/g, ''), type: 'text', text: { preview_url: true, body: text } }),
      });
      const result = await res.json();
      if (result.messages?.[0]?.id) {
        await supabase.from('whatsapp_messages').insert({ meta_message_id: result.messages[0].id, client_phone: to, direction: 'outbound', message_type: 'text', content: { text }, status: 'sent', staff_id: staff_id || null, lead_id: lead_id || null, campaign_id: campaign_id || null });
        return json({ success: true, message_id: result.messages[0].id });
      }
      return json({ success: false, error: result.error?.message || 'Unknown Meta error', meta_response: result }, 400);
    }

    if (action === 'send_template') {
      const { to, template_name, language, components, staff_id, lead_id, campaign_id } = payload;
      if (!to || !template_name) return json({ error: 'to y template_name requeridos' }, 400);
      const res = await fetch(`${GRAPH_API}/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\+/g, ''), type: 'template', template: { name: template_name, language: { code: language || 'es' }, components: components || [] } }),
      });
      const result = await res.json();
      if (result.messages?.[0]?.id) {
        await supabase.from('whatsapp_messages').insert({ meta_message_id: result.messages[0].id, client_phone: to, direction: 'outbound', message_type: 'template', template_name, content: { template_name, components }, status: 'sent', staff_id: staff_id || null, lead_id: lead_id || null, campaign_id: campaign_id || null });
        return json({ success: true, message_id: result.messages[0].id });
      }
      return json({ success: false, error: result.error?.message || 'Meta error', meta_response: result }, 400);
    }

    return json({ error: 'action no reconocida' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
