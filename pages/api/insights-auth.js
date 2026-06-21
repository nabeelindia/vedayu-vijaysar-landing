import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

// Signs a token using the same HMAC-SHA256 + hex approach as the middleware
function makeToken() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET env var not set');
  const payload = JSON.stringify({ exp: Date.now() + 24 * 60 * 60 * 1000, jti: randomUUID() });
  const payload64 = Buffer.from(payload).toString('base64');
  const sig = createHmac('sha256', secret).update(payload64).digest('hex');
  return `${payload64}.${sig}`;
}

export default function handler(req, res) {
  // Logout
  if (req.method === 'GET' && req.query.logout) {
    res.setHeader('Set-Cookie', 'insights_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
    return res.redirect('/insights/login');
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  const expected = process.env.INSIGHTS_PASSWORD;

  if (!expected) return res.status(500).json({ error: 'INSIGHTS_PASSWORD not set' });

  if ((password || '').length > 200) return res.status(400).json({ error: 'Invalid' });
  let match = false;
  try {
    match = timingSafeEqual(Buffer.from(password || ''), Buffer.from(expected));
  } catch {
    match = false;
  }

  if (!match) {
    console.warn('[auth] insights login FAILED', { ip: req.headers['x-forwarded-for'] || 'unknown', ua: req.headers['user-agent'] });
    return res.status(401).json({ error: 'Wrong password' });
  }

  console.log('[auth] insights login OK', { ip: req.headers['x-forwarded-for'] || 'unknown' });
  const token = makeToken();
  const maxAge = 24 * 60 * 60;
  res.setHeader('Set-Cookie', `insights_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict`);
  return res.json({ ok: true });
}
