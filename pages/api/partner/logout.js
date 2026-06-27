import { gpClearCookie } from '../../../lib/gp-auth';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Set-Cookie', gpClearCookie());
  return res.json({ ok: true });
}
