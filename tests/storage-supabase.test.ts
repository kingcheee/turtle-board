import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabaseDriver, hasSupabaseEnv } from '../lib/storage/supabase';
import { NotFoundError, VersionConflictError } from '../lib/storage/errors';

function jsonRes(status: number, body: unknown): Response {
  // 204 No Content and 201 Created with no body don't have a response body
  const isNoContent = status === 204 || (status === 201 && body === null);
  return new Response(isNoContent ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const W = { name: '보드', expectedVersion: 'aaaaaaaaaaaa', next: '# 내용', nextVersion: 'bbbbbbbbbbbb' };

let calls: { url: string; init: RequestInit | undefined }[];

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

function stubFetch(responder: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return responder(url, init);
  }));
}

describe('supabaseDriver', () => {
  it('hasSupabaseEnv: 두 env가 다 있어야 true', () => {
    expect(hasSupabaseEnv()).toBe(true);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(hasSupabaseEnv()).toBe(false);
  });

  it('readRaw: 빈 결과 → NotFoundError', async () => {
    stubFetch(() => jsonRes(200, []));
    await expect(supabaseDriver.readRaw('없는보드')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('readRaw: content 반환, 요청에 service key 헤더', async () => {
    stubFetch(() => jsonRes(200, [{ content: '# 보드' }]));
    expect(await supabaseDriver.readRaw('보드')).toBe('# 보드');
    const h = calls[0].init?.headers as Record<string, string>;
    expect(h.apikey).toBe('test-service-key');
    expect(h.Authorization).toBe('Bearer test-service-key');
  });

  it('casWrite 성공: PATCH URL에 name·version 필터, 새 버전 반환', async () => {
    stubFetch(() => jsonRes(200, [{ name: '보드' }]));
    expect(await supabaseDriver.casWrite(W)).toEqual({ version: 'bbbbbbbbbbbb' });
    expect(calls[0].url).toContain('name=eq.');
    expect(calls[0].url).toContain('version=eq.aaaaaaaaaaaa');
    expect(calls[0].init?.method).toBe('PATCH');
    // 검증: Prefer 헤더 (PostgREST 204 없이 반환값을 받으려면 필수)
    const h = calls[0].init?.headers as Record<string, string>;
    expect(h.Prefer).toBe('return=representation');
    // 검증: 요청 body에 content/version/updated_at
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.content).toBe('# 내용');
    expect(body.version).toBe('bbbbbbbbbbbb');
    expect(typeof body.updated_at).toBe('string');
  });

  it('casWrite: 갱신 0행 + 보드는 존재 → VersionConflictError', async () => {
    stubFetch((url) => (url.includes('select=content') ? jsonRes(200, [{ content: 'x' }]) : jsonRes(200, [])));
    await expect(supabaseDriver.casWrite(W)).rejects.toBeInstanceOf(VersionConflictError);
  });

  it('casWrite: 갱신 0행 + 보드 없음 → NotFoundError', async () => {
    stubFetch(() => jsonRes(200, []));
    await expect(supabaseDriver.casWrite(W)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('casWritePair: RPC 호출, version-conflict 메시지 → VersionConflictError', async () => {
    stubFetch(() => jsonRes(400, { message: 'version-conflict' }));
    await expect(supabaseDriver.casWritePair(W, { ...W, name: '원본' })).rejects.toBeInstanceOf(VersionConflictError);
    expect(calls[0].url).toContain('/rpc/kanban_move_card');
  });

  it('casWritePair 성공: src의 새 버전 반환', async () => {
    stubFetch(() => jsonRes(204, null));
    const src = { ...W, name: '원본', nextVersion: 'cccccccccccc' };
    expect(await supabaseDriver.casWritePair(W, src)).toEqual({ version: 'cccccccccccc' });
    // 검증: RPC 요청 body가 정확한 8개 파라미터를 가짐 (매핑: expectedVersion→*_version, next→*_content, nextVersion→*_new_version)
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body).toEqual({
      dst_name: '보드',
      dst_version: 'aaaaaaaaaaaa',
      dst_content: '# 내용',
      dst_new_version: 'bbbbbbbbbbbb',
      src_name: '원본',
      src_version: 'aaaaaaaaaaaa',
      src_content: '# 내용',
      src_new_version: 'cccccccccccc',
    });
  });

  it('create: 409 → 이미 있는 보드 Error', async () => {
    stubFetch(() => jsonRes(409, { message: 'duplicate key' }));
    await expect(supabaseDriver.create('보드', '#', 'aaaaaaaaaaaa')).rejects.toThrow('이미 있는 보드');
  });

  it('trash: 읽기 → trash insert → 본체 delete 순서', async () => {
    stubFetch((url, init) => {
      if (url.includes('select=content')) return jsonRes(200, [{ content: '# 보드' }]);
      if (url.includes('kanban_trash')) return jsonRes(201, null);
      if (init?.method === 'DELETE') return jsonRes(204, null);
      return jsonRes(500, {});
    });
    await supabaseDriver.trash('보드');
    expect(calls.map((c) => c.init?.method ?? 'GET')).toEqual(['GET', 'POST', 'DELETE']);
    expect(calls[1].url).toContain('kanban_trash');
    // 검증: trash insert body에 { name, content } 포함
    const insertBody = JSON.parse(calls[1].init?.body as string);
    expect(insertBody).toEqual({ name: '보드', content: '# 보드' });
    // 검증: DELETE URL이 같은 보드명을 대상으로 함
    expect(calls[2].url).toContain(`name=eq.${encodeURIComponent('보드')}`);
  });
});
