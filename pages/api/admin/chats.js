import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).end();

  const { tab } = req.query;
  let query = supabase
    .from('chat_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (tab === 'archived') {
    query = query.eq('archived', true);
  } else if (tab === 'active') {
    query = query.eq('admin_active', true).eq('archived', false);
  } else {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ sessions: data || [] });
}
