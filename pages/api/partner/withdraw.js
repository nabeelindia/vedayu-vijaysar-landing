import { getGpSession } from '../../../lib/gp-auth';
import { supabase } from '../../../lib/supabase';
import { sendPush } from '../../../lib/push';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const partnerId = getGpSession(req);
  if (!partnerId) return res.status(401).json({ error: 'Unauthorized' });

  const { data: partner } = await supabase
    .from('growth_partners')
    .select('id, name, handle, kyc_verified')
    .eq('id', partnerId)
    .single();

  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  if (!partner.kyc_verified) {
    return res.status(403).json({ error: 'KYC verification required before withdrawal' });
  }

  const { data: earnings } = await supabase
    .from('gp_earnings')
    .select('amount')
    .eq('partner_id', partnerId)
    .eq('status', 'earned');

  const balance = (earnings || []).reduce((acc, e) => acc + (e.amount || 0), 0);

  if (balance < 500) {
    return res.status(400).json({ error: 'Minimum withdrawal is ₹500' });
  }

  // Check for existing pending withdrawal
  const { data: pending } = await supabase
    .from('gp_withdrawals')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('status', 'pending')
    .single();

  if (pending) {
    return res.status(409).json({ error: 'A withdrawal request is already pending' });
  }

  const { error: insertError } = await supabase
    .from('gp_withdrawals')
    .insert({ partner_id: partnerId, amount: balance, status: 'pending' });

  if (insertError) {
    if (insertError.code === '23505') {
      return res.status(409).json({ error: 'A withdrawal request is already pending' });
    }
    console.error('[withdraw] insert error:', insertError.message);
    return res.status(500).json({ error: 'Failed to create withdrawal request' });
  }

  // Admin push notification (non-blocking)
  sendPush({
    title: `💰 Withdrawal request — ${partner.name}`,
    body: `₹${balance} · ${partner.handle}`,
  }).catch(err => console.error('[withdraw] push error:', err));

  return res.json({ ok: true, amount: balance });
}
