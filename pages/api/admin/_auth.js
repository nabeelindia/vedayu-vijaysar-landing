import { createHmac, timingSafeEqual } from 'crypto';

export function checkAdminAuth(req) {
  const token = req.cookies?.admin_session;
  if (!token) return false;
  try {
    const [payload64, sig] = token.split('.');
    if (!payload64 || !sig) return false;
    const secret = process.env.ADMIN_PASSWORD;
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(payload64).digest('hex');
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
    const { exp } = JSON.parse(Buffer.from(payload64, 'base64').toString());
    return Date.now() < exp;
  } catch { return false; }
}
