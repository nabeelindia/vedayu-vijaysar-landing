// pages/api/admin/migrate-kv.js
// ONE-SHOT migration route — DELETE after use
// Protected by CRON_SECRET header
import { createClient } from '@supabase/supabase-js';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  );

  const results = { followup_queue: [], referrals: [], shipments: [], errors: [] };

  // ── followup_queue ──────────────────────────────────────
  try {
    const ids = await kv.smembers('followup:active');
    results.followup_queue_total = ids?.length || 0;

    for (const orderId of (ids || [])) {
      const d = await kv.get(`followup:${orderId}`);
      if (!d) continue;

      const { error } = await supabase.from('followup_queue').upsert({
        order_id:     d.orderId,
        email:        d.email,
        name:         d.name,
        pack:         d.pack,
        price:        d.price,
        method:       d.method,
        mobile:       d.mobile || null,
        order_ts:     new Date(d.orderTs).toISOString(),
        sent_d3:      d.sent?.d3  || false,
        sent_d7:      d.sent?.d7  || false,
        sent_d30:     d.sent?.d30 || false,
        sent_d90:     d.sent?.d90 || false,
        unsubscribed: false,
      }, { onConflict: 'order_id' });

      if (error) results.errors.push(`followup ${orderId}: ${error.message}`);
      else results.followup_queue.push(orderId);
    }
  } catch (e) {
    results.errors.push(`followup_queue: ${e.message}`);
  }

  // ── referrals ───────────────────────────────────────────
  try {
    let cursor = 0;
    let keys = [];
    do {
      const [nextCursor, batch] = await kv.scan(cursor, { match: 'referral:owner:*', count: 100 });
      cursor = Number(nextCursor);
      keys = keys.concat(batch);
    } while (cursor !== 0);

    results.referrals_total = keys.length;

    for (const key of keys) {
      const orderId     = key.replace('referral:owner:', '');
      const ownerMobile = await kv.get(key);
      const used        = await kv.get(`referral:used:${orderId}`);

      const { error } = await supabase.from('referrals').upsert({
        order_id:     orderId,
        owner_mobile: ownerMobile || '',
        referrer_id:  used?.referrerId || null,
        discount:     used?.discount   || null,
        method:       used?.method     || null,
      }, { onConflict: 'order_id' });

      if (error) results.errors.push(`referral ${orderId}: ${error.message}`);
      else results.referrals.push(orderId);
    }
  } catch (e) {
    results.errors.push(`referrals: ${e.message}`);
  }

  // ── shipments ───────────────────────────────────────────
  try {
    let cursor = 0;
    let keys = [];
    do {
      const [nextCursor, batch] = await kv.scan(cursor, { match: 'nimbuspost:order:*', count: 100 });
      cursor = Number(nextCursor);
      keys = keys.concat(batch);
    } while (cursor !== 0);

    results.shipments_total = keys.length;

    for (const key of keys) {
      const orderId = key.replace('nimbuspost:order:', '');
      const d = await kv.get(key);
      if (!d) continue;

      const { error } = await supabase.from('shipments').upsert({
        order_id:            orderId,
        awb:                 d.awb || null,
        courier:             'nimbuspost',
        nimbuspost_order_id: d.nimbuspostOrderId || null,
        mobile:              d.mobile || null,
        email:               d.email  || null,
        name:                d.name   || null,
        label_url:           d.labelUrl || null,
        last_updated_at:     new Date().toISOString(),
      }, { onConflict: 'order_id' });

      if (error) results.errors.push(`shipment ${orderId}: ${error.message}`);
      else results.shipments.push(orderId);
    }
  } catch (e) {
    results.errors.push(`shipments: ${e.message}`);
  }

  return res.status(200).json({
    followup_queue: { migrated: results.followup_queue.length, total: results.followup_queue_total },
    referrals:      { migrated: results.referrals.length, total: results.referrals_total },
    shipments:      { migrated: results.shipments.length, total: results.shipments_total },
    errors:         results.errors,
  });
}
