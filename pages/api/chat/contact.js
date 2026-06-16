import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  // 1. Return 405 for non-POST methods
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId, name, phone } = req.body;

  // 2. Validate sessionId
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return res.status(400).json({ error: 'sessionId is required and must be a non-empty string' });
  }

  // 2. Validate name
  const trimmedName = name && typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return res.status(400).json({ error: 'name is required and must be a non-empty string' });
  }

  // 2. Validate and clean phone
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'phone is required and must be a string' });
  }

  const cleaned = phone.replace(/\D/g, '').slice(-10);
  if (!/^[6-9][0-9]{9}$/.test(cleaned)) {
    return res.status(400).json({ error: 'Invalid mobile number' });
  }

  // 4. Update the chat_sessions row
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ contact_name: trimmedName, contact_phone: cleaned })
    .eq('session_id', sessionId)
    .select('id')
    .single();

  // 5. Handle error or missing row
  if (error || !data) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // 6. Return 200 with success
  return res.status(200).json({ success: true });
}
