import { supabase } from '../../../../lib/supabase';
import { checkAdminAuth } from '../_auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId, action, adminName } = req.body || {};
  if (!sessionId || !['takeover', 'release', 'archive', 'unarchive'].includes(action)) {
    return res.status(400).json({ error: 'sessionId and valid action are required' });
  }

  let update = { updated_at: new Date().toISOString() };
  if (action === 'takeover')   update = { ...update, admin_active: true,  admin_name: adminName || 'Admin' };
  if (action === 'release')    update = { ...update, admin_active: false, admin_name: null };
  if (action === 'archive')    update = { ...update, archived: true };
  if (action === 'unarchive')  update = { ...update, archived: false };

  const { error } = await supabase
    .from('chat_sessions')
    .update(update)
    .eq('session_id', sessionId);

  if (error) {
    console.error('Takeover update error:', error);
    return res.status(500).json({ error: 'Failed to update session' });
  }

  return res.status(200).json({ success: true });
}
