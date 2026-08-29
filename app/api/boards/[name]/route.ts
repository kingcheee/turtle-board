import { NextResponse } from 'next/server';
import { readBoard, deleteBoard, NotFoundError } from '@/lib/store';

export const dynamic = 'force-dynamic';

function decodeName(name: string): string | null {
  try {
    return decodeURIComponent(name);
  } catch (e) {
    if (e instanceof URIError) return null;
    throw e;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeName(name);
  if (decoded === null) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  try {
    return NextResponse.json(await readBoard(decoded));
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeName(name);
  if (decoded === null) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  try {
    await deleteBoard(decoded);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof RangeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
