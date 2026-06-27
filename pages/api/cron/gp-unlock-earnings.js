// GET /api/cron/gp-unlock-earnings
// Called daily by Vercel cron or manual trigger.
// Unlocks gp_earnings that are 'in_transit' and delivered_at + 7 days < now.
// Secured by CRON_SECRET header.

import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: eligible, error: fetchErr } = await supabase
    .from('gp_earnings')
    .select('id')
    .eq('status', 'in_transit')
    .not('delivered_at', 'is', null)
    .lt('delivered_at', cutoff);

  if (fetchErr) {
    console.error('[gp-unlock-earnings] fetch error:', fetchErr.message);
    return res.status(500).json({ error: fetchErr.message });
  }

  if (!eligible?.length) {
    return res.json({ ok: true, unlocked: 0 });
  }

  const ids = eligible.map(r => r.id);
  const { error: updateErr } = await supabase
    .from('gp_earnings')
    .update({ status: 'earned', unlocked_at: new Date().toISOString() })
    .in('id', ids);

  if (updateErr) {
    console.error('[gp-unlock-earnings] update error:', updateErr.message);
    return res.status(500).json({ error: updateErr.message });
  }

  console.log(`[gp-unlock-earnings] Unlocked ${ids.length} earnings`);
  return res.json({ ok: true, unlocked: ids.length });
}
