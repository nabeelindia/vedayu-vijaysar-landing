// Runs daily at 06:00 IST (00:30 UTC). Auto-confirms COD orders pending for 24h+.
import { supabase } from '../../../lib/supabase';
import { Resend } from 'resend';
import * as Sentry from '@sentry/nextjs';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.SESSION_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return Sentry.withMonitor('cod-auto-confirm', async () => {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stale, error } = await supabase
      .from('cod_verifications')
      .select('order_id, mobile, name')
      .eq('status', 'pending')
      .lte('created_at', cutoff);

    if (error) return res.status(500).json({ error: error.message });
    if (!stale?.length) return res.json({ autoConfirmed: 0 });

    const now    = new Date().toISOString();
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    let autoConfirmed = 0;

    for (const row of stale) {
      await supabase.from('cod_verifications')
        .update({ status: 'auto_confirmed', verified_at: now })
        .eq('order_id', row.order_id).catch(() => {});
      await supabase.from('orders')
        .update({ status: 'auto_confirmed', updated_at: now })
        .eq('order_id', row.order_id).catch(() => {});

      if (resend && process.env.ORDERS_EMAIL) {
        await resend.emails.send({
          from:    'Vedayu System <orders@vedayulife.com>',
          to:      process.env.ORDERS_EMAIL,
          subject: `🤖 Auto-confirmed — ${row.order_id} | ${row.name}`,
          html:    `<p style="font-family:sans-serif">Order <b>${row.order_id}</b> (${row.name}) was auto-confirmed — customer did not reply in 24h. Please call before sending the order.</p>`,
        }).catch(() => {});
      }
      autoConfirmed++;
    }

    console.log(`[cod-auto-confirm] auto-confirmed ${autoConfirmed} orders`);
    return res.json({ autoConfirmed });
  }, { schedule: { type: 'crontab', value: '30 0 * * *' } });
}
