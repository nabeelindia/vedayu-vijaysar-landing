/**
 * POST /api/create-order
 * Creates a Razorpay order server-side and returns the order_id + amount.
 * The frontend then opens the Razorpay checkout with these values.
 */
import Razorpay from 'razorpay';
import { isNewCustomer } from './referral-validate';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, packName, customerName, referrerId, mobile, email, address, city, state, pincode, qty } = req.body;

  if (!amount || isNaN(amount) || amount < 1) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // ── New-customer guard: referral discount only applies to first-time customers.
  //    If the mobile has placed any order before, add the ₹50 discount back. ────
  let safeAmount = Math.round(amount);
  if (referrerId && mobile) {
    const newCust = await isNewCustomer(mobile);
    if (!newCust) {
      safeAmount = Math.round(safeAmount + 50);
      console.warn(`Referral discount denied — returning customer (prepaid): ${mobile}`);
    }
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
        customer_name: customerName || '',
        mobile:        mobile       || '',
        email:         email        || '',
        address_line:  address      || '',
        city:          city         || '',
        state:         state        || '',
        pincode:       pincode      || '',
        pack:          packName     || 'Vijaysar Wooden Glass',
        qty:           String(qty   || 1),
        brand:         'Vedayu',
        product:       'Vijaysar Wooden Herbal Glass / Tumbler',
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
