import { supabase } from '../../../../lib/supabase';
import { checkAdminAuth } from '../_auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId, content } = req.body || {};
  if (!sessionId || !content?.trim()) {
    return res.status(400).json({ error: 'sessionId and content are required' });
  }

  const { data: session, error: fetchErr } = await supabase
    .from('chat_sessions')
    .select('messages, admin_active')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (fetchErr || !session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (!session.admin_active) {
    return res.status(403).json({ error: 'Session is not in admin takeover mode' });
  }

  const newMessage = {
    role:      'admin',
    content:   content.trim(),
    timestamp: new Date().toISOString(),
  };
  const updatedMessages = [...(session.messages || []), newMessage];

  const { error: updateErr } = await supabase
    .from('chat_sessions')
    .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId);

  if (updateErr) {
    console.error('Admin message save error:', updateErr);
    return res.status(500).json({ error: 'Failed to save message' });
  }

  return res.status(200).json({ success: true, message: newMessage });
}
