import { checkAdminAuth } from './_auth';
import { supabase }        from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    let query = supabase
      .from('cart_abandons')
      .select('*')
      .order('abandoned_at', { ascending: false })
      .limit(200);

    if (req.query.recovered === 'true')  query = query.eq('recovered', true);
    if (req.query.recovered === 'false') query = query.eq('recovered', false);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ carts: data || [] });
  }

  if (req.method === 'PATCH') {
    const { mobile } = req.query;
    if (!mobile) return res.status(400).json({ error: 'mobile required' });

    const { data: existing } = await supabase
      .from('cart_abandons').select('recovered').eq('mobile', mobile).single();
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const recovered = !existing.recovered;
    const { error } = await supabase.from('cart_abandons').update({
      recovered,
      recovered_at: recovered ? new Date().toISOString() : null,
    }).eq('mobile', mobile);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, recovered });
  }

  return res.status(405).end();
}
