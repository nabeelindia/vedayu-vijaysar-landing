import { supabase } from '../../../lib/supabase';
import { waCustomMessage } from '../../../lib/whatsapp';
import { sendPush } from '../../../lib/push';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId, name, phone } = req.body;

  if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim())
    return res.status(400).json({ error: 'sessionId required' });

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) return res.status(400).json({ error: 'name required' });

  if (!phone || typeof phone !== 'string')
    return res.status(400).json({ error: 'phone required' });
  const cleaned = phone.replace(/\D/g, '').slice(-10);
  if (!/^[6-9][0-9]{9}$/.test(cleaned))
    return res.status(400).json({ error: 'Invalid mobile number' });

  // Save to DB (non-fatal if it fails)
  const { error: dbErr } = await supabase
    .from('chat_sessions')
    .update({ contact_name: trimmedName, contact_phone: cleaned, escalated: true })
    .eq('session_id', sessionId.trim());

  if (dbErr) console.error('Handoff DB error (non-fatal):', dbErr);

  // Notify admin via WhatsApp + browser push in parallel
  const adminPhone = process.env.ADMIN_WA_PHONE;
  await Promise.allSettled([
    adminPhone
      ? waCustomMessage({
          mobile: adminPhone,
          text: `🚨 *Chat Escalation — Customer needs help*\n\nName: ${trimmedName}\nPhone: +91${cleaned}\nSession: ${sessionId.trim()}\n\nCheck admin panel: https://vedayulife.com/admin/chats`,
        })
      : Promise.resolve(),
    sendPush({
      title: '🚨 Customer wants human support',
      body: `${trimmedName} (+91${cleaned}) — check admin chats`,
    }),
  ]);

  return res.status(200).json({ success: true });
}
