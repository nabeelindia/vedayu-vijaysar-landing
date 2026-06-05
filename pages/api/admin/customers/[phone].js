import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { phone } = req.query;

  const [ordersRes, waInRes, waOutRes, codRes] = await Promise.all([
    supabase.from('orders').select('*').eq('mobile', phone).order('created_at', { ascending: false }),
    supabase.from('wa_messages').select('*').eq('from_phone', phone).order('created_at', { ascending: true }),
    supabase.from('wa_outbound').select('*').eq('to_phone', phone).order('sent_at', { ascending: true }),
    supabase.from('cod_verifications').select('*').eq('mobile', phone).order('created_at', { ascending: false }),
  ]);

  const orders   = ordersRes.data || [];
  const waIn     = (waInRes.data  || []).map(m => ({ ...m, direction: 'in',  at: m.created_at }));
  const waOut    = (waOutRes.data || []).map(m => ({ ...m, direction: 'out', at: m.sent_at }));
  const waThread = [...waIn, ...waOut].sort((a, b) => new Date(a.at) - new Date(b.at));

  const totalSpend = orders
    .filter(o => !['cancelled', 'returned'].includes(o.status))
    .reduce((s, o) => s + (o.price || 0), 0);

  const profile = orders[0]
    ? { name: orders[0].name, mobile: orders[0].mobile, email: orders[0].email,
        city: orders[0].city, state: orders[0].state }
    : null;

  return res.json({ profile, orders, waThread, verifications: codRes.data || [], totalSpend });
}
