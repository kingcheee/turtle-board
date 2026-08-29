import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 자동 목 — broadcastChange를 vi.fn()으로 갈아끼운다. store.ts가 상대경로로 불러오는
// 모듈과 같은 경로를 지정해야 같은 모듈 인스턴스가 목으로 바뀐다.
vi.mock('../lib/broadcast');

import { broadcastChange } from '../lib/broadcast';
import { listBoards, readBoard, applyBoardOp, moveCardToBoard, VersionConflictError } from '../lib/store';

const mockBroadcast = vi.mocked(broadcastChange);

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kanban-'));
  process.env.KANBAN_DATA_DIR = dir;
  copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, '테스트 보드.md'));
  mockBroadcast.mockClear();
});

afterEach(() => {
  delete process.env.KANBAN_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('store × broadcast 연동', () => {
  it('applyBoardOp 성공 → broadcastChange가 해당 보드로 호출된다', async () => {
    const before = await readBoard('테스트 보드');
    await applyBoardOp('테스트 보드', { type: 'add', column: 0, title: '방송 확인' }, before.version);
    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    expect(mockBroadcast).toHaveBeenCalledWith({ kind: 'board', board: '테스트 보드' });
  });

  it('applyBoardOp 버전 충돌 → 거부되고 broadcastChange는 호출되지 않는다', async () => {
    await expect(applyBoardOp('테스트 보드', { type: 'add', column: 0, title: 'x' }, 'deadbeef0000'))
      .rejects.toBeInstanceOf(VersionConflictError);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('moveCardToBoard 성공 → 대상 보드 먼저, 원본 보드 나중에 각각 broadcastChange 호출', async () => {
    copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, '두번째 보드.md'));
    const src = await readBoard('테스트 보드');
    await moveCardToBoard('테스트 보드', src.version, { column: 0, index: 0 }, '두번째 보드');

    expect(mockBroadcast).toHaveBeenCalledTimes(2);
    expect(mockBroadcast).toHaveBeenNthCalledWith(1, { kind: 'board', board: '두번째 보드' });
    expect(mockBroadcast).toHaveBeenNthCalledWith(2, { kind: 'board', board: '테스트 보드' });
  });
});

describe('VERCEL 가드 — fs 폴백 금지', () => {
  const savedVercel = process.env.VERCEL;

  beforeEach(() => {
    process.env.VERCEL = '1';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (savedVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = savedVercel;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('VERCEL=1인데 Supabase env가 없으면 listBoards가 Supabase 환경변수 누락으로 거부된다', async () => {
    await expect(listBoards()).rejects.toThrow(/Supabase 환경변수/);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('VERCEL=1인데 Supabase env가 없으면 applyBoardOp도 같은 이유로 거부된다', async () => {
    await expect(applyBoardOp('테스트 보드', { type: 'add', column: 0, title: 'x' }, 'deadbeef0000'))
      .rejects.toThrow(/Supabase 환경변수/);
  });
});
