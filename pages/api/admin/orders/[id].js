import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });

  const { id } = req.query;

  if (req.method === 'GET') {
    const [orderRes, verifRes] = await Promise.all([
      supabase.from('orders').select('*').eq('order_id', id).single(),
      supabase.from('cod_verifications').select('*').eq('order_id', id).maybeSingle(),
    ]);
    if (orderRes.error) return res.status(404).json({ error: 'Order not found' });
    return res.json({ order: orderRes.data, verification: verifRes.data });
  }

  if (req.method === 'PATCH') {
    const allowed = ['status', 'awb', 'courier', 'nimbuspost_order_id', 'label_url',
                     'sent_at', 'delivered_at', 'returned_at'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('orders').update(updates).eq('order_id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ order: data });
  }

  return res.status(405).end();
}
