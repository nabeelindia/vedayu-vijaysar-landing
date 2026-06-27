import { supabase } from '../../../lib/supabase';
import { makeGpToken, gpSessionCookie } from '../../../lib/gp-auth';

const MOBILE_RE = /^[6-9]\d{9}$/;
const HANDLE_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,49}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESERVED_HANDLES = [
  'admin', 'partner', 'track', 'contact', 'order-confirmed',
  'privacy', 'terms', 'shipping-policy', 'refund-policy',
  'blog', 'ads', 'insights', 'api',
];

const VALID_PROFESSIONS = [
  'Doctor', 'Nutritionist', 'Yoga Instructor', 'Influencer', 'Other',
];

const REQUIRED_FIELDS = [
  'mobile', 'name', 'handle', 'email', 'profession',
  'city', 'bank_name', 'bank_account', 'bank_ifsc',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};

  // Check all required fields present
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || String(body[field]).trim() === '') {
      return res.status(400).json({ error: `${field} is required` });
    }
  }

  const {
    mobile, name, handle, email, profession,
    city, bank_name, bank_account, bank_ifsc,
  } = body;

  // Validate mobile
  if (!MOBILE_RE.test(mobile)) {
    return res.status(400).json({ error: 'Invalid mobile number' });
  }

  // Validate email
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Validate handle
  if (!HANDLE_RE.test(handle)) {
    return res.status(400).json({ error: 'Handle must be 3-50 characters, alphanumeric and hyphens only, and must start with a letter or number' });
  }
  if (RESERVED_HANDLES.includes(handle.toLowerCase())) {
    return res.status(400).json({ error: 'This handle is reserved. Please choose another.' });
  }

  // Validate profession
  if (!VALID_PROFESSIONS.includes(profession)) {
    return res.status(400).json({ error: 'Invalid profession' });
  }

  // Validate IFSC
  if (!IFSC_RE.test(bank_ifsc)) {
    return res.status(400).json({ error: 'Invalid IFSC code format' });
  }

  // Check handle uniqueness
  const { data: existingHandle } = await supabase
    .from('growth_partners')
    .select('id')
    .eq('handle', handle.toLowerCase())
    .single();

  if (existingHandle) {
    return res.status(409).json({ error: 'This handle is already taken. Please choose another.' });
  }

  // Check mobile uniqueness
  const { data: existingMobile } = await supabase
    .from('growth_partners')
    .select('id')
    .eq('mobile', mobile)
    .single();

  if (existingMobile) {
    return res.status(409).json({ error: 'This mobile number is already registered.' });
  }

  // Insert partner
  const { data: partner, error: insertError } = await supabase
    .from('growth_partners')
    .insert({
      mobile,
      name: name.trim(),
      handle: handle.toLowerCase(),
      email: email.trim().toLowerCase(),
      profession,
      city: city.trim(),
      bank_name: bank_name.trim(),
      bank_account: bank_account.trim(),
      bank_ifsc: bank_ifsc.trim().toUpperCase(),
    })
    .select('id, handle')
    .single();

  if (insertError || !partner) {
    console.error('[register] DB insert error:', insertError);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }

  const token = makeGpToken(partner.id);
  res.setHeader('Set-Cookie', gpSessionCookie(token));
  return res.json({ ok: true, handle: partner.handle });
}
