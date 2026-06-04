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

  // Fetch all messages, most recent first
  const { data, error } = await supabase
    .from('wa_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return res.status(500).json({ error: error.message });

  // Group into conversations keyed by phone number
  const convMap = {};
  for (const msg of data) {
    if (!convMap[msg.from_phone]) {
      convMap[msg.from_phone] = {
        phone: msg.from_phone,
        name: msg.from_name || msg.from_phone,
        messages: [],
        unread: 0,
        lastAt: msg.created_at,
      };
    }
    convMap[msg.from_phone].messages.push(msg);
    if (!msg.read_at) convMap[msg.from_phone].unread++;
  }

  // Sort conversations by most recent message
  const conversations = Object.values(convMap).sort(
    (a, b) => new Date(b.lastAt) - new Date(a.lastAt)
  );

  return res.json({ conversations });
}
