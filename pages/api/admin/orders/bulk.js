import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

const ALLOWED_STATUSES = ['confirmed', 'sent', 'delivered', 'cancelled'];

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'POST') return res.status(405).end();

  const { orderIds, status, action } = req.body;
  if (!Array.isArray(orderIds) || orderIds.length === 0)
    return res.status(400).json({ error: 'orderIds required' });

  let updates;

  if (action === 'archive') {
    updates = { archived: true,  updated_at: new Date().toISOString() };
  } else if (action === 'unarchive') {
    updates = { archived: false, updated_at: new Date().toISOString() };
  } else {
    if (!ALLOWED_STATUSES.includes(status))
      return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    updates = { status, updated_at: new Date().toISOString() };
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('orders').update(updates).in('order_id', orderIds);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ updated: orderIds.length });
}
