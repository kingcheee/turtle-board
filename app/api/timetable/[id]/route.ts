import { NextResponse } from 'next/server';
import { deleteBlock, updateBlock } from '@/lib/timetable';
import { NotFoundError } from '@/lib/storage/errors';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    return NextResponse.json({ block: await updateBlock(id, await req.json()) });
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof RangeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await deleteBlock(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
