// pages/api/admin/orders/wa-send.js
import { checkAdminAuth } from '../_auth';
import { waDispatchUpdate, waCustomMessage } from '../../../../lib/whatsapp';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).end();

  const { orderId, type, customText } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  const { data: order } = await supabase
    .from('orders').select('mobile, name').eq('order_id', orderId).single();
  if (!order) return res.status(404).json({ error: 'Order not found' });

  try {
    if (type === 'dispatch') {
      await waDispatchUpdate({ mobile: order.mobile, name: order.name, orderId });
    } else if (type === 'custom') {
      if (!customText?.trim()) return res.status(400).json({ error: 'Message text required' });
      await waCustomMessage({ mobile: order.mobile, text: customText.trim() });
    } else {
      return res.status(400).json({ error: 'Unknown type' });
    }

    if (supabase) {
      await supabase.from('wa_outbound').insert({
        to_phone: order.mobile,
        message:  type === 'dispatch' ? `[Dispatch update] ${orderId}` : customText.trim(),
      }).then(() => {}, () => {});
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
