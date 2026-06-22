/**
 * POST /api/glass-upsell
 * Creates a single Razorpay order for all selected upsell glasses.
 * Called once when customer clicks "Pay" on the bag bar.
 */
import Razorpay from 'razorpay';
import { supabase } from '../../lib/supabase';

const VALID_PRICES = { 2: 399, 3: 349, 4: 299, 5: 249, 6: 299, 7: 249 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { orderId, glasses, name, mobile, email } = req.body;
  // glasses = [{ glass: 2, price: 399 }, { glass: 3, price: 349 }, ...]

  if (!orderId || !Array.isArray(glasses) || glasses.length === 0) {
    return res.status(400).json({ error: 'orderId and glasses[] are required' });
  }

  // Verify the parent order exists in DB before creating a payment
  const { data: parentOrder, error: lookupErr } = await supabase
    .from('orders')
    .select('id')
    .eq('order_id', orderId)
    .single();
  if (lookupErr || !parentOrder) {
    return res.status(404).json({ error: 'Order not found' });
  }

  for (const g of glasses) {
    if (VALID_PRICES[g.glass] !== Number(g.price)) {
      return res.status(400).json({ error: `Invalid price for glass ${g.glass}` });
    }
  }

  const total = glasses.reduce((sum, g) => sum + Number(g.price), 0);

  try {
    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount:          total * 100,   // paise
      currency:        'INR',
      receipt:         `GUPS-${Date.now()}`,
      payment_capture: 1,
      notes: {
        product:      'glass_upsell',
        glass_count:  String(glasses.length),
        parent_order: orderId,
        name:         name   || '',
        mobile:       mobile || '',
        email:        email  || '',
      },
    });

    return res.status(200).json({
      razorpayOrderId: order.id,
      key:             process.env.RAZORPAY_KEY_ID,
      total,
    });
  } catch (err) {
    console.error('glass-upsell: Razorpay order creation failed', err);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
}
