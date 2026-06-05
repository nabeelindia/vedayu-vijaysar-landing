import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [ordersRes, codRes] = await Promise.all([
    supabase.from('orders').select('order_id,method,status,price,created_at')
      .gte('created_at', thirtyDaysAgo),
    supabase.from('cod_verifications').select('status,created_at')
      .gte('created_at', thirtyDaysAgo),
  ]);

  const orders = ordersRes.data || [];
  const cods   = codRes.data    || [];

  const revenueByDay = {};
  for (const o of orders) {
    if (['cancelled', 'returned', 'pending'].includes(o.status)) continue;
    const day = o.created_at.slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] || 0) + (o.price || 0);
  }

  const totalRevenue = orders
    .filter(o => !['cancelled', 'returned', 'pending'].includes(o.status))
    .reduce((s, o) => s + (o.price || 0), 0);

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  return res.json({
    totalRevenue,
    totalOrders:  orders.length,
    revenueByDay,
    codCount:     orders.filter(o => o.method === 'cod').length,
    prepaidCount: orders.filter(o => o.method === 'prepaid').length,
    verification: {
      confirmed:     cods.filter(c => c.status === 'confirmed').length,
      autoConfirmed: cods.filter(c => c.status === 'auto_confirmed').length,
      cancelled:     cods.filter(c => c.status === 'cancelled').length,
      pending:       cods.filter(c => c.status === 'pending').length,
    },
  });
}
