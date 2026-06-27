// pages/api/admin/gp-withdrawals-all.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)            return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { partner_id } = req.query;

  let query = supabase
    .from('gp_withdrawals')
    .select('*')
    .order('requested_at', { ascending: false });

  if (partner_id) query = query.eq('partner_id', partner_id);

  const { data: withdrawals, error } = await query;

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ withdrawals: withdrawals || [] });
}
