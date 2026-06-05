// pages/api/admin/push-test.js
import { checkAdminAuth } from './_auth';
import { sendPush } from '../../../lib/push';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).end();
  await sendPush({ title: '✅ Test notification', body: 'Push is working for Vedayu admin.' });
  return res.json({ ok: true });
}
