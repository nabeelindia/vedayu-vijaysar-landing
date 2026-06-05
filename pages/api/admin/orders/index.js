import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { method, status, search, page = '1' } = req.query;
  const pageSize = 50;
  const offset   = (parseInt(page) - 1) * pageSize;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (method && method !== 'all') query = query.eq('method', method);
  if (status && status !== 'all') query = query.eq('status', status);
  if (search) {
    query = query.or(
      `order_id.ilike.%${search}%,name.ilike.%${search}%,mobile.ilike.%${search}%,pincode.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ data, total: count, page: parseInt(page), pageSize });
}
