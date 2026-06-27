import { Resend } from 'resend';
import { supabase } from '../../../lib/supabase';

const resend = new Resend(process.env.RESEND_API_KEY);

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { mobile, email } = req.body || {};

  if (!mobile || !MOBILE_RE.test(mobile)) {
    return res.status(400).json({ error: 'Invalid mobile number' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Rate limit: check if unexpired OTP already exists
  const { data: existing } = await supabase
    .from('gp_otp')
    .select('expires_at')
    .eq('mobile', mobile)
    .single();

  if (existing && new Date(existing.expires_at) > new Date()) {
    return res.status(429).json({ error: 'OTP already sent. Please wait before requesting a new one.' });
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Upsert OTP
  const { error: dbError } = await supabase
    .from('gp_otp')
    .upsert({ mobile, otp, expires_at }, { onConflict: 'mobile' });

  if (dbError) {
    console.error('[send-otp] DB error:', dbError);
    return res.status(500).json({ error: 'Failed to generate OTP' });
  }

  // Send OTP via email
  const { error: emailError } = await resend.emails.send({
    from: 'Vedayu Growth Partner <orders@vedayulife.com>',
    to: email,
    subject: `Your Vedayu Growth Partner OTP: ${otp}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #2d6a4f;">Vedayu Growth Partner</h2>
        <p>Your one-time password (OTP) to log in is:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1b4332; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #555;">This OTP is valid for <strong>10 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });

  if (emailError) {
    console.error('[send-otp] Email delivery failed:', emailError);
    // Remove the OTP so user isn't rate-limited on retry
    await supabase.from('gp_otp').delete().eq('mobile', mobile);
    return res.status(500).json({ error: 'Failed to send OTP email. Please try again.' });
  }

  return res.json({ ok: true });
}
