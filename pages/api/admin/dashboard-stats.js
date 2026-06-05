// pages/api/admin/dashboard-stats.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Today in IST: offset +5:30
  const istOffset  = 5.5 * 60 * 60 * 1000;
  const istNow     = new Date(now.getTime() + istOffset);
  const todayIST   = istNow.toISOString().slice(0, 10);
  const todayStart = `${todayIST}T00:00:00+05:30`;

  const [todayRes, awaitingRes, rtoRes, pendingCodRes] = await Promise.all([
    supabase.from('orders').select('price, status').gte('created_at', todayStart),
    supabase.from('orders')
      .select('order_id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'auto_confirmed'])
      .is('awb', null),
    supabase.from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('status', 'returned')
      .gte('returned_at', weekAgo),
    supabase.from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('method', 'cod'),
  ]);

  const todayOrders  = todayRes.data || [];
  const todayRevenue = todayOrders
    .filter(o => !['cancelled', 'returned'].includes(o.status))
    .reduce((s, o) => s + (o.price || 0), 0);

  return res.json({
    todayOrders:      todayOrders.length,
    todayRevenue,
    awaitingDispatch: awaitingRes.count || 0,
    rtosThisWeek:     rtoRes.count      || 0,
    pendingCodVerify: pendingCodRes.count || 0,
  });
}
