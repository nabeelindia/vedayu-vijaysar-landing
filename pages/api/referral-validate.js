/**
 * GET /api/referral-validate?ref=VED-COD-XXXX&mobile=9876543210
 *
 * Returns { valid: true }  — new customer, referral discount applies.
 * Returns { valid: false, reason: 'returning' } — mobile has placed an
 *   order before; referral is for new customers only.
 *
 * Identification: mobile number looked up against orders table in Supabase.
 */
import { supabase } from '../../lib/supabase';

export async function isNewCustomer(mobile) {
  const cleanMobile = String(mobile || '').replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) return true;
  try {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('mobile', cleanMobile);
    if (error) return true;
    return count === 0;
  } catch {
    return true;
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
