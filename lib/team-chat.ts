import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { boardsDir } from './storage/fs';
import { hasSupabaseEnv, sbRest } from './storage/supabase';
import { broadcastChange } from './broadcast';
import { MEMBERS } from './members';

// 팀 채팅 저장소 — supabase 모드는 kanban_chat 테이블(최신 200개 조회), fs 모드(dev·테스트)는
// data/.team-chat.json(500개 캡, 쓰기 프로미스 큐 직렬화). 새 메시지는 Realtime 신호로 알린다.

export interface TeamChatMsg { id: string; sender: string; text: string; ts: string }

const MAX_TEXT = 2000;
const MAX_MESSAGES = 500;
const LIST_LIMIT = 200;
const SENDERS = new Set(MEMBERS.map((m) => m.name));

interface ChatState { queue: Promise<unknown> }
const g = globalThis as unknown as { __teamChat?: ChatState };
const state: ChatState = g.__teamChat ?? { queue: Promise.resolve() };
g.__teamChat = state;

function chatPath(): string {
  return join(boardsDir(), '.team-chat.json');
}

async function readAll(): Promise<TeamChatMsg[]> {
  try {
    return JSON.parse(await readFile(chatPath(), 'utf-8'));
  } catch {
    return [];
  }
}

function validate(sender: string, text: string): string {
  if (!SENDERS.has(sender)) throw new RangeError(`팀원이 아님: ${sender}`);
  const body = text.trim();
  if (!body) throw new RangeError('빈 메시지');
  if (body.length > MAX_TEXT) throw new RangeError(`메시지가 너무 길어요(최대 ${MAX_TEXT}자)`);
  return body;
}

export async function listMessages(): Promise<TeamChatMsg[]> {
  if (hasSupabaseEnv()) {
    const res = await sbRest(`/kanban_chat?select=id,sender,text,ts&order=ts.desc,id.desc&limit=${LIST_LIMIT}`);
    if (!res.ok) throw new Error(`chat 조회 실패: HTTP ${res.status}`);
    const rows: TeamChatMsg[] = await res.json();
    return rows.reverse();
  }
  return readAll();
}

export function appendMessage(sender: string, text: string): Promise<TeamChatMsg> {
  if (hasSupabaseEnv()) {
    return (async () => {
      const body = validate(sender, text);
      const res = await sbRest('/kanban_chat', {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify({ sender, text: body }),
      });
      if (!res.ok) throw new Error(`chat 저장 실패: HTTP ${res.status}`);
      const [row]: TeamChatMsg[] = await res.json();
      await broadcastChange({ kind: 'chat' });
      return row;
    })();
  }
  const job = state.queue.catch(() => {}).then(async () => {
    const body = validate(sender, text);
    const msg: TeamChatMsg = { id: randomUUID(), sender, text: body, ts: new Date().toISOString() };
    const msgs = [...(await readAll()), msg].slice(-MAX_MESSAGES);
    await writeFile(chatPath(), JSON.stringify(msgs), 'utf-8');
    await broadcastChange({ kind: 'chat' });
    return msg;
  });
  state.queue = job;
  return job;
}

export function _resetTeamChat(): void {
  state.queue = Promise.resolve();
}
