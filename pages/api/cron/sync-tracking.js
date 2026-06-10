import { supabase }      from '../../../lib/supabase';
import { trackShipment } from '../../../lib/nimbuspost';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  // Fetch up to 50 orders currently in transit
  const { data: orders, error } = await supabase
    .from('orders')
    .select('order_id, awb, status')
    .eq('status', 'sent')
    .not('awb', 'is', null)
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  if (!orders?.length) return res.json({ synced: 0, message: 'No active shipments to sync' });

  const results = { synced: 0, errors: [] };

  for (const order of orders) {
    try {
      const data = await trackShipment(order.awb);

      await supabase.from('shipments').upsert({
        awb:             order.awb,
        status:          data.status          || null,
        rto_status:      data.rto_status       || null,
        rto_awb:         data.rto_awb          || null,
        edd:             data.edd              || null,
        history:         data.history          || [],
        last_synced_at:  new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        raw_event:       data,
      }, { onConflict: 'awb' });

      // Auto-update order status on terminal events
      const s = (data.status || '').toLowerCase();
      const now = new Date().toISOString();

      if (s.includes('delivered')) {
        await supabase.from('orders')
          .update({ status: 'delivered', delivered_at: now, updated_at: now })
          .eq('awb', order.awb);
      } else if (s.includes('rto')) {
        await supabase.from('orders')
          .update({ status: 'returned', returned_at: now, updated_at: now })
          .eq('awb', order.awb);
      }

      results.synced++;
    } catch (err) {
      console.error(`[sync-tracking] AWB ${order.awb}:`, err.message);
      results.errors.push({ awb: order.awb, error: err.message });
    }
  }

  console.log('[sync-tracking] done:', results);
  return res.json(results);
}
