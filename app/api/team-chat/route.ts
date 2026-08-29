import { NextResponse } from 'next/server';
import { appendMessage, listMessages } from '@/lib/team-chat';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ messages: await listMessages() });
}

export async function POST(req: Request) {
  try {
    const { sender, text } = await req.json();
    if (typeof sender !== 'string' || typeof text !== 'string') {
      return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    }
    return NextResponse.json({ msg: await appendMessage(sender, text) });
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    if (e instanceof RangeError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
