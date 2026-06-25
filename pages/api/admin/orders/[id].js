import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });

  const { id } = req.query;

  if (req.method === 'GET') {
    const [orderRes, verifRes, notesRes, refundsRes, replRes] = await Promise.all([
      supabase.from('orders').select('*').eq('order_id', id).single(),
      supabase.from('cod_verifications').select('*').eq('order_id', id).maybeSingle(),
      supabase.from('order_notes').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      supabase.from('refunds').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      supabase.from('orders').select('order_id,pack,status,created_at').eq('replacement_for', id).order('created_at', { ascending: false }),
    ]);
    if (orderRes.error) return res.status(404).json({ error: 'Order not found' });

    // Fetch shipment tracking if order has an AWB
    let shipment = null;
    if (orderRes.data?.awb) {
      const { data: s } = await supabase
        .from('shipments').select('*').eq('awb', orderRes.data.awb).maybeSingle();
      shipment = s || null;
    }

    return res.json({
      order:        orderRes.data,
      verification: verifRes.data,
      notes:        notesRes.data   || [],
      refunds:      refundsRes.data || [],
      shipment,
      replacements: replRes.data    || [],
    });
  }

  if (req.method === 'PATCH') {
    const allowed = ['status', 'awb', 'courier', 'nimbuspost_order_id', 'label_url',
                     'sent_at', 'delivered_at', 'returned_at', 'return_reason', 'confirmed_at',
                     'scheduled_ship_date', 'archived', 'address_changed',
                     'name', 'mobile', 'email', 'address', 'city', 'state', 'pincode'];
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

  if (req.method === 'POST') {
    const { action } = req.query;

    if (action === 'note') {
      const { note } = req.body;
      if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
      const { data, error } = await supabase.from('order_notes')
        .insert({ order_id: id, note: note.trim() })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ note: data });
    }

    if (action === 'refund') {
      const { amount, method, note } = req.body;
      if (!amount || !method) return res.status(400).json({ error: 'Amount and method required' });
      const { data, error } = await supabase.from('refunds')
        .insert({ order_id: id, amount: parseInt(amount), method, note: note?.trim() || null })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ refund: data });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).end();
}
