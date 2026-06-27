// Runs daily. Sends the 24hr recovery WA to cart abandoners who:
//   - Abandoned 20–28h ago (got the immediate nudge but haven't ordered)
//   - Haven't been marked as recovered
import { supabase } from '../../../lib/supabase';
import { waCartAbandonFinal } from '../../../lib/whatsapp';
import * as Sentry from '@sentry/nextjs';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.SESSION_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return Sentry.withMonitor('cart-recover', async () => {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const now        = new Date();
    const twentyHAgo = new Date(now - 20 * 60 * 60 * 1000).toISOString();
    const twentyEightHAgo = new Date(now - 28 * 60 * 60 * 1000).toISOString();

    const { data: abandons, error } = await supabase
      .from('cart_abandons')
      .select('mobile, name, pack')
      .eq('recovered', false)
      .is('recover_wa_sent_at', null)       // hasn't received this follow-up yet
      .gte('abandoned_at', twentyEightHAgo) // not older than 28h
      .lte('abandoned_at', twentyHAgo);     // at least 20h old

    if (error) return res.status(500).json({ error: error.message });
    if (!abandons?.length) return res.json({ sent: 0 });

    let sent = 0;
    for (const row of abandons) {
      await waCartAbandonFinal({ mobile: row.mobile, name: row.name || 'there', pack: row.pack }).catch(() => {});
      await supabase.from('cart_abandons')
        .update({ recover_wa_sent_at: now.toISOString() })
        .eq('mobile', row.mobile).catch(() => {});
      sent++;
    }

    console.log(`[cart-recover] sent ${sent} recovery messages`);
    return res.json({ sent });
  }, { schedule: { type: 'crontab', value: '0 5 * * *' } });
}
