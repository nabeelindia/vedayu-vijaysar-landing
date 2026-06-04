import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

function verifyToken(token) {
  if (!token) return false;
  try {
    const [payload64, sig] = token.split('.');
    if (!payload64 || !sig) return false;
    const secret = process.env.SESSION_SECRET || 'dev-secret';
    const expected = createHmac('sha256', secret).update(payload64).digest('hex');
    if (expected !== sig) return false;
    const { exp } = JSON.parse(Buffer.from(payload64, 'base64').toString());
    return Date.now() < exp;
  } catch {
    return false;
  }
}

export function middleware(req) {
  const token = req.cookies.get('insights_session')?.value;
  if (!verifyToken(token)) {
    const loginUrl = new URL('/insights/login', req.url);
    loginUrl.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Match /insights and /insights/* but NOT /insights/login
  matcher: ['/insights/((?!login).*)'],
};
