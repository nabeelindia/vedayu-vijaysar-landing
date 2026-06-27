import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

// Required env var: GP_SESSION_SECRET
// Generate with: openssl rand -hex 32

function getSecret() {
  const s = process.env.GP_SESSION_SECRET;
  if (!s) throw new Error('GP_SESSION_SECRET env var not set');
  return s;
}

// Creates a signed session token containing partnerId
export function makeGpToken(partnerId) {
  const secret = getSecret();
  const payload = JSON.stringify({
    partnerId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    jti: randomUUID(),
  });
  const payload64 = Buffer.from(payload).toString('base64');
  const sig = createHmac('sha256', secret).update(payload64).digest('hex');
  return `${payload64}.${sig}`;
}

// Verifies cookie value, returns partnerId string or null
export function verifyGpToken(cookieValue) {
  if (!cookieValue) return null;
  try {
    const [payload64, sig] = cookieValue.split('.');
    if (!payload64 || !sig) return null;
    const secret = getSecret();
    const expected = createHmac('sha256', secret).update(payload64).digest('hex');
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const { partnerId, exp } = JSON.parse(Buffer.from(payload64, 'base64').toString());
    if (Date.now() >= exp) return null;
    return partnerId || null;
  } catch {
    return null;
  }
}

// Returns partnerId from request cookies, or null if invalid/missing
export function getGpSession(req) {
  return verifyGpToken(req.cookies?.gp_session ?? null);
}

export function gpSessionCookie(token) {
  const prod = process.env.NODE_ENV === 'production';
  return `gp_session=${token}; Path=/; Max-Age=${30 * 24 * 3600}; HttpOnly; SameSite=Lax;${prod ? ' Secure;' : ''}`;
}

export function gpClearCookie() {
  return 'gp_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;';
}
