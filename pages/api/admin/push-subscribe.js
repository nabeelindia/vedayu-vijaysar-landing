// pages/api/admin/push-subscribe.js
import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    const { endpoint, p256dh, auth } = req.body;
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Missing fields' });
    const { error } = await supabase.from('push_subscriptions')
      .upsert({ endpoint, p256dh, auth }, { onConflict: 'endpoint' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
