import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  listBoards, readBoard, applyBoardOp, createBoard, deleteBoard, moveCardToBoard,
  VersionConflictError, NotFoundError,
} from '../lib/store';
import { existsSync, readdirSync } from 'node:fs';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kanban-'));
  process.env.KANBAN_DATA_DIR = dir;
  copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, '테스트 보드.md'));
});

afterEach(() => {
  delete process.env.KANBAN_DATA_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('store', () => {
  it('listBoards: .md만, AGENTS.md 제외', async () => {
    copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, 'AGENTS.md'));
    expect(await listBoards()).toEqual(['테스트 보드']);
  });

  it('readBoard: UiBoard + version', async () => {
    const b = await readBoard('테스트 보드');
    expect(b.name).toBe('테스트 보드');
    expect(b.columns).toHaveLength(6);
    expect(b.columns[0].cards[0].meta.title).toBe('파서 픽스처 카드 (t1)');
    expect(b.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('applyBoardOp: 적용 후 새 버전, 파일에 반영', async () => {
    const before = await readBoard('테스트 보드');
    const { version } = await applyBoardOp('테스트 보드',
      { type: 'add', column: 0, title: '저장 카드' }, before.version);
    expect(version).not.toBe(before.version);
    expect(readFileSync(join(dir, '테스트 보드.md'), 'utf-8')).toContain('**저장 카드**');
  });

  it('applyBoardOp add: 서버 로컬 시간으로 ⊕ 생성 토큰이 찍힌다', async () => {
    const { version } = await readBoard('테스트 보드');
    await applyBoardOp('테스트 보드', { type: 'add', column: 0, title: '시간 확인' }, version);
    const b = await readBoard('테스트 보드');
    const added = b.columns[0].cards[b.columns[0].cards.length - 1];
    expect(added.meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('버전 불일치 → VersionConflictError', async () => {
    await expect(applyBoardOp('테스트 보드',
      { type: 'add', column: 0, title: 'x' }, 'deadbeef0000'))
      .rejects.toBeInstanceOf(VersionConflictError);
  });

  it('동시 연산: 큐 직렬화로 하나는 성공, 낡은 버전은 충돌', async () => {
    const { version } = await readBoard('테스트 보드');
    const r = await Promise.allSettled([
      applyBoardOp('테스트 보드', { type: 'add', column: 0, title: 'a' }, version),
      applyBoardOp('테스트 보드', { type: 'add', column: 0, title: 'b' }, version),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason)
      .toBeInstanceOf(VersionConflictError);
  });

  it('없는 보드·경로 탈출 이름 → NotFoundError', async () => {
    await expect(readBoard('없는보드')).rejects.toBeInstanceOf(NotFoundError);
    await expect(readBoard('..\\..\\etc')).rejects.toBeInstanceOf(NotFoundError);
    await expect(readBoard('AGENTS')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('createBoard: 기본 6컬럼 템플릿, 중복이면 에러', async () => {
    await createBoard('새 보드');
    const b = await readBoard('새 보드');
    expect(b.columns.map((c) => c.title)).toEqual([
      '📥 아이디어', '📋 이번주', '🔨 진행중',
      '⏳ 대기중', '📅 할일', '✅ 완료',
    ]);
    await expect(createBoard('새 보드')).rejects.toThrow();
  });

  it('add 연산의 assignees가 #태그로 저장되고 다시 읽힌다', async () => {
    const { version } = await readBoard('테스트 보드');
    await applyBoardOp('테스트 보드',
      { type: 'add', column: 0, title: '담당 지정', assignees: ['김지우', '이원준'] }, version);
    expect(readFileSync(join(dir, '테스트 보드.md'), 'utf-8')).toContain('**담당 지정** #김지우 #이원준');
    const b = await readBoard('테스트 보드');
    const added = b.columns[0].cards[b.columns[0].cards.length - 1];
    expect(added.meta.assignees).toEqual(['김지우', '이원준']);
  });

  it('deleteBoard: 목록에서 빠지고 파일은 .trash로 이동(영구 삭제 아님)', async () => {
    await createBoard('지울 보드');
    await deleteBoard('지울 보드');
    expect(await listBoards()).toEqual(['테스트 보드']);
    expect(existsSync(join(dir, '지울 보드.md'))).toBe(false);
    const trashed = readdirSync(join(dir, '.trash'));
    expect(trashed).toHaveLength(1);
    expect(trashed[0].startsWith('지울 보드.md.')).toBe(true);
  });

  it('deleteBoard: 마지막 남은 보드는 RangeError로 거부', async () => {
    await expect(deleteBoard('테스트 보드')).rejects.toBeInstanceOf(RangeError);
    expect(await listBoards()).toEqual(['테스트 보드']);
  });

  it('deleteBoard: 없는 보드·불량 이름 → NotFoundError', async () => {
    await expect(deleteBoard('없는보드')).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteBoard('..\\..\\etc')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('동시 createBoard 같은 이름: 큐 직렬화로 하나 성공, 하나 실패', async () => {
    const r = await Promise.allSettled([
      createBoard('동시 보드'),
      createBoard('동시 보드'),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(r.filter((x) => x.status === 'rejected')).toHaveLength(1);
  });

  it('AGENTS 예약명: 대소문자 무시 → NotFoundError', async () => {
    await expect(readBoard('agents')).rejects.toBeInstanceOf(NotFoundError);
    await expect(readBoard('Agents')).rejects.toBeInstanceOf(NotFoundError);
    await expect(readBoard('AGENTS')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('moveCardToBoard: 원본에서 빠지고 같은 제목의 컬럼 끝에 붙는다', async () => {
    copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, '두번째 보드.md'));
    const src = await readBoard('테스트 보드');
    await moveCardToBoard('테스트 보드', src.version, { column: 0, index: 0 }, '두번째 보드');

    const after = await readBoard('테스트 보드');
    expect(after.columns[0].cards).toHaveLength(1);
    expect(after.columns[0].cards[0].meta.title).toBe('링크 카드');

    const target = await readBoard('두번째 보드');
    expect(target.columns[0].title).toBe('📥 Backlog');
    expect(target.columns[0].cards).toHaveLength(3);
    expect(target.columns[0].cards[2].meta.title).toBe('파서 픽스처 카드 (t1)');
  });

  it('moveCardToBoard: 여러 줄 설명도 그대로 옮겨진다', async () => {
    copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, '두번째 보드.md'));
    const src = await readBoard('테스트 보드');
    const raw = src.columns[0].cards[1].raw; // 설명 두 줄짜리 "링크 카드"
    await moveCardToBoard('테스트 보드', src.version, { column: 0, index: 1 }, '두번째 보드');
    const target = await readBoard('두번째 보드');
    expect(target.columns[0].cards[2].raw).toBe(raw);
  });

  it('moveCardToBoard: 같은 제목 컬럼이 없으면 첫 컬럼으로', async () => {
    await createBoard('새 보드'); // 템플릿 컬럼(한국어) — 픽스처 제목과 겹치지 않는다
    const src = await readBoard('테스트 보드');
    await moveCardToBoard('테스트 보드', src.version, { column: 2, index: 0 }, '새 보드');
    const target = await readBoard('새 보드');
    expect(target.columns[0].title).toBe('📥 아이디어');
    expect(target.columns[0].cards).toHaveLength(1);
    expect(target.columns[0].cards[0].meta.title).toBe('설명 없는 카드');
  });

  it('moveCardToBoard: 버전이 다르면 VersionConflictError', async () => {
    copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, '두번째 보드.md'));
    await expect(moveCardToBoard('테스트 보드', 'stale00000000', { column: 0, index: 0 }, '두번째 보드'))
      .rejects.toBeInstanceOf(VersionConflictError);
    expect((await readBoard('테스트 보드')).columns[0].cards).toHaveLength(2);
  });

  it('moveCardToBoard: 없는 대상 보드 → NotFoundError, 원본은 그대로', async () => {
    const src = await readBoard('테스트 보드');
    await expect(moveCardToBoard('테스트 보드', src.version, { column: 0, index: 0 }, '없는보드'))
      .rejects.toBeInstanceOf(NotFoundError);
    expect((await readBoard('테스트 보드')).columns[0].cards).toHaveLength(2);
  });

  it('moveCardToBoard: 같은 보드로는 거부 → RangeError', async () => {
    const src = await readBoard('테스트 보드');
    await expect(moveCardToBoard('테스트 보드', src.version, { column: 0, index: 0 }, '테스트 보드'))
      .rejects.toBeInstanceOf(RangeError);
  });

  it('moveCardToBoard: 범위 밖 카드 → RangeError, 대상은 그대로', async () => {
    copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, '두번째 보드.md'));
    const src = await readBoard('테스트 보드');
    await expect(moveCardToBoard('테스트 보드', src.version, { column: 0, index: 9 }, '두번째 보드'))
      .rejects.toBeInstanceOf(RangeError);
    expect((await readBoard('두번째 보드')).columns[0].cards).toHaveLength(2);
  });

  it('listBoards: 파이널 프로젝트가 있으면 맨 앞에 고정', async () => {
    await createBoard('파이널 프로젝트');
    await createBoard('가나다');
    expect(await listBoards()).toEqual(['파이널 프로젝트', '가나다', '테스트 보드']);
  });

  it('listBoards: agents.md 소문자도 제외', async () => {
    copyFileSync(join(__dirname, 'fixtures', 'basic.md'), join(dir, 'agents.md'));
    const boards = await listBoards();
    expect(boards).toEqual(['테스트 보드']);
    expect(boards).not.toContain('agents');
  });
});
