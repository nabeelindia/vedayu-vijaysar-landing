// pages/api/admin/growth-partners.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)            return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { data: partners, error } = await supabase
    .from('growth_partners')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  if (!partners || partners.length === 0) return res.json({ partners: [] });

  // Fetch earnings stats for each partner
  const partnerIds = partners.map(p => p.id);
  const { data: earnings, error: eErr } = await supabase
    .from('gp_earnings')
    .select('partner_id, amount, status')
    .in('partner_id', partnerIds);

  if (eErr) return res.status(500).json({ error: eErr.message });

  const statsMap = {};
  for (const e of (earnings || [])) {
    if (!statsMap[e.partner_id]) statsMap[e.partner_id] = { orderCount: 0, totalEarned: 0 };
    statsMap[e.partner_id].orderCount++;
    if (e.status === 'earned') statsMap[e.partner_id].totalEarned += Number(e.amount || 0);
  }

  const result = partners.map(p => ({
    ...p,
    orderCount:  statsMap[p.id]?.orderCount  || 0,
    totalEarned: statsMap[p.id]?.totalEarned || 0,
  }));

  return res.json({ partners: result });
}
