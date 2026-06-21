import { supabase } from '../../lib/supabase';
import { checkAdminAuth } from './admin/_auth';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).end();

  const { phone, message } = req.body || {};
  if (!phone || !message?.trim()) return res.status(400).json({ error: 'phone and message required' });

  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const token   = process.env.WA_TOKEN;
  if (!phoneId || !token) return res.status(500).json({ error: 'WhatsApp not configured' });

  // Send via WhatsApp Cloud API
  const waRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message.trim() },
    }),
  });

  const waJson = await waRes.json();
  if (!waRes.ok) {
    console.error('[WA reply] send error:', JSON.stringify(waJson));
    return res.status(502).json({ error: waJson?.error?.message || 'WhatsApp send failed' });
  }

  // Persist to outbound table
  if (supabase) {
    const { error: dbErr } = await supabase
      .from('wa_outbound')
      .insert({ to_phone: phone, message: message.trim() });
    if (dbErr) console.error('[WA reply] DB error:', dbErr.message);
  }

  return res.json({ ok: true });
}
