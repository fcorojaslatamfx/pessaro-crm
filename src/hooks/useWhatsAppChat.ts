import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

interface WaMessage {
  id: string;
  meta_message_id: string;
  client_phone: string;
  client_name: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: { text?: string; media_url?: string; [key: string]: unknown };
  status: string;
  template_name?: string;
  created_at: string;
}

export function useWhatsAppChat(clientPhone: string) {
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(true);

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

  const sendText = useCallback(async (text: string, staffId?: string) => {
    const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
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

  const sendTemplate = useCallback(async (
    templateName: string,
    language: string,
    components: unknown[],
    staffId?: string
  ) => {
    const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        action: 'send_template',
        to: clientPhone,
        template_name: templateName,
        language,
        components,
        staff_id: staffId,
      }),
    });
    return res.json();
  }, [clientPhone]);

  return { messages, loading, sendText, sendTemplate, reload: loadHistory };
}
