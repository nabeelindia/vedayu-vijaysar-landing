/**
 * POST /api/create-order
 * Creates a Razorpay order server-side and returns the order_id + amount.
 * The frontend then opens the Razorpay checkout with these values.
 */
import Razorpay from 'razorpay';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, packName } = req.body;

  if (!amount || isNaN(amount) || amount < 1) {
    return res.status(400).json({ error: 'Invalid amount' });
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
      amount:   Math.round(amount) * 100, // Razorpay expects paise
      currency: 'INR',
      receipt:  `vedayu_${Date.now()}`,
      notes: {
        pack:    packName || 'Vijaysar Wooden Glass',
        brand:   'Vedayu',
        product: 'Vijaysar Wooden Herbal Glass / Tumbler',
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
