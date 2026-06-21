import { NextResponse } from 'next/server';

async function verifyToken(token, secret) {
  if (!token) return false;
  try {
    const [payload64, sig] = token.split('.');
    if (!payload64 || !sig) return false;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const expectedBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload64));
    const expected = Array.from(new Uint8Array(expectedBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    if (expected !== sig) return false;
    const { exp } = JSON.parse(atob(payload64));
    return Date.now() < exp;
  } catch { return false; }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Admin protection
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token  = req.cookies.get('admin_session')?.value;
    const secret = process.env.ADMIN_PASSWORD || '';
    if (!(await verifyToken(token, secret))) {
      const url = new URL('/admin/login', req.url);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }

  // Insights protection (unchanged logic)
  if (pathname.startsWith('/insights') && pathname !== '/insights/login') {
    const token  = req.cookies.get('insights_session')?.value;
    const secret = process.env.SESSION_SECRET || '';
    if (!(await verifyToken(token, secret))) {
      const url = new URL('/insights/login', req.url);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/insights', '/insights/((?!login).*)', '/admin', '/admin/((?!login).*)'],
};
