/**
 * GET /api/referral-validate?ref=VED-COD-XXXX&mobile=9876543210
 * Returns { valid: true } if the referral is not self-referral.
 * Returns { valid: false, reason: 'self' } if the customer is trying
 * to use their own referral link.
 */
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { ref, mobile } = req.query;
  if (!ref || !mobile) return res.status(400).json({ valid: false, reason: 'missing' });

  const cleanMobile = String(mobile).replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) return res.json({ valid: true }); // not a valid mobile yet

  try {
    const ownerMobile = await kv.get(`referral:owner:${ref}`);
    if (!ownerMobile) return res.json({ valid: true }); // unknown order, allow
    const isSelf = ownerMobile === cleanMobile;
    return res.json({ valid: !isSelf, reason: isSelf ? 'self' : null });
  } catch {
    return res.json({ valid: true }); // KV unavailable, allow
  }
}
