// pages/api/admin/referrals.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  // All referrals where someone was referred (referrer_id is set)
  const { data, error } = await supabase
    .from('referrals')
    .select('referrer_id, discount, order_id, method')
    .not('referrer_id', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  // Group by referrer_id (each referrer_id is an order_id)
  const map = {};
  for (const r of (data || [])) {
    if (!map[r.referrer_id]) {
      map[r.referrer_id] = { referrerId: r.referrer_id, ordersReferred: 0, totalDiscount: 0 };
    }
    map[r.referrer_id].ordersReferred++;
    map[r.referrer_id].totalDiscount += r.discount || 0;
  }

  const referrerIds = Object.keys(map);
  if (referrerIds.length === 0) return res.json({ leaderboard: [] });

  // Get owner_mobile for each referrer's own order
  const { data: ownerRows } = await supabase
    .from('referrals')
    .select('order_id, owner_mobile')
    .in('order_id', referrerIds);

  const mobileMap = {};
  for (const row of (ownerRows || [])) mobileMap[row.order_id] = row.owner_mobile;

  // Get customer names from orders table
  const mobiles = [...new Set(Object.values(mobileMap))];
  const { data: customerRows } = await supabase
    .from('orders')
    .select('mobile, name')
    .in('mobile', mobiles)
    .order('created_at', { ascending: true });

  const nameMap = {};
  for (const c of (customerRows || [])) nameMap[c.mobile] = c.name;

  const leaderboard = Object.values(map)
    .map(entry => ({
      ...entry,
      mobile: mobileMap[entry.referrerId] || null,
      name:   nameMap[mobileMap[entry.referrerId]] || 'Unknown',
    }))
    .sort((a, b) => b.ordersReferred - a.ordersReferred)
    .slice(0, 50);

  return res.json({ leaderboard });
}
