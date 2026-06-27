import { timingSafeEqual, createHmac } from 'crypto';
import { supabase } from '../../../lib/supabase';
import { makeGpToken, gpSessionCookie } from '../../../lib/gp-auth';

const MOBILE_RE = /^[6-9]\d{9}$/;

function makeVerifyToken(mobile) {
  const secret = process.env.GP_SESSION_SECRET;
  const exp = Date.now() + 15 * 60 * 1000; // 15 minutes
  const payload = Buffer.from(JSON.stringify({ mobile, exp })).toString('base64');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

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
    .select('otp, expires_at, attempts')
    .eq('mobile', mobile)
    .single();

  if (!otpRow || new Date(otpRow.expires_at) <= new Date()) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }

  // Lock out after 5 failed attempts
  if (otpRow.attempts >= 5) {
    await supabase.from('gp_otp').delete().eq('mobile', mobile);
    return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
  }

  // Timing-safe OTP comparison
  const otpBuf = Buffer.from(String(otpRow.otp));
  const inputBuf = Buffer.from(String(otp).slice(0, 6));
  if (otpBuf.length !== inputBuf.length || !timingSafeEqual(otpBuf, inputBuf)) {
    await supabase.from('gp_otp').update({ attempts: otpRow.attempts + 1 }).eq('mobile', mobile);
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

  return res.json({ ok: true, registered: false, verifyToken: makeVerifyToken(mobile) });
}
