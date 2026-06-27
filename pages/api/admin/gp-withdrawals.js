// pages/api/admin/gp-withdrawals.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)            return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { data: withdrawals, error } = await supabase
    .from('gp_withdrawals')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  if (!withdrawals || withdrawals.length === 0) return res.json({ withdrawals: [] });

  // Fetch partner details for each withdrawal
  const partnerIds = [...new Set(withdrawals.map(w => w.partner_id))];
  const { data: partners, error: pErr } = await supabase
    .from('growth_partners')
    .select('id, name, handle, profession, city, mobile, bank_name, bank_account, bank_ifsc')
    .in('id', partnerIds);

  if (pErr) return res.status(500).json({ error: pErr.message });

  const partnerMap = {};
  for (const p of (partners || [])) partnerMap[p.id] = p;

  const result = withdrawals.map(w => ({
    ...w,
    partner: partnerMap[w.partner_id] || null,
  }));

  return res.json({ withdrawals: result });
}
