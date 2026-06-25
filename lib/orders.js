// lib/orders.js
import { kv } from '@vercel/kv';

function getISTDate() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yy = String(ist.getFullYear()).slice(2);
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const dd = String(ist.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * Generates order IDs:
 *   cod         → VED-C250605XX
 *   prepaid     → VED-P250605XX
 *   free        → VED-A250605XX  (Admin/free order)
 *   replacement → VED-R250605XX  (Replacement order)
 * Counter resets each IST day. Falls back to base36 suffix if KV is down.
 */
export async function generateOrderId(method) {
  const prefixMap = { cod: 'C', prepaid: 'P', free: 'A', replacement: 'R' };
  const prefix = prefixMap[method];
  if (!prefix) throw new Error(`generateOrderId: invalid method "${method}"`);
  const date   = getISTDate();
  const kvKey  = `order_seq:${date}`;
  try {
    const seq = await kv.incr(kvKey);
    await kv.expire(kvKey, 172800);
    return `VED-${prefix}${date}${String(seq).padStart(2, '0')}`;
  } catch {
    const short = Date.now().toString(36).slice(-4).toUpperCase();
    return `VED-${prefix}F${date}${short}`;
  }
}
