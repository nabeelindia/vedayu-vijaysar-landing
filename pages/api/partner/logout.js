import { gpClearCookie } from '../../../lib/gp-auth';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', gpClearCookie());
  if (req.method === 'GET') {
    return res.redirect(302, '/partner/login');
  }
  return res.json({ ok: true });
}
