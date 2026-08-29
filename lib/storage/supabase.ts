import { NotFoundError, VersionConflictError } from './errors';
import type { CasWrite, StorageDriver } from './types';

// Supabase PostgREST 접근 — 서버 전용(service role, RLS 우회). SDK 없이 fetch만 쓴다(본체 /api/log 패턴).
// CAS는 name+version 필터의 조건부 PATCH: 갱신 0행이면 버전 충돌(또는 보드 없음)이다.

export function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function base(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
}

function headers(prefer?: string): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export async function sbRest(path: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
  const { prefer, ...rest } = init;
  return fetch(`${base()}/rest/v1${path}`, { ...rest, headers: headers(prefer) });
}

async function readRawSb(name: string): Promise<string> {
  const res = await sbRest(`/kanban_boards?name=eq.${encodeURIComponent(name)}&select=content`);
  if (!res.ok) throw new Error(`supabase read 실패: HTTP ${res.status}`);
  const rows: { content: string }[] = await res.json();
  if (rows.length === 0) throw new NotFoundError(`보드 없음: ${name}`);
  return rows[0].content;
}

export const supabaseDriver: StorageDriver = {
  async list() {
    const res = await sbRest('/kanban_boards?select=name');
    if (!res.ok) throw new Error(`supabase list 실패: HTTP ${res.status}`);
    const rows: { name: string }[] = await res.json();
    return rows.map((r) => r.name);
  },
  readRaw(name) {
    return readRawSb(name);
  },
  async casWrite({ name, expectedVersion, next, nextVersion }: CasWrite) {
    const res = await sbRest(
      `/kanban_boards?name=eq.${encodeURIComponent(name)}&version=eq.${encodeURIComponent(expectedVersion)}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: JSON.stringify({ content: next, version: nextVersion, updated_at: new Date().toISOString() }),
      },
    );
    if (!res.ok) throw new Error(`supabase write 실패: HTTP ${res.status}`);
    const rows: unknown[] = await res.json();
    if (rows.length === 0) {
      await readRawSb(name); // 보드 자체가 없으면 여기서 NotFoundError
      throw new VersionConflictError('보드가 그새 바뀌었어요');
    }
    return { version: nextVersion };
  },
  async casWritePair(dst, src) {
    const res = await fetch(`${base()}/rest/v1/rpc/kanban_move_card`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        dst_name: dst.name, dst_version: dst.expectedVersion, dst_content: dst.next, dst_new_version: dst.nextVersion,
        src_name: src.name, src_version: src.expectedVersion, src_content: src.next, src_new_version: src.nextVersion,
      }),
    });
    if (res.ok) return { version: src.nextVersion };
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    if (typeof body?.message === 'string' && body.message.includes('version-conflict')) {
      throw new VersionConflictError('보드가 그새 바뀌었어요');
    }
    throw new Error(`supabase move 실패: HTTP ${res.status}`);
  },
  async create(name, content, version) {
    const res = await sbRest('/kanban_boards', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({ name, content, version }),
    });
    if (res.status === 409) throw new Error(`이미 있는 보드: ${name}`);
    if (!res.ok) throw new Error(`supabase create 실패: HTTP ${res.status}`);
  },
  async trash(name) {
    const content = await readRawSb(name);
    const ins = await sbRest('/kanban_trash', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({ name, content }),
    });
    if (!ins.ok) throw new Error(`supabase trash 실패: HTTP ${ins.status}`);
    const del = await sbRest(`/kanban_boards?name=eq.${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!del.ok) throw new Error(`supabase delete 실패: HTTP ${del.status}`);
  },
};
