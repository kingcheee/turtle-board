import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../lib/broadcast');

import { GET as eventsGet, POST as eventsPost } from '../app/api/events/route';
import { PATCH as eventPatch, DELETE as eventDelete } from '../app/api/events/[id]/route';

// 라우트 핸들러를 서버 없이 직접 부른다 — 상태 코드 매핑(400/404/201)이 라우트의 전부다
function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-'));
  process.env.KANBAN_DATA_DIR = dir;
});

afterEach(() => {
  delete process.env.KANBAN_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('/api/events', () => {
  it('GET: from·to 없으면 400, 있으면 {events}', async () => {
    expect((await eventsGet(req('GET', '/api/events'))).status).toBe(400);
    const r = await eventsGet(req('GET', '/api/events?from=2026-09-01&to=2026-09-30'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ events: [] });
  });

  it('POST → 201 {event}; 검증 실패 400; 깨진 JSON 400', async () => {
    const r = await eventsPost(req('POST', '/api/events', { date: '2026-09-14', time: '14:00', title: '방문', members: ['모두'] }));
    expect(r.status).toBe(201);
    const { event } = await r.json();
    expect(event).toMatchObject({ date: '2026-09-14', time: '14:00', end_time: null, title: '방문', members: ['모두'], done: false });
    const bad = await eventsPost(req('POST', '/api/events', { date: 'x', title: '방문' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/YYYY-MM-DD/);
    const broken = new Request('http://test/api/events', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } });
    expect((await eventsPost(broken)).status).toBe(400);
  });

  it('PATCH·DELETE: 반영, 잘못된 patch 400, 없는 id 404', async () => {
    const { event } = await (await eventsPost(req('POST', '/api/events', { date: '2026-09-14', title: '방문' }))).json();
    const d = await eventPatch(req('PATCH', `/api/events/${event.id}`, { done: true }), ctx(event.id));
    expect(d.status).toBe(200);
    expect((await d.json()).event.done).toBe(true);
    const p = await eventPatch(req('PATCH', `/api/events/${event.id}`, { title: '방문2' }), ctx(event.id));
    expect(p.status).toBe(200);
    expect((await p.json()).event.title).toBe('방문2');
    expect((await eventPatch(req('PATCH', `/api/events/${event.id}`, { title: '' }), ctx(event.id))).status).toBe(400);
    expect((await eventDelete(req('DELETE', `/api/events/${event.id}`), ctx(event.id))).status).toBe(200);
    expect((await eventDelete(req('DELETE', `/api/events/${event.id}`), ctx(event.id))).status).toBe(404);
    expect((await eventPatch(req('PATCH', '/api/events/nope', { title: 'x' }), ctx('nope'))).status).toBe(404);
  });
});
