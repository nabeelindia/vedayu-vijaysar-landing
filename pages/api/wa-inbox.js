import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  if (req.method === 'PATCH') {
    // Mark messages as read for a phone number
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const { error } = await supabase
      .from('wa_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('from_phone', phone)
      .is('read_at', null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (req.method !== 'GET') return res.status(405).end();

  // Fetch inbound and outbound messages in parallel
  const [inboundRes, outboundRes] = await Promise.all([
    supabase.from('wa_messages').select('*').order('created_at', { ascending: true }).limit(1000),
    supabase.from('wa_outbound').select('*').order('sent_at', { ascending: true }).limit(1000),
  ]);

  if (inboundRes.error) return res.status(500).json({ error: inboundRes.error.message });

  const inbound  = inboundRes.data  || [];
  const outbound = outboundRes.data || []; // graceful if table doesn't exist yet

  // Group inbound into conversations
  const convMap = {};
  for (const msg of inbound) {
    if (!convMap[msg.from_phone]) {
      convMap[msg.from_phone] = {
        phone:    msg.from_phone,
        name:     msg.from_name || msg.from_phone,
        messages: [],
        unread:   0,
        lastAt:   msg.created_at,
      };
    }
    convMap[msg.from_phone].messages.push({ ...msg, direction: 'in' });
    if (!msg.read_at) convMap[msg.from_phone].unread++;
    if (msg.created_at > convMap[msg.from_phone].lastAt) {
      convMap[msg.from_phone].lastAt = msg.created_at;
    }
    // Inject bot reply as a synthetic outbound message so it appears in the thread
    if (msg.bot_replied) {
      convMap[msg.from_phone].messages.push({
        id:         `bot_${msg.id}`,
        message:    msg.bot_replied,
        direction:  'out',
        created_at: msg.created_at, // same timestamp — sort puts it right after inbound
        bot:        true,
      });
    }
  }

  // Merge outbound replies into matching conversations
  for (const msg of outbound) {
    if (!convMap[msg.to_phone]) continue; // no conversation yet for this phone
    convMap[msg.to_phone].messages.push({ ...msg, direction: 'out', created_at: msg.sent_at });
    if (msg.sent_at > convMap[msg.to_phone].lastAt) {
      convMap[msg.to_phone].lastAt = msg.sent_at;
    }
  }

  // Sort each conversation's messages chronologically
  for (const conv of Object.values(convMap)) {
    conv.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  // Sort conversations by most recent activity
  const conversations = Object.values(convMap).sort(
    (a, b) => new Date(b.lastAt) - new Date(a.lastAt)
  );

  return res.json({ conversations });
}
