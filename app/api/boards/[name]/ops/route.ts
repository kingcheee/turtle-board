import { NextResponse } from 'next/server';
import { applyBoardOp, NotFoundError, VersionConflictError } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(name);
  } catch (e) {
    if (e instanceof URIError) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    throw e;
  }
  try {
    const { op, version } = await req.json();
    return NextResponse.json(await applyBoardOp(decoded, op, version));
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    if (e instanceof VersionConflictError) return NextResponse.json({ error: 'version-conflict' }, { status: 409 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof RangeError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof TypeError) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    throw e;
  }
}
