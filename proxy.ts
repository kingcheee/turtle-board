import { NextRequest, NextResponse } from 'next/server';

async function sha256Hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function proxy(req: NextRequest) {
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!pass) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login' || pathname === '/favicon.ico' || pathname === '/icon.jpg') {
    return NextResponse.next();
  }
  const cookie = req.cookies.get('dash_auth')?.value;
  if (cookie && cookie === (await sha256Hex(pass))) return NextResponse.next();
  if (pathname.startsWith('/api/')) return new NextResponse('unauthorized', { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
