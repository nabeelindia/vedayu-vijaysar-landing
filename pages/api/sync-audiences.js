/**
 * POST /api/sync-audiences
 * Syncs purchasers and abandoners from KV to Meta Custom Audiences.
 * Called by cron or manually.
 */
import { getActiveOrders } from '../../lib/followup-queue';
import { syncAll } from '../../lib/meta-audiences';
import { kv } from '@vercel/kv';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Pull purchasers from followup queue (all orders that were enqueued)
  const orders = await getActiveOrders();
  const purchasers = orders
    .filter(o => o.email || o.mobile)
    .map(o => ({ name: o.name, email: o.email, mobile: o.mobile }));

  // Pull abandoners from KV (stored by track-abandon)
  let abandoners = [];
  try {
    const ids = await kv.smembers('abandon:active') || [];
    const raw = await Promise.all(ids.map(id => kv.get(`abandon:${id}`)));
    abandoners = raw.filter(Boolean).map(a => ({
      name: a.name, email: a.email, mobile: a.mobile,
    }));
  } catch (_) {
    // abandon KV not set up yet — skip silently
  }

  const result = await syncAll(purchasers, abandoners);

  return res.status(200).json({
    purchasersUploaded: purchasers.length,
    abandonersUploaded: abandoners.length,
    meta: result,
  });
}
