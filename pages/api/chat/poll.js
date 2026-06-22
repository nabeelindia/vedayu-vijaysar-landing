/**
 * GET /api/chat/poll?sessionId=XXX
 * Fallback endpoint for fetching the latest session state.
 * Primary delivery is via Supabase Realtime; this is used when
 * the Realtime subscription hasn't connected yet or as a recovery path.
 */
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId } = req.query;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('messages, admin_active, admin_name, updated_at')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('Poll error:', error);
    return res.status(500).json({ error: 'Failed to fetch session' });
  }

  if (!data) {
    return res.status(200).json({ messages: [], admin_active: false, admin_name: null });
  }

  return res.status(200).json({
    messages:     data.messages  || [],
    admin_active: data.admin_active || false,
    admin_name:   data.admin_name   || null,
    updated_at:   data.updated_at,
  });
}
