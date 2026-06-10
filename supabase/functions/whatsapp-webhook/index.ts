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

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const VERIFY_TOKEN = Deno.env.get('WA_VERIFY_TOKEN') || '';
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado por Meta');
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

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

      if (changes.statuses?.length) {
        for (const s of changes.statuses) {
          const update: Record<string, string> = { status: s.status };
          if (s.errors?.[0]) {
            update.error_code = String(s.errors[0].code);
            update.error_message = s.errors[0].title || s.errors[0].message || '';
          }
          await supabase.from('whatsapp_messages').update(update).eq('meta_message_id', s.id);
        }
      }

      if (changes.messages?.length) {
        for (const msg of changes.messages) {
          const fromPhone = msg.from;
          const contactName = changes.contacts?.[0]?.profile?.name || '';
          let contentData: Record<string, unknown> = {};
          switch (msg.type) {
            case 'text': contentData = { text: msg.text.body }; break;
            case 'button': contentData = { text: msg.button?.text, payload: msg.button?.payload }; break;
            case 'interactive': contentData = { type: msg.interactive?.type, title: msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title }; break;
            case 'image': case 'document': case 'video': case 'audio':
              contentData = { media_id: msg[msg.type]?.id, mime_type: msg[msg.type]?.mime_type, caption: msg[msg.type]?.caption || '' }; break;
            case 'location': contentData = { lat: msg.location?.latitude, lng: msg.location?.longitude }; break;
            default: contentData = { raw_type: msg.type };
          }
          const { error } = await supabase.from('whatsapp_messages').insert({
            meta_message_id: msg.id, client_phone: `+${fromPhone}`, client_name: contactName,
            direction: 'inbound', message_type: msg.type, content: contentData, status: 'delivered',
          });
          if (error) console.error('Insert error:', error.message);
          const { data: lead } = await supabase.from('campaign_leads').select('id').eq('phone', `+${fromPhone}`).maybeSingle();
          if (lead) await supabase.from('whatsapp_messages').update({ lead_id: lead.id }).eq('meta_message_id', msg.id);
        }
      }
      return new Response('OK', { status: 200 });
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
  return new Response('Method Not Allowed', { status: 405 });
});
