import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 자동 목 — 신호 발신만 가로챈다(events.ts가 상대경로로 불러오는 모듈과 같은 파일이라 같은 인스턴스가 목이 된다)
vi.mock('../lib/broadcast');

import { broadcastChange } from '../lib/broadcast';
import { createEvent, deleteEvent, listEvents, updateEvent, validateEventInput, validateEventPatch } from '../lib/events';
import { NotFoundError } from '../lib/storage/errors';

const mockBroadcast = vi.mocked(broadcastChange);
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'events-'));
  process.env.KANBAN_DATA_DIR = dir;
  mockBroadcast.mockClear();
});

afterEach(() => {
  delete process.env.KANBAN_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('validateEventInput', () => {
  it('정상 입력: 제목 트림, 시간 없음은 null, 담당자 미지정은 []', () => {
    expect(validateEventInput({ date: '2026-09-14', title: ' 호남연수원 방문 ' }))
      .toEqual({ date: '2026-09-14', time: null, title: '호남연수원 방문', members: [] });
    expect(validateEventInput({ date: '2026-09-14', time: '', title: 'x' }).time).toBeNull();
    expect(validateEventInput({ date: '2026-09-14', time: '14:00', title: 'x', members: ['모두'] }))
      .toEqual({ date: '2026-09-14', time: '14:00', title: 'x', members: ['모두'] });
  });

  it('잘못된 날짜·시간·제목·담당자·입력 자체는 RangeError', () => {
    expect(() => validateEventInput({ date: '9/14', title: 'x' })).toThrow(RangeError);
    expect(() => validateEventInput({ date: '2026-09-14', time: '2pm', title: 'x' })).toThrow(RangeError);
    expect(() => validateEventInput({ date: '2026-09-14', title: '' })).toThrow(RangeError);
    expect(() => validateEventInput({ date: '2026-09-14', title: 'x', members: ['외부인'] })).toThrow(RangeError);
    expect(() => validateEventInput(null)).toThrow(RangeError);
  });
});

describe('validateEventPatch', () => {
  it('온 필드만 검증해 돌려준다', () => {
    expect(validateEventPatch({ title: ' 새 제목 ' })).toEqual({ title: '새 제목' });
    expect(validateEventPatch({ time: null })).toEqual({ time: null });
    expect(validateEventPatch({ time: '' })).toEqual({ time: null });
    expect(validateEventPatch({ date: '2026-09-15', members: [] })).toEqual({ date: '2026-09-15', members: [] });
  });

  it('빈 patch·모르는 필드만·잘못된 값은 RangeError', () => {
    expect(() => validateEventPatch({})).toThrow(/바꿀 내용/);
    expect(() => validateEventPatch({ id: 'x' })).toThrow(/바꿀 내용/);
    expect(() => validateEventPatch({ title: '' })).toThrow(RangeError);
  });
});

describe('events (fs 모드)', () => {
  it('create → list 범위 조회, 정렬: 날짜 → 시간 없음 먼저 → 시간 → 생성 순', async () => {
    const b = await createEvent({ date: '2026-09-14', time: '14:00', title: '방문' });
    const a = await createEvent({ date: '2026-09-14', title: '종일' });
    const c = await createEvent({ date: '2026-09-14', time: '09:00', title: '아침' });
    const d = await createEvent({ date: '2026-09-13', time: '20:00', title: '전날' });
    const list = await listEvents('2026-09-13', '2026-09-14');
    expect(list.map((e) => e.id)).toEqual([d.id, a.id, c.id, b.id]);
    expect(await listEvents('2026-09-15', '2026-09-20')).toEqual([]);
  });

  it('listEvents: from>to·62일 초과·형식 오류는 RangeError', async () => {
    await expect(listEvents('2026-09-14', '2026-09-13')).rejects.toThrow(/늦어요/);
    await expect(listEvents('2026-09-01', '2026-11-01')).resolves.toEqual([]); // 9/1～11/1 = 62일: 허용
    await expect(listEvents('2026-09-01', '2026-11-02')).rejects.toThrow(/62일/);
    await expect(listEvents(null, '2026-09-13')).rejects.toThrow(RangeError);
  });

  it('update·delete: 반영되고 없는 id·uuid 아닌 id는 NotFoundError', async () => {
    const e = await createEvent({ date: '2026-09-14', title: '방문' });
    const u = await updateEvent(e.id, { time: '15:00', members: ['모두'] });
    expect(u).toEqual({ ...e, time: '15:00', members: ['모두'] });
    await deleteEvent(e.id);
    expect(await listEvents('2026-09-14', '2026-09-14')).toEqual([]);
    await expect(updateEvent(e.id, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteEvent(e.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteEvent('not-a-uuid')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('쓰기 성공마다 {kind:"events"} 신호, 실패면 신호 없음', async () => {
    const e = await createEvent({ date: '2026-09-14', title: '방문' });
    await updateEvent(e.id, { title: '방문2' });
    await deleteEvent(e.id);
    expect(mockBroadcast.mock.calls).toEqual([[{ kind: 'events' }], [{ kind: 'events' }], [{ kind: 'events' }]]);
    mockBroadcast.mockClear();
    await expect(createEvent({ date: 'bad', title: 'x' })).rejects.toThrow();
    await expect(deleteEvent(e.id)).rejects.toThrow();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
