// Runs every 3 hours. Sends the final hold reminder to COD customers who:
//   - Were already nudged at 6h
//   - Are still pending at 20–23h (before auto-confirm fires at 24h)
//   - Haven't received this reminder yet
import { supabase } from '../../../lib/supabase';
import { waCodFinalWarning } from '../../../lib/whatsapp';
import * as Sentry from '@sentry/nextjs';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.SESSION_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return Sentry.withMonitor('cod-hold-reminder', async () => {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const now           = new Date();
    const twentyHAgo    = new Date(now - 20 * 60 * 60 * 1000).toISOString();
    const twentyThreeHAgo = new Date(now - 23 * 60 * 60 * 1000).toISOString();

    const { data: pending, error } = await supabase
      .from('cod_verifications')
      .select('order_id, mobile, name')
      .eq('status', 'pending')
      .not('nudged_at', 'is', null)       // must have already received the 6hr nudge
      .is('hold_reminded_at', null)        // hasn't received this final reminder yet
      .gte('created_at', twentyThreeHAgo)  // not older than 23h (auto-confirm handles those)
      .lte('created_at', twentyHAgo);      // at least 20h old

    if (error) return res.status(500).json({ error: error.message });
    if (!pending?.length) return res.json({ reminded: 0 });

    let reminded = 0;
    for (const row of pending) {
      await waCodFinalWarning({ mobile: row.mobile, name: row.name, orderId: row.order_id }).catch(() => {});
      await supabase.from('cod_verifications')
        .update({ hold_reminded_at: now.toISOString() })
        .eq('order_id', row.order_id).catch(() => {});
      reminded++;
    }

    console.log(`[cod-hold-reminder] reminded ${reminded} orders`);
    return res.json({ reminded });
  }, { schedule: { type: 'crontab', value: '30 11 * * *' } });
}
