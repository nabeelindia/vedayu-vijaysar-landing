/**
 * POST /api/create-order
 * Creates a Razorpay order server-side and returns the order_id + amount.
 * The frontend then opens the Razorpay checkout with these values.
 */
import Razorpay from 'razorpay';
import { kv } from '@vercel/kv';

async function isSelfReferral(referrerId, mobile) {
  if (!referrerId || !mobile) return false;
  const cleanMobile = String(mobile).replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) return false;
  try {
    // Layer 1: direct owner lookup
    const ownerMobile = await kv.get(`referral:owner:${referrerId}`);
    if (ownerMobile) return ownerMobile === cleanMobile;
    // Layer 2: phone → orderIds index
    const orderIds = await kv.lrange(`nimbuspost:phone:${cleanMobile}`, 0, 49);
    if (orderIds?.includes(referrerId)) return true;
  } catch {}
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, packName, customerName, referrerId, mobile } = req.body;

  if (!amount || isNaN(amount) || amount < 1) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // ── Self-referral guard: if customer is using their own link,
  //    add the ₹50 back regardless of what the frontend sent ──────────────
  let safeAmount = Math.round(amount);
  if (referrerId && mobile && await isSelfReferral(referrerId, mobile)) {
    safeAmount = Math.round(safeAmount + 50);
    console.warn(`Self-referral blocked server-side: ${referrerId} by ${mobile}`);
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('Razorpay keys not configured');
    return res.status(500).json({ error: 'Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your environment variables.' });
  }

  try {
    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount:          safeAmount * 100, // Razorpay expects paise
      currency:        'INR',
      receipt:         `vedayu_${Date.now()}`,
      payment_capture: 1, // auto-capture on authorization — no manual capture needed
      notes: {
        customer: customerName || '',
        pack:     packName || 'Vijaysar Wooden Glass',
        brand:    'Vedayu',
        product:  'Vijaysar Wooden Herbal Glass / Tumbler',
      },
    });

    return res.status(200).json({
      order_id: order.id,
      amount:   order.amount,  // in paise
      currency: order.currency,
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    return res.status(500).json({ error: 'Failed to create payment order. Please try again.' });
  }
}
