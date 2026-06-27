// pages/api/admin/gp-partner-earnings.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)            return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { partner_id } = req.query;
  if (!partner_id) return res.status(400).json({ error: 'partner_id required' });

  const { data: earnings, error } = await supabase
    .from('gp_earnings')
    .select('*')
    .eq('partner_id', partner_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ earnings: earnings || [] });
}
