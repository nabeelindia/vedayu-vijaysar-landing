import { getGpSession } from '../../../lib/gp-auth';
import { supabase } from '../../../lib/supabase';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const VALID_PROFESSIONS = ['Doctor', 'Nutritionist', 'Yoga Instructor', 'Influencer', 'Other'];

export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();

  const partnerId = getGpSession(req);
  if (!partnerId) return res.status(401).json({ error: 'Unauthorized' });

  const { name, profession, city, bank_name, bank_account, bank_ifsc } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  if (!profession || !VALID_PROFESSIONS.includes(profession)) return res.status(400).json({ error: 'Invalid profession' });
  if (!city || !String(city).trim()) return res.status(400).json({ error: 'City is required' });
  if (!bank_name || !String(bank_name).trim()) return res.status(400).json({ error: 'Bank name is required' });
  if (!bank_account || !String(bank_account).trim()) return res.status(400).json({ error: 'Account number is required' });
  if (!bank_ifsc || !IFSC_RE.test(String(bank_ifsc).trim().toUpperCase())) {
    return res.status(400).json({ error: 'Invalid IFSC code format' });
  }

  const { error } = await supabase
    .from('growth_partners')
    .update({
      name: name.trim(),
      profession,
      city: city.trim(),
      bank_name: bank_name.trim(),
      bank_account: bank_account.trim(),
      bank_ifsc: bank_ifsc.trim().toUpperCase(),
    })
    .eq('id', partnerId);

  if (error) {
    console.error('[update-profile] DB error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }

  return res.json({ ok: true });
}
