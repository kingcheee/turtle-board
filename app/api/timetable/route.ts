import { NextResponse } from 'next/server';
import { createBlock, listBlocks } from '@/lib/timetable';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  try {
    return NextResponse.json({ blocks: await listBlocks(searchParams.get('date')) });
  } catch (e) {
    if (e instanceof RangeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    return NextResponse.json({ block: await createBlock(await req.json()) }, { status: 201 });
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    if (e instanceof RangeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
