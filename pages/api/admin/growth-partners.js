// pages/api/admin/growth-partners.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)            return res.status(503).json({ error: 'DB not configured' });
  if (req.method === 'POST') return handleCreate(req, res);
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
    if (e.status !== 'cancelled') statsMap[e.partner_id].orderCount++;
    if (e.status === 'earned') statsMap[e.partner_id].totalEarned += Number(e.amount || 0);
  }

  const result = partners.map(p => ({
    ...p,
    orderCount:  statsMap[p.id]?.orderCount  || 0,
    totalEarned: statsMap[p.id]?.totalEarned || 0,
  }));

  return res.json({ partners: result });
}

const HANDLE_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{2,49}$/;
const IFSC_RE   = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const PROFESSIONS = ['Doctor', 'Nutritionist', 'Yoga Instructor', 'Influencer', 'Other'];

async function handleCreate(req, res) {
  const { name, mobile, email, handle, profession, city,
          bank_name, bank_account, bank_ifsc } = req.body || {};

  if (!name?.trim())                          return res.status(400).json({ error: 'Name is required' });
  if (!mobile || !MOBILE_RE.test(mobile))     return res.status(400).json({ error: 'Invalid mobile number' });
  if (!handle || !HANDLE_RE.test(handle))     return res.status(400).json({ error: 'Handle must be 3-50 chars, letters/numbers/hyphens' });
  if (!PROFESSIONS.includes(profession))      return res.status(400).json({ error: 'Invalid profession' });
  if (bank_ifsc && !IFSC_RE.test(bank_ifsc))  return res.status(400).json({ error: 'Invalid IFSC code' });

  const { data, error } = await supabase
    .from('growth_partners')
    .insert({
      name: name.trim(),
      mobile,
      email:        email?.trim() || null,
      handle:       handle.trim().toLowerCase(),
      profession,
      city:         city?.trim() || null,
      bank_name:    bank_name?.trim() || null,
      bank_account: bank_account?.trim() || null,
      bank_ifsc:    bank_ifsc?.trim().toUpperCase() || null,
      kyc_verified: true,
      kyc_verified_at: new Date().toISOString(),
    })
    .select('id, handle')
    .single();

  if (error) {
    if (error.code === '23505') {
      const field = error.message.includes('mobile') ? 'mobile number' : 'handle';
      return res.status(409).json({ error: `This ${field} is already registered` });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ ok: true, id: data.id, handle: data.handle });
}
