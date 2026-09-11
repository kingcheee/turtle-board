import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NotFoundError } from './errors';
import { boardsDir } from './fs';
import { storageMode } from './mode';
import { sbRest } from './supabase';

// 행 단위 저장소 — 일정·시간표처럼 행 하나가 독립인 데이터용. 보드(문서 통째 + 버전 CAS)와 달리
// insert/update/delete 각각이 마지막 쓰기 승리다. supabase 모드는 PostgREST 테이블,
// fs 모드(dev·테스트)는 data/<file> JSON 배열(파일별 프로미스 큐로 쓰기 직렬화).

export interface Row { id: string; date: string; created_at: string }

export interface RowFilter { date?: string; from?: string; to?: string } // from·to는 양끝 포함

export interface RowStore<T extends Row> {
  list(filter: RowFilter): Promise<T[]>; // 정렬은 호출자 몫
  /** 없으면 NotFoundError */
  get(id: string): Promise<T>;
  insert(row: Omit<T, 'id' | 'created_at'>): Promise<T>;
  /** 없으면 NotFoundError */
  update(id: string, patch: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T>;
  /** 없으면 NotFoundError */
  remove(id: string): Promise<void>;
}

function matches(row: Row, f: RowFilter): boolean {
  if (f.date !== undefined && row.date !== f.date) return false;
  if (f.from !== undefined && row.date < f.from) return false;
  if (f.to !== undefined && row.date > f.to) return false;
  return true;
}

function filterQuery(f: RowFilter): string {
  const q: string[] = [];
  if (f.date !== undefined) q.push(`date=eq.${encodeURIComponent(f.date)}`);
  if (f.from !== undefined) q.push(`date=gte.${encodeURIComponent(f.from)}`);
  if (f.to !== undefined) q.push(`date=lte.${encodeURIComponent(f.to)}`);
  return q.length ? `?${q.join('&')}` : '';
}

function supabaseRows<T extends Row>(table: string): RowStore<T> {
  const byId = (id: string) => `/${table}?id=eq.${encodeURIComponent(id)}`;
  return {
    async list(f) {
      const res = await sbRest(`/${table}${filterQuery(f)}`);
      if (!res.ok) throw new Error(`supabase ${table} list 실패: HTTP ${res.status}`);
      return res.json();
    },
    async get(id) {
      const res = await sbRest(byId(id));
      if (!res.ok) throw new Error(`supabase ${table} get 실패: HTTP ${res.status}`);
      const rows: T[] = await res.json();
      if (rows.length === 0) throw new NotFoundError(`없는 행: ${id}`);
      return rows[0];
    },
    async insert(row) {
      const res = await sbRest(`/${table}`, { method: 'POST', prefer: 'return=representation', body: JSON.stringify(row) });
      if (!res.ok) throw new Error(`supabase ${table} insert 실패: HTTP ${res.status}`);
      const [created]: T[] = await res.json();
      return created;
    },
    async update(id, patch) {
      const res = await sbRest(byId(id), { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(patch) });
      if (!res.ok) throw new Error(`supabase ${table} update 실패: HTTP ${res.status}`);
      const rows: T[] = await res.json();
      if (rows.length === 0) throw new NotFoundError(`없는 행: ${id}`);
      return rows[0];
    },
    async remove(id) {
      const res = await sbRest(byId(id), { method: 'DELETE', prefer: 'return=representation' });
      if (!res.ok) throw new Error(`supabase ${table} delete 실패: HTTP ${res.status}`);
      const rows: unknown[] = await res.json();
      if (rows.length === 0) throw new NotFoundError(`없는 행: ${id}`);
    },
  };
}

// 파일별 쓰기 큐 — globalThis에 매달아 dev 핫리로드로 모듈이 다시 평가돼도 큐는 하나만 산다.
interface FileState { queue: Promise<unknown> }
function fileState(file: string): FileState {
  const g = globalThis as unknown as Record<string, FileState | undefined>;
  return (g[`__rows:${file}`] ??= { queue: Promise.resolve() });
}

function fsRows<T extends Row>(file: string): RowStore<T> {
  const path = () => join(boardsDir(), file);
  async function readAll(): Promise<T[]> {
    try {
      return JSON.parse(await readFile(path(), 'utf-8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }
  function enqueue<R>(fn: () => Promise<R>): Promise<R> {
    const st = fileState(file);
    const job = st.queue.catch(() => {}).then(fn);
    st.queue = job;
    return job;
  }
  async function find(rows: T[], id: string): Promise<number> {
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) throw new NotFoundError(`없는 행: ${id}`);
    return i;
  }
  return {
    async list(f) {
      return (await readAll()).filter((r) => matches(r, f));
    },
    async get(id) {
      const rows = await readAll();
      return rows[await find(rows, id)];
    },
    insert(row) {
      return enqueue(async () => {
        const created = { ...row, id: randomUUID(), created_at: new Date().toISOString() } as T;
        await writeFile(path(), JSON.stringify([...(await readAll()), created]), 'utf-8');
        return created;
      });
    },
    update(id, patch) {
      return enqueue(async () => {
        const rows = await readAll();
        const i = await find(rows, id);
        rows[i] = { ...rows[i], ...patch };
        await writeFile(path(), JSON.stringify(rows), 'utf-8');
        return rows[i];
      });
    },
    remove(id) {
      return enqueue(async () => {
        const rows = await readAll();
        rows.splice(await find(rows, id), 1);
        await writeFile(path(), JSON.stringify(rows), 'utf-8');
      });
    },
  };
}

export function rowStore<T extends Row>(table: string, file: string): RowStore<T> {
  return storageMode() === 'supabase' ? supabaseRows<T>(table) : fsRows<T>(file);
}
