// pages/api/cron/tabbly-retry.js
// Runs every 30 minutes. Processes pending Tabbly retries whose scheduled_at has passed,
// but only within the IST call window (10:00 AM – 10:00 PM).
import { supabase }                          from '../../../lib/supabase';
import { triggerTabblyCall, isWithinCallWindow } from '../../../lib/tabbly';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.SESSION_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });

  if (!isWithinCallWindow()) {
    return res.json({ skipped: true, reason: 'outside call window (IST 10am-10pm)' });
  }

  const { data: due, error } = await supabase
    .from('tabbly_call_retries')
    .select('id, order_id, attempt')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  if (!due?.length) return res.json({ fired: 0 });

  let fired = 0;
  for (const retry of due) {
    const { data: order } = await supabase
      .from('orders')
      .select('name, price, address, city, state, pincode')
      .eq('order_id', retry.order_id)
      .single();

    if (!order) {
      await supabase.from('tabbly_call_retries').update({
        status:     'skipped',
        last_error: 'order not found',
        updated_at:  new Date().toISOString(),
      }).eq('id', retry.id);
      continue;
    }

    const fullAddress = `${order.address}, ${order.city}, ${order.state} - ${order.pincode}`;

    try {
      await triggerTabblyCall({
        orderId: retry.order_id,
        name:    order.name,
        price:   order.price,
        address: fullAddress,
        state:   order.state,
      });

      await supabase.from('tabbly_call_retries').update({
        status:     'fired',
        fired_at:    new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      }).eq('id', retry.id);

      fired++;
    } catch (err) {
      console.error(`[Tabbly] Retry ${retry.id} for ${retry.order_id} failed:`, err.message);
      await supabase.from('tabbly_call_retries').update({
        status:      'failed',
        last_error:   err.message,
        updated_at:   new Date().toISOString(),
      }).eq('id', retry.id);
    }
  }

  return res.json({ fired, total: due.length });
}
