import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rowStore } from '../lib/storage/rows';
import { NotFoundError } from '../lib/storage/errors';

interface Note { id: string; date: string; title: string; created_at: string }

const store = () => rowStore<Note>('notes', '.notes.json');
const ROW: Note = { id: '11111111-1111-4111-8111-111111111111', date: '2026-09-11', title: 't', created_at: '2026-09-11T00:00:00Z' };
const BASE = 'https://test.supabase.co/rest/v1/notes';

let calls: { url: string; init?: RequestInit }[];

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function stubFetch(responder: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return responder(url, init);
  }));
}

const headers = (i: number) => calls[i].init?.headers as Record<string, string>;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  calls = [];
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.unstubAllGlobals();
});

describe('rowStore (supabase 모드)', () => {
  it('list: date 필터는 eq, from·to는 gte·lte 쿼리로; service key 헤더', async () => {
    stubFetch(() => jsonRes(200, [ROW]));
    expect(await store().list({ date: '2026-09-11' })).toEqual([ROW]);
    expect(calls[0].url).toBe(`${BASE}?date=eq.2026-09-11`);
    await store().list({ from: '2026-08-30', to: '2026-10-03' });
    expect(calls[1].url).toBe(`${BASE}?date=gte.2026-08-30&date=lte.2026-10-03`);
    await store().list({});
    expect(calls[2].url).toBe(BASE);
    expect(headers(0).apikey).toBe('test-service-key');
    expect(headers(0).Authorization).toBe('Bearer test-service-key');
  });

  it('insert: POST + return=representation, 생성된 행 반환', async () => {
    stubFetch(() => jsonRes(201, [ROW]));
    expect(await store().insert({ date: '2026-09-11', title: 't' })).toEqual(ROW);
    expect(calls[0].url).toBe(BASE);
    expect(calls[0].init?.method).toBe('POST');
    expect(headers(0).Prefer).toBe('return=representation');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ date: '2026-09-11', title: 't' });
  });

  it('get: id 필터, 0행이면 NotFoundError', async () => {
    stubFetch(() => jsonRes(200, [ROW]));
    expect(await store().get(ROW.id)).toEqual(ROW);
    expect(calls[0].url).toBe(`${BASE}?id=eq.${ROW.id}`);
    stubFetch(() => jsonRes(200, []));
    await expect(store().get(ROW.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('update: PATCH id 필터 + representation, 0행이면 NotFoundError', async () => {
    stubFetch(() => jsonRes(200, [{ ...ROW, title: 'u' }]));
    expect(await store().update(ROW.id, { title: 'u' })).toEqual({ ...ROW, title: 'u' });
    expect(calls[0].init?.method).toBe('PATCH');
    expect(calls[0].url).toBe(`${BASE}?id=eq.${ROW.id}`);
    expect(headers(0).Prefer).toBe('return=representation');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ title: 'u' });
    stubFetch(() => jsonRes(200, []));
    await expect(store().update(ROW.id, { title: 'u' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('remove: DELETE id 필터 + representation, 0행이면 NotFoundError', async () => {
    stubFetch(() => jsonRes(200, [ROW]));
    await store().remove(ROW.id);
    expect(calls[0].init?.method).toBe('DELETE');
    expect(calls[0].url).toBe(`${BASE}?id=eq.${ROW.id}`);
    expect(headers(0).Prefer).toBe('return=representation');
    stubFetch(() => jsonRes(200, []));
    await expect(store().remove(ROW.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('HTTP 오류는 Error로 (NotFoundError 아님)', async () => {
    stubFetch(() => jsonRes(500, {}));
    await expect(store().list({})).rejects.toThrow(/list 실패/);
    await expect(store().update(ROW.id, { title: 'u' })).rejects.toThrow(/update 실패/);
  });
});
