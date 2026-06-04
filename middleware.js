import { NextResponse } from 'next/server';

// Uses Web Crypto (available in Next.js Edge runtime) instead of Node crypto
async function verifyToken(token) {
  if (!token) return false;
  try {
    const [payload64, sig] = token.split('.');
    if (!payload64 || !sig) return false;

    const secret = process.env.SESSION_SECRET || 'dev-secret';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedBuf = await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(payload64)
    );
    const expected = Array.from(new Uint8Array(expectedBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    if (expected !== sig) return false;

    const { exp } = JSON.parse(atob(payload64));
    return Date.now() < exp;
  } catch {
    return false;
  }
}

export async function middleware(req) {
  const token = req.cookies.get('insights_session')?.value;
  if (!(await verifyToken(token))) {
    const loginUrl = new URL('/insights/login', req.url);
    loginUrl.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Match /insights AND /insights/* but NOT /insights/login
  matcher: ['/insights', '/insights/((?!login).*)'],
};
