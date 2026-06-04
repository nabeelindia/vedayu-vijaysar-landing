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
 * Generates VED-C250605XX (COD) or VED-P250605XX (Prepaid).
 * Counter resets each IST day. Falls back to base36 suffix if KV is down.
 * @param {'cod'|'prepaid'} method
 */
export async function generateOrderId(method) {
  const prefix = method === 'prepaid' ? 'P' : 'C';
  const date   = getISTDate();
  const kvKey  = `order_seq:${date}`;
  try {
    const seq = await kv.incr(kvKey);
    await kv.expire(kvKey, 172800); // 48h TTL — cleans up yesterday's key
    return `VED-${prefix}${date}${String(seq).padStart(2, '0')}`;
  } catch {
    const short = Date.now().toString(36).slice(-4).toUpperCase();
    return `VED-${prefix}F${date}${short}`;
  }
}
