import { supabase } from '../../../../lib/supabase';
import { checkAdminAuth } from '../_auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId, action, adminName } = req.body || {};
  if (!sessionId || !['takeover', 'release'].includes(action)) {
    return res.status(400).json({ error: 'sessionId and action (takeover|release) are required' });
  }

  const isTakeover = action === 'takeover';
  const { error } = await supabase
    .from('chat_sessions')
    .update({
      admin_active: isTakeover,
      admin_name:   isTakeover ? (adminName || 'Admin') : null,
      updated_at:   new Date().toISOString(),
    })
    .eq('session_id', sessionId);

  if (error) {
    console.error('Takeover update error:', error);
    return res.status(500).json({ error: 'Failed to update session' });
  }

  return res.status(200).json({ success: true });
}
