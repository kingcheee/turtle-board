import { NextResponse } from 'next/server';
import { listBoards, createBoard } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ boards: await listBoards() });
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    await createBoard(name);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
