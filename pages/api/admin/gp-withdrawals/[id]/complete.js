// pages/api/admin/gp-withdrawals/[id]/complete.js
import { checkAdminAuth } from '../../../../../_auth';
import { supabase } from '../../../../../lib/supabase';
import { waCustomMessage } from '../../../../../lib/whatsapp';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)            return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'PUT') return res.status(405).end();

  const { id } = req.query;

  // Fetch withdrawal + partner details before updating
  const { data: withdrawal, error: fetchErr } = await supabase
    .from('gp_withdrawals')
    .select('*, growth_partners(name, mobile, bank_name, bank_account)')
    .eq('id', id)
    .single();

  if (fetchErr || !withdrawal) {
    return res.status(404).json({ error: 'Withdrawal not found' });
  }

  if (withdrawal.status !== 'pending') {
    return res.status(409).json({ error: 'Already completed' });
  }

  // Mark as completed
  const { error: updateErr } = await supabase
    .from('gp_withdrawals')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  // Send WhatsApp notification to partner
  const partner = withdrawal.growth_partners;
  if (partner?.mobile) {
    const last4 = String(partner.bank_account || '').slice(-4);
    const amount = Number(withdrawal.amount || 0).toLocaleString('en-IN');
    const bankName = partner.bank_name || 'bank';

    await waCustomMessage({
      mobile: partner.mobile,
      text: `Hi ${partner.name}, your Vedayu Growth Partner earnings of ₹${amount} have been transferred to your ${bankName} account ending ••••${last4}. Thank you for growing with us! — Team Vedayu`,
    }).catch(err => console.error('WhatsApp send failed:', err));
  }

  return res.json({ ok: true });
}
