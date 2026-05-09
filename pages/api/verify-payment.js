/**
 * POST /api/verify-payment
 * Called client-side after Razorpay payment succeeds.
 * 1. Verifies the Razorpay payment signature (server-side HMAC check).
 * 2. Fires a Meta CAPI Purchase event with full customer data.
 * 3. Returns { success, orderId } for the redirect.
 */
import crypto from 'crypto';
import { sendCapiPurchase } from '../../lib/meta-capi';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount,             // in paise (from Razorpay)
    pack, qty,
    name, mobile, email, city, pincode,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields' });
  }

  // ── 1. Verify Razorpay HMAC-SHA256 signature ──────────────────────────────
  const body              = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    console.error('Razorpay signature mismatch — possible tampered request');
    return res.status(400).json({ error: 'Payment verification failed' });
  }

  // ── 2. Build order ID + fire CAPI Purchase ─────────────────────────────────
  const orderId = `VED-PRE-${razorpay_payment_id}`;
  const price   = Math.round((amount || 0) / 100); // paise → rupees

  sendCapiPurchase({ orderId, price, pack, qty, email, mobile, name, city, pincode }).catch(() => {});

  return res.status(200).json({ success: true, orderId });
}
