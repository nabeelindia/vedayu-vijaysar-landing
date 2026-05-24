/**
 * GET /api/referral-validate?ref=VED-COD-XXXX&mobile=9876543210
 * Returns { valid: true } if the referral is not self-referral.
 * Returns { valid: false, reason: 'self' } if the customer is using
 * their own referral link.
 *
 * Two-layer check:
 *  1. KV lookup — works for orders placed after the fix was deployed
 *  2. NimbusPost phone index — works for ALL orders (kv list of orderIds by phone)
 */
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { ref, mobile } = req.query;
  if (!ref || !mobile) return res.status(400).json({ valid: false, reason: 'missing' });

  const cleanMobile = String(mobile).replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) return res.json({ valid: true });

  try {
    // ── Layer 1: direct owner lookup (orders placed after fix) ───────────
    const ownerMobile = await kv.get(`referral:owner:${ref}`);
    if (ownerMobile) {
      const isSelf = ownerMobile === cleanMobile;
      return res.json({ valid: !isSelf, reason: isSelf ? 'self' : null });
    }

    // ── Layer 2: phone index — check if this mobile placed the ref order ─
    // nimbuspost:phone:{mobile} is an lpush list of orderIds for that phone
    const orderIds = await kv.lrange(`nimbuspost:phone:${cleanMobile}`, 0, 49);
    if (orderIds && orderIds.includes(ref)) {
      // The customer's own phone number placed the referral order
      return res.json({ valid: false, reason: 'self' });
    }

    // Can't verify — allow (unknown order or new customer)
    return res.json({ valid: true });
  } catch {
    return res.json({ valid: true }); // KV unavailable, allow
  }
}
