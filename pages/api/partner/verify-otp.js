import { supabase } from '../../../lib/supabase';
import { makeGpToken, gpSessionCookie } from '../../../lib/gp-auth';

const MOBILE_RE = /^[6-9]\d{9}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { mobile, otp } = req.body || {};

  if (!mobile || !MOBILE_RE.test(mobile)) {
    return res.status(400).json({ error: 'Invalid mobile number' });
  }
  if (!otp || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Invalid OTP format' });
  }

  // Look up valid OTP
  const { data: otpRow } = await supabase
    .from('gp_otp')
    .select('otp, expires_at')
    .eq('mobile', mobile)
    .single();

  const valid =
    otpRow &&
    otpRow.otp === otp &&
    new Date(otpRow.expires_at) > new Date();

  if (!valid) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }

  // Delete the OTP row
  await supabase.from('gp_otp').delete().eq('mobile', mobile);

  // Check if partner exists
  const { data: partner } = await supabase
    .from('growth_partners')
    .select('id, handle')
    .eq('mobile', mobile)
    .single();

  if (partner) {
    const token = makeGpToken(partner.id);
    res.setHeader('Set-Cookie', gpSessionCookie(token));
    return res.json({ ok: true, registered: true });
  }

  return res.json({ ok: true, registered: false });
}
