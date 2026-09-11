import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rowStore } from '../lib/storage/rows';
import { NotFoundError } from '../lib/storage/errors';

interface Note { id: string; date: string; title: string; created_at: string }

let dir: string;
const store = () => rowStore<Note>('notes', '.notes.json');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rows-'));
  process.env.KANBAN_DATA_DIR = dir;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  delete process.env.KANBAN_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('rowStore (fs 모드)', () => {
  it('파일이 없으면 빈 목록', async () => {
    expect(await store().list({})).toEqual([]);
  });

  it('insert: id·created_at이 붙고 파일에 저장된다', async () => {
    const n = await store().insert({ date: '2026-09-11', title: '첫 행' });
    expect(n.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(n.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(n.title).toBe('첫 행');
    expect(existsSync(join(dir, '.notes.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, '.notes.json'), 'utf-8'))).toEqual([n]);
  });

  it('list: date / from·to 필터 (양끝 포함)', async () => {
    await store().insert({ date: '2026-09-10', title: 'a' });
    await store().insert({ date: '2026-09-11', title: 'b' });
    await store().insert({ date: '2026-09-12', title: 'c' });
    expect((await store().list({ date: '2026-09-11' })).map((n) => n.title)).toEqual(['b']);
    expect((await store().list({ from: '2026-09-11', to: '2026-09-12' })).map((n) => n.title)).toEqual(['b', 'c']);
    expect((await store().list({ from: '2026-09-13' })).map((n) => n.title)).toEqual([]);
  });

  it('get: 있으면 행, 없으면 NotFoundError', async () => {
    const n = await store().insert({ date: '2026-09-11', title: 'x' });
    expect(await store().get(n.id)).toEqual(n);
    await expect(store().get('없음')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('update: 부분 갱신, 없는 id는 NotFoundError', async () => {
    const n = await store().insert({ date: '2026-09-11', title: 'x' });
    const u = await store().update(n.id, { title: 'y' });
    expect(u).toEqual({ ...n, title: 'y' });
    expect(await store().list({})).toEqual([u]);
    await expect(store().update('없음', { title: 'z' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('remove: 지워지고, 없는 id는 NotFoundError', async () => {
    const n = await store().insert({ date: '2026-09-11', title: 'x' });
    await store().remove(n.id);
    expect(await store().list({})).toEqual([]);
    await expect(store().remove(n.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('동시 insert 3건이 전부 보존된다 (쓰기 직렬화)', async () => {
    await Promise.all([1, 2, 3].map((i) => store().insert({ date: '2026-09-11', title: `t${i}` })));
    expect((await store().list({})).map((n) => n.title).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('다른 파일은 서로 안 섞인다', async () => {
    await store().insert({ date: '2026-09-11', title: 'notes' });
    expect(await rowStore<Note>('other', '.other.json').list({})).toEqual([]);
  });
});
