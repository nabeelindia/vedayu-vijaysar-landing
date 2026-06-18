// pages/api/tabbly-trigger.js
// Internal-only: called by submit-cod.js and cron/tabbly-retry.js.
// Fires an outbound Tabbly call for a COD order.
import { triggerTabblyCall } from '../../lib/tabbly';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (req.headers.authorization !== `Bearer ${process.env.SESSION_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orderId, name, price, address, state, mobile } = req.body;
  if (!orderId || !name || !price || !address || !state || !mobile) {
    return res.status(400).json({ error: 'orderId, name, price, address, state, mobile required' });
  }

  try {
    const result = await triggerTabblyCall({ orderId, name, price, address, state, mobile });
    console.log(`[Tabbly] Call triggered for ${orderId}:`, result);
    return res.json({ ok: true, orderId, result });
  } catch (err) {
    console.error('[Tabbly] Trigger failed for', orderId, ':', err.message);
    return res.status(502).json({ error: err.message });
  }
}
