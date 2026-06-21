import { createHmac, timingSafeEqual } from 'crypto';

function makeAdminToken() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('ADMIN_PASSWORD env var not set');
  const payload   = JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const payload64 = Buffer.from(payload).toString('base64');
  const sig       = createHmac('sha256', secret).update(payload64).digest('hex');
  return `${payload64}.${sig}`;
}

export default function handler(req, res) {
  if (req.method === 'GET' && req.query.logout) {
    res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
    return res.redirect('/admin/login');
  }
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  const expected     = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'ADMIN_PASSWORD not set' });

  let match = false;
  try {
    match = timingSafeEqual(Buffer.from(password || ''), Buffer.from(expected));
  } catch { match = false; }

  if (!match) {
    console.warn('[auth] admin login FAILED', { ip: req.headers['x-forwarded-for'] || 'unknown', ua: req.headers['user-agent'] });
    return res.status(401).json({ error: 'Wrong password' });
  }

  console.log('[auth] admin login OK', { ip: req.headers['x-forwarded-for'] || 'unknown' });
  const token = makeAdminToken();
  res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; Max-Age=${7 * 24 * 60 * 60}; HttpOnly; SameSite=Strict`);
  return res.json({ ok: true });
}
