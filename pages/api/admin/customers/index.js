import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { search, page = '1' } = req.query;
  const pageSize = 50;
  const offset   = (parseInt(page) - 1) * pageSize;

  const { data, error } = await supabase
    .from('orders')
    .select('mobile, name, city, state, email')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate in JS: group by mobile
  const map = {};
  for (const o of (data || [])) {
    if (!map[o.mobile]) {
      map[o.mobile] = { mobile: o.mobile, name: o.name, city: o.city,
                        state: o.state, email: o.email, orderCount: 0 };
    }
    map[o.mobile].orderCount++;
  }

  let customers = Object.values(map);
  if (search) {
    const s = search.toLowerCase();
    customers = customers.filter(c =>
      c.name?.toLowerCase().includes(s) ||
      c.mobile?.includes(s) ||
      c.city?.toLowerCase().includes(s)
    );
  }

  const total = customers.length;
  const paged = customers.slice(offset, offset + pageSize);
  return res.json({ data: paged, total, page: parseInt(page), pageSize });
}
