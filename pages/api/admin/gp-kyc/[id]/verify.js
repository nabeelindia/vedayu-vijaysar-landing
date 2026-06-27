// pages/api/admin/gp-kyc/[id]/verify.js
import { checkAdminAuth } from '../../../_auth';
import { supabase } from '../../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)            return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'PUT') return res.status(405).end();

  const { id } = req.query;

  const { error } = await supabase
    .from('growth_partners')
    .update({ kyc_verified: true, kyc_verified_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ ok: true });
}
