import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { password } = await req.json();
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || password !== expected) {
    return NextResponse.json({ error: '비밀번호가 틀려요' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('dash_auth', createHash('sha256').update(expected).digest('hex'), {
    httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/',
  });
  return res;
}
