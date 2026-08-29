import { describe, it, expect, afterEach, vi } from 'vitest';
import { broadcastChange } from '../lib/broadcast';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.unstubAllGlobals();
});

describe('broadcastChange', () => {
  it('env 미설정이면 fetch 자체를 안 부른다 (fs 모드 no-op)', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await broadcastChange({ kind: 'chat' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('발신 실패해도 throw하지 않는다', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(broadcastChange({ kind: 'board', board: '보드' })).resolves.toBeUndefined();
  });

  it('topic=kanban, event=change, payload 그대로 발신', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    const spy = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', spy);
    await broadcastChange({ kind: 'board', board: '보드' });
    expect(spy).toHaveBeenCalledWith(
      'https://test.supabase.co/realtime/v1/api/broadcast',
      expect.objectContaining({ method: 'POST' })
    );
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://test.supabase.co/realtime/v1/api/broadcast');
    const body = JSON.parse(String(init.body));
    expect(body.messages[0]).toMatchObject({
      topic: 'kanban', event: 'change', payload: { kind: 'board', board: '보드' },
    });
  });
});
