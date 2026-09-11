import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../lib/broadcast');

import { broadcastChange } from '../lib/broadcast';
import { createBlock, deleteBlock, listBlocks, updateBlock, validateBlockInput, validateBlockPatch } from '../lib/timetable';
import { currentBlock, type TimeBlock } from '../lib/schedule';
import { NotFoundError } from '../lib/storage/errors';

const mockBroadcast = vi.mocked(broadcastChange);
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'timetable-'));
  process.env.KANBAN_DATA_DIR = dir;
  mockBroadcast.mockClear();
});

afterEach(() => {
  delete process.env.KANBAN_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('validateBlockInput', () => {
  it('정상: 제목 트림, done 기본 false', () => {
    expect(validateBlockInput({ date: '2026-09-11', start_time: '09:00', end_time: '09:40', title: ' 팀 리뷰 ', members: ['김지우'] }))
      .toEqual({ date: '2026-09-11', start_time: '09:00', end_time: '09:40', title: '팀 리뷰', members: ['김지우'], done: false });
  });

  it('끝 ≤ 시작, 시각 누락, done 비불리언은 RangeError', () => {
    expect(() => validateBlockInput({ date: '2026-09-11', start_time: '09:40', end_time: '09:00', title: 'x' })).toThrow(/늦어야/);
    expect(() => validateBlockInput({ date: '2026-09-11', start_time: '09:00', end_time: '09:00', title: 'x' })).toThrow(/늦어야/);
    expect(() => validateBlockInput({ date: '2026-09-11', start_time: '09:00', title: 'x' })).toThrow(/HH:MM/);
    expect(() => validateBlockInput({ date: '2026-09-11', start_time: '09:00', end_time: '10:00', title: 'x', done: 'yes' })).toThrow(/true\/false/);
  });
});

describe('validateBlockPatch', () => {
  const cur = { start_time: '09:00', end_time: '10:00' };

  it('시작·끝 하나만 오면 저장된 값과 합쳐 검사', () => {
    expect(validateBlockPatch({ end_time: '11:00' }, cur)).toEqual({ end_time: '11:00' });
    expect(() => validateBlockPatch({ end_time: '08:00' }, cur)).toThrow(/늦어야/);
    expect(() => validateBlockPatch({ start_time: '10:30' }, cur)).toThrow(/늦어야/);
    expect(validateBlockPatch({ start_time: '10:30', end_time: '11:00' }, cur)).toEqual({ start_time: '10:30', end_time: '11:00' });
  });

  it('done·제목·담당자는 되고, 날짜만 오면 바꿀 내용 없음', () => {
    expect(validateBlockPatch({ done: true }, cur)).toEqual({ done: true });
    expect(validateBlockPatch({ title: 'x', members: ['모두'] }, cur)).toEqual({ title: 'x', members: ['모두'] });
    expect(() => validateBlockPatch({ date: '2026-09-12' }, cur)).toThrow(/바꿀 내용/);
    expect(() => validateBlockPatch({}, cur)).toThrow(/바꿀 내용/);
  });
});

describe('currentBlock', () => {
  const mk = (start_time: string, end_time: string, id = start_time): TimeBlock =>
    ({ id, date: '2026-09-11', start_time, end_time, title: 't', members: [], done: false, created_at: '' });

  it('start ≤ now < end 인 첫 블록, 없으면 null', () => {
    const blocks = [mk('09:00', '09:40'), mk('09:40', '10:00', 'short'), mk('09:40', '12:00')];
    expect(currentBlock(blocks, '09:00')?.id).toBe('09:00');
    expect(currentBlock(blocks, '09:39')?.id).toBe('09:00');
    expect(currentBlock(blocks, '09:40')?.id).toBe('short');
    expect(currentBlock(blocks, '10:00')?.id).toBe('09:40');
    expect(currentBlock(blocks, '12:00')).toBeNull();
    expect(currentBlock([], '09:00')).toBeNull();
  });
});

describe('timetable (fs 모드)', () => {
  it('create → list(date) 정렬: 시작 → 끝 → 생성 순; 다른 날은 안 보인다', async () => {
    const b = await createBlock({ date: '2026-09-11', start_time: '09:40', end_time: '12:00', title: 'b' });
    const a = await createBlock({ date: '2026-09-11', start_time: '09:00', end_time: '09:40', title: 'a' });
    const c = await createBlock({ date: '2026-09-11', start_time: '09:40', end_time: '10:00', title: 'c' });
    await createBlock({ date: '2026-09-12', start_time: '09:00', end_time: '10:00', title: '다음날' });
    expect((await listBlocks('2026-09-11')).map((x) => x.id)).toEqual([a.id, c.id, b.id]);
    await expect(listBlocks('9/11')).rejects.toThrow(RangeError);
  });

  it('update: done 토글·시간 일부 변경, 없는 id는 NotFoundError', async () => {
    const b = await createBlock({ date: '2026-09-11', start_time: '09:00', end_time: '10:00', title: 'x' });
    expect((await updateBlock(b.id, { done: true })).done).toBe(true);
    expect((await updateBlock(b.id, { end_time: '11:00' })).end_time).toBe('11:00');
    await expect(updateBlock(b.id, { end_time: '08:00' })).rejects.toThrow(/늦어야/);
    await expect(updateBlock('11111111-1111-4111-8111-111111111111', { done: true })).rejects.toBeInstanceOf(NotFoundError);
    await deleteBlock(b.id);
    await expect(deleteBlock(b.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('쓰기 성공마다 {kind:"timetable"} 신호', async () => {
    const b = await createBlock({ date: '2026-09-11', start_time: '09:00', end_time: '10:00', title: 'x' });
    await updateBlock(b.id, { done: true });
    await deleteBlock(b.id);
    expect(mockBroadcast.mock.calls).toEqual([[{ kind: 'timetable' }], [{ kind: 'timetable' }], [{ kind: 'timetable' }]]);
  });
});
