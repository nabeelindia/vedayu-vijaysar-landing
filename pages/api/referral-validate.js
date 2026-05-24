/**
 * GET /api/referral-validate?ref=VED-COD-XXXX&mobile=9876543210
 *
 * Returns { valid: true }  — new customer, referral discount applies.
 * Returns { valid: false, reason: 'returning' } — mobile has placed an
 *   order before; referral is for new customers only.
 *
 * Identification: mobile number looked up against customer:{mobile} KV key
 * (written by saveCustomer() on every COD + prepaid order).
 */
import { kv } from '@vercel/kv';

export async function isNewCustomer(mobile) {
  const cleanMobile = String(mobile || '').replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) return true; // not a valid mobile yet — allow

  try {
    // Primary check: customer cache (written on every order)
    const existing = await kv.get(`customer:${cleanMobile}`);
    if (existing) return false;

    // Backup: Velocity or legacy NimbusPost phone index
    const [vIds, nIds] = await Promise.all([
      kv.lrange(`velocity:phone:${cleanMobile}`, 0, 1).catch(() => []),
      kv.lrange(`nimbuspost:phone:${cleanMobile}`, 0, 1).catch(() => []),
    ]);
    if (vIds?.length || nIds?.length) return false;

    return true; // no record — new customer
  } catch {
    return true; // KV unavailable — allow
  }
}

export default async function handler(req, res) {
  const { mobile } = req.query;
  if (!mobile) return res.status(400).json({ valid: false, reason: 'missing' });

  const newCustomer = await isNewCustomer(mobile);
  return res.json({
    valid:  newCustomer,
    reason: newCustomer ? null : 'returning',
  });
}
