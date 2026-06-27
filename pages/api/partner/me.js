import { getGpSession } from '../../../lib/gp-auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const partnerId = getGpSession(req);
  if (!partnerId) return res.status(401).json({ error: 'Unauthorized' });

  const [{ data: partner, error: partnerError }, { data: earnings }, { data: withdrawals }] =
    await Promise.all([
      supabase.from('growth_partners').select('id, name, handle, email, mobile, profession, city, kyc_verified, kyc_verified_at, created_at, bank_name, bank_account, bank_ifsc').eq('id', partnerId).single(),
      supabase.from('gp_earnings').select('id, amount, status, created_at, order_id').eq('partner_id', partnerId).order('created_at', { ascending: false }),
      supabase.from('gp_withdrawals').select('id, amount, status, requested_at, completed_at, admin_note').eq('partner_id', partnerId).order('created_at', { ascending: false }),
    ]);

  if (partnerError || !partner) return res.status(404).json({ error: 'Partner not found' });

  // Wallet calculation
  const sum = (arr, status) =>
    (arr || []).filter(e => e.status === status).reduce((acc, e) => acc + (e.amount || 0), 0);

  const available = sum(earnings, 'earned');
  const locked = sum(earnings, 'in_transit');
  const pending = sum(earnings, 'pending');

  // Stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonth = (earnings || []).filter(e => e.created_at >= monthStart);

  const stats = {
    ordersAll: (earnings || []).length,
    ordersMonth: thisMonth.length,
    earnedAll: (earnings || []).filter(e => e.status === 'earned').reduce((acc, e) => acc + (e.amount || 0), 0),
    earnedMonth: thisMonth.filter(e => e.status === 'earned').reduce((acc, e) => acc + (e.amount || 0), 0),
  };

  return res.json({
    partner,
    earnings: earnings || [],
    withdrawals: withdrawals || [],
    wallet: { available, locked, pending },
    stats,
  });
}
