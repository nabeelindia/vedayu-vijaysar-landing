/**
 * POST /api/miswak-upsell
 * Creates a ₹50 Razorpay order for the miswak post-purchase upsell.
 * Called from /order-confirmed after the customer opts in.
 */
import Razorpay from 'razorpay';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { orderId, name, mobile, email } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId is required' });

  try {
    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount:   5000,   // ₹50 in paise
      currency: 'INR',
      receipt:  `MISK-${Date.now()}`,
      notes: {
        product:      'miswak_upsell',
        parent_order: orderId,
        name:         name   || '',
        mobile:       mobile || '',
        email:        email  || '',
      },
    });

    return res.status(200).json({
      razorpayOrderId: order.id,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('miswak-upsell: Razorpay order creation failed', err);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
}
