// Runs every 3 hours. Sends a nudge WA to COD customers who haven't responded in 6–23h.
import { supabase } from '../../../lib/supabase';
import { waCodNudge } from '../../../lib/whatsapp';
import * as Sentry from '@sentry/nextjs';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.SESSION_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return Sentry.withMonitor('cod-nudge', async () => {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const now              = new Date();
    const sixHAgo          = new Date(now - 6  * 60 * 60 * 1000).toISOString();
    const twentyThreeHAgo  = new Date(now - 23 * 60 * 60 * 1000).toISOString();

    const { data: pending, error } = await supabase
      .from('cod_verifications')
      .select('order_id, mobile, name')
      .eq('status', 'pending')
      .is('nudged_at', null)
      .gte('created_at', twentyThreeHAgo)
      .lte('created_at', sixHAgo);

    if (error) return res.status(500).json({ error: error.message });
    if (!pending?.length) return res.json({ nudged: 0 });

    let nudged = 0;
    for (const row of pending) {
      await waCodNudge({ mobile: row.mobile, name: row.name, orderId: row.order_id }).catch(() => {});
      await supabase.from('cod_verifications')
        .update({ nudged_at: now.toISOString() })
        .eq('order_id', row.order_id).catch(() => {});
      nudged++;
    }

    console.log(`[cod-nudge] nudged ${nudged} orders`);
    return res.json({ nudged });
  }, { schedule: { type: 'crontab', value: '30 4 * * *' } });
}
