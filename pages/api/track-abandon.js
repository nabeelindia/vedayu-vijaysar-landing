/**
 * POST /api/track-abandon
 * Called via navigator.sendBeacon() when a user leaves the page
 * after partially filling the checkout form.
 * Sends an abandonment alert to the store owner.
 *
 * sendBeacon sends Content-Type: text/plain — Next.js body parser
 * doesn't handle that, so we disable it and read the raw stream.
 */
import { Resend } from 'resend';
import { waCartAbandon } from '../../lib/whatsapp';
import { supabase } from '../../lib/supabase';

export const config = {
  api: { bodyParser: false },
};

/** Read raw request body with a 5-second safety timeout. */
function readBody(req) {
  return new Promise((resolve) => {
    // Hard timeout — never hang the function if stream stalls
    const timer = setTimeout(() => resolve(''), 5000);
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { clearTimeout(timer); resolve(data); });
    req.on('error', () => { clearTimeout(timer); resolve(''); });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let body;
  try {
    const raw = await readBody(req);
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return res.status(200).end(); // don't error — beacon fire-and-forget
  }

  const { name, mobile, email, pack, payment } = body;
  if (!name?.trim() && !mobile?.trim()) return res.status(200).end();

  if (process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    try {
      const resend    = new Resend(process.env.RESEND_API_KEY);
      const packLabel = pack === 5 ? 'Pack of 5' : pack === 2 ? 'Pack of 2' : 'Pack of 1';
      const wa        = mobile ? `https://wa.me/91${mobile}` : null;
      const time      = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

      await resend.emails.send({
        from:    'Vedayu Orders <orders@vedayulife.com>',
        to:      process.env.ORDERS_EMAIL,
        subject: `⚠️ Cart Abandoned — ${name || 'Unknown'} ${mobile ? `(+91 ${mobile})` : ''}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2C1810;">
            <div style="background:#C9A84C;padding:18px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:#fff;margin:0;font-size:1.1rem;">⚠️ Cart Abandoned — Follow Up Needed</h2>
            </div>
            <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 16px;font-size:.9rem;color:#5C3D1E;">A customer started filling the order form but left without completing the purchase.</p>
              <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;width:40%;">Name</td><td style="padding:9px 0;">${name || '—'}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Mobile</td><td style="padding:9px 0;">${mobile ? `<a href="tel:+91${mobile}" style="color:#5C3D1E;">+91 ${mobile}</a>` : '—'}</td></tr>
                ${wa ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">WhatsApp</td><td style="padding:9px 0;"><a href="${wa}" style="color:#25D366;">Send WhatsApp message</a></td></tr>` : ''}
                ${email ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Email</td><td style="padding:9px 0;"><a href="mailto:${email}" style="color:#5C3D1E;">${email}</a></td></tr>` : ''}
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Selected Pack</td><td style="padding:9px 0;">${packLabel || '—'}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Payment Method</td><td style="padding:9px 0;">${payment === 'prepaid' ? 'Prepaid (was about to pay online)' : 'Cash on Delivery'}</td></tr>
                <tr><td style="padding:9px 0;font-weight:600;color:#3D2610;">Abandoned At</td><td style="padding:9px 0;">${time} IST</td></tr>
              </table>
              <div style="background:#FFF3E0;border-left:4px solid #C9A84C;padding:12px 16px;margin-top:20px;font-size:.82rem;color:#6D4C00;border-radius:0 6px 6px 0;">
                💡 <strong>Tip:</strong> Send a quick WhatsApp message within 30 minutes to recover this order. A friendly follow-up converts ~30% of abandoned carts.
              </div>
            </div>
            <p style="text-align:center;font-size:.74rem;color:#aaa;margin-top:16px;">Vedayu Wellness · vedayulife.com</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Abandon email failed:', err);
    }
  }

  // ── WhatsApp cart abandon (fires ~immediately, within seconds of leaving) ──
  const packLabel = pack === 5 ? 'Pack of 5' : pack === 2 ? 'Pack of 2' : 'Pack of 1';
  if (mobile) {
    await waCartAbandon({ mobile, name: name || 'there', pack: packLabel }).catch(() => {});
  }

  // ── Persist to Supabase for 24hr recovery cron ──────────────────────────
  if (supabase && mobile) {
    await supabase.from('cart_abandons').upsert({
      mobile,
      name:         name || null,
      pack:         packLabel,
      abandoned_at: new Date().toISOString(),
      wa_sent_at:   new Date().toISOString(),
      recovered:    false,
    }, { onConflict: 'mobile' }).catch(() => {});
  }

  return res.status(200).end();
}
