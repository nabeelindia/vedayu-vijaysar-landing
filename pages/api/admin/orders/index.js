import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';
import { generateOrderId } from '../../../../lib/orders';
import { Resend } from 'resend';
import { sendPush } from '../../../../lib/push';
import { waOrderConfirmed } from '../../../../lib/whatsapp';

// ─── GET ─────────────────────────────────────────────────────────────────────

function getOrdersQuery({ method, status, search, page, archived, date_from, date_to }) {
  const pageSize = 50;
  const offset   = (parseInt(page || '1') - 1) * pageSize;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  query = query.eq('archived', archived === 'true');

  if (method && method !== 'all') query = query.eq('method', method);
  if (status && status !== 'all') {
    query = query.eq('status', status);
  } else {
    query = query.neq('status', 'cancelled');
  }
  if (search) {
    const safeSearch = search.replace(/[(),.|%_\\]/g, '');
    query = query.or(
      `order_id.ilike.%${safeSearch}%,name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,pincode.ilike.%${safeSearch}%`
    );
  }
  if (date_from) query = query.gte('created_at', date_from + 'T00:00:00+05:30');
  if (date_to)   query = query.lte('created_at', date_to   + 'T23:59:59.999+05:30');

  return { query, pageSize };
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─── POST helpers ─────────────────────────────────────────────────────────────

function buildOwnerEmail({ orderId, name, mobile, email, address, city, state, pincode,
                            pack, qty, price, method, isReplacement, replacementFor }) {
  const priceStr = isReplacement ? '₹0 (Free Replacement)' : `₹${Number(price).toLocaleString('en-IN')}`;
  const methodLabel = method === 'cod' ? 'COD' : method === 'prepaid' ? 'Prepaid' : 'Free';
  const icon = isReplacement ? '🔁' : method === 'cod' ? '🛒' : '💳';
  const fullAddr = [address, city, state, pincode].filter(Boolean).join(', ');

  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
  <div style="background:#5C3D1E;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:1.2rem;">${icon} ${isReplacement ? 'Replacement' : 'Admin-Created'} Order — Vedayu</h2>
  </div>
  <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;width:40%;">Order ID</td><td style="padding:10px 0;font-family:monospace;font-weight:700;">${orderId}</td></tr>
      ${isReplacement ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Replaces</td><td style="padding:10px 0;font-family:monospace;color:#856404;font-weight:700;">${esc(replacementFor)}</td></tr>` : ''}
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Customer</td><td style="padding:10px 0;">${esc(name)}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Mobile</td><td style="padding:10px 0;"><a href="tel:+91${esc(mobile)}" style="color:#5C3D1E;">+91 ${esc(mobile)}</a></td></tr>
      ${email ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Email</td><td style="padding:10px 0;">${esc(email)}</td></tr>` : ''}
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Address</td><td style="padding:10px 0;">${esc(fullAddr)}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Pack</td><td style="padding:10px 0;">${esc(pack)}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Qty</td><td style="padding:10px 0;">${esc(qty)} glass(es)</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Amount</td><td style="padding:10px 0;font-size:1.1rem;font-weight:700;color:${isReplacement ? '#4A7C59' : '#5C3D1E'};">${priceStr}</td></tr>
      <tr><td style="padding:10px 0;font-weight:600;color:#3D2610;">Method</td><td style="padding:10px 0;">${methodLabel}</td></tr>
    </table>
    <div style="background:#FFF8E1;border-left:4px solid #F9A825;padding:12px 16px;margin-top:20px;font-size:.82rem;color:#5C3D1E;border-radius:0 6px 6px 0;">
      ⚙️ This order was <strong>created manually by an admin</strong>.
    </div>
  </div>
</div>`;
}

function buildCustomerEmail({ orderId, name, pack, qty, price, address, city, state, pincode, isReplacement }) {
  const fullAddr = [address, city, state, pincode].filter(Boolean).join(', ');
  const priceStr = isReplacement ? '₹0' : `₹${Number(price).toLocaleString('en-IN')}`;

  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
  <div style="background:#5C3D1E;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;">Order Confirmed — Vedayu</h2>
  </div>
  <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;">Dear ${esc(name)},</p>
    ${isReplacement
      ? `<p style="margin:0 0 16px;">Your replacement order has been created. We will dispatch it to you within 1–2 business days.</p>`
      : `<p style="margin:0 0 16px;">Your order has been confirmed. We will dispatch it within 1–2 business days.</p>`
    }
    <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;width:40%;">Order ID</td><td style="padding:9px 0;font-family:monospace;font-weight:700;">${esc(orderId)}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Pack</td><td style="padding:9px 0;">${esc(pack)}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Qty</td><td style="padding:9px 0;">${esc(qty)} glass(es)</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Amount</td><td style="padding:9px 0;font-weight:700;">${priceStr}</td></tr>
      <tr><td style="padding:9px 0;font-weight:600;color:#3D2610;">Deliver to</td><td style="padding:9px 0;">${esc(fullAddr)}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:.82rem;color:#888;">
      Track your order at <a href="https://vedayulife.com/track?order=${esc(orderId)}" style="color:#5C3D1E;">vedayulife.com/track</a>
    </p>
  </div>
</div>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { method, status, search, page = '1', archived, date_from, date_to } = req.query;
    const { query, pageSize } = getOrdersQuery({ method, status, search, page, archived, date_from, date_to });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data, total: count, page: parseInt(page), pageSize });
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      name, mobile, email,
      address, city, state, pincode,
      pack, qty, price,
      method: paymentMethod,
      status,
      note,
      replacement_for,
    } = req.body;

    // Validate required fields
    const missing = ['name','mobile','address','city','state','pincode','pack','qty'].filter(f => !req.body[f]);
    if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

    const mobile10 = String(mobile).replace(/\D/g, '');
    if (mobile10.length !== 10) return res.status(400).json({ error: 'Mobile must be 10 digits' });
    if (String(pincode).replace(/\D/g, '').length !== 6) return res.status(400).json({ error: 'Pincode must be 6 digits' });

    const isReplacement = Boolean(replacement_for);
    const idMethod      = isReplacement ? 'replacement' : (paymentMethod || 'cod');
    const finalPrice    = isReplacement ? 0 : Number(price) || 0;
    const finalMethod   = isReplacement ? 'free' : (paymentMethod || 'cod');
    const finalStatus   = status || (isReplacement ? 'confirmed' : 'pending');

    // 1. Generate order ID
    const orderId = await generateOrderId(idMethod);

    // 2. Save to DB FIRST
    const { error: ordErr } = await supabase.from('orders').insert({
      order_id:        orderId,
      name:            name.trim(),
      mobile:          mobile10,
      email:           email?.trim() || null,
      address:         address.trim(),
      city:            city.trim(),
      state:           state.trim(),
      pincode:         String(pincode).trim(),
      pack,
      qty:             Number(qty),
      price:           finalPrice,
      method:          finalMethod,
      status:          finalStatus,
      replacement_for: replacement_for || null,
      created_by:      'admin',
    });

    if (ordErr) {
      console.error('[CRITICAL] admin orders.insert() failed:', ordErr.message, 'orderId:', orderId);
      sendPush({
        title: `⚠️ ADMIN ORDER LOST — ${name}`,
        body:  `DB write failed. ${orderId} NOT saved. ${mobile10}`,
      }).catch(() => {});
      return res.status(500).json({ error: 'Failed to save order. Please try again.' });
    }

    // 3. Save internal note if provided
    if (note?.trim()) {
      await supabase.from('order_notes').insert({ order_id: orderId, note: note.trim() });
    }

    // 4. Send notifications in parallel
    const priceStr = finalPrice ? `₹${Number(finalPrice).toLocaleString('en-IN')}` : '₹0';
    const notifications = [];

    if (process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
      const resend = new Resend(process.env.RESEND_API_KEY);

      notifications.push(
        resend.emails.send({
          from:    'Vedayu Orders <orders@vedayulife.com>',
          to:      process.env.ORDERS_EMAIL,
          subject: `${isReplacement ? '🔁 Replacement' : '⚙️ Admin'} Order — ${pack} — ${priceStr} | ${name}`,
          html:    buildOwnerEmail({ orderId, name, mobile: mobile10, email, address, city, state, pincode, pack, qty, price: finalPrice, method: finalMethod, isReplacement, replacementFor: replacement_for }),
        })
      );

      if (email?.trim()) {
        notifications.push(
          resend.emails.send({
            from:    'Vedayu <orders@vedayulife.com>',
            to:      email.trim(),
            subject: isReplacement
              ? `Your replacement order is confirmed — ${orderId} | Vedayu`
              : `Order confirmed — ${orderId} | Vedayu`,
            html:    buildCustomerEmail({ orderId, name, pack, qty, price: finalPrice, address, city, state, pincode, isReplacement }),
          })
        );
      }
    }

    notifications.push(
      waOrderConfirmed({ mobile: mobile10, name, pack, orderId, price: finalPrice, scheduledShipDate: null, method: finalMethod })
    );

    notifications.push(
      sendPush({
        title: `${isReplacement ? '🔁 Replacement' : '⚙️ Admin'} order — ${name}`,
        body:  `${pack} · ${priceStr} · ${mobile10}`,
      })
    );

    await Promise.allSettled(notifications);

    return res.status(201).json({ order_id: orderId });
  }

  return res.status(405).end();
}
