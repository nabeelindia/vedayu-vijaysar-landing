import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  // 1. Return 405 for non-POST methods
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId, rating } = req.body;

  // 2. Validate sessionId
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return res.status(400).json({ error: 'sessionId is required and must be a non-empty string' });
  }

  // 3. Validate rating
  if (rating !== 'up' && rating !== 'down') {
    return res.status(400).json({ error: 'rating must be "up" or "down"' });
  }

  // 4. Update the chat_sessions row
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ csat: rating })
    .eq('session_id', sessionId.trim())
    .select('id')
    .single();

  // 5. Handle error or missing row
  if (error || !data) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // 6. Return 200 with success
  return res.status(200).json({ success: true });
}
