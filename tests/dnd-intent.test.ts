import { describe, it, expect } from 'vitest';
import { resolveDrop, overColumn, overBoardName } from '../lib/kanban/dnd-intent';
import type { UiBoard } from '../lib/kanban/types';

function card(title: string) {
  return { raw: `- [ ] ${title}`, meta: { checked: false, priority: null, title, due: null, doneDate: null, assignees: [], createdAt: null, updatedAt: null, description: '' } };
}

// 0번 컬럼 2장 · 1번 컬럼 1장 · 2번 컬럼 0장
const board: UiBoard = {
  name: '파이널 프로젝트',
  version: 'v1',
  columns: [
    { title: '아이디어', cards: [card('a'), card('b')] },
    { title: '진행중', cards: [card('c')] },
    { title: '완료', cards: [] },
  ],
};

describe('resolveDrop — 보드 안에서', () => {
  it('다른 컬럼의 카드 위에 놓으면 그 자리로 이동', () => {
    expect(resolveDrop('c-0-0', 'c-1-0', board)).toEqual({
      kind: 'move', from: { column: 0, index: 0 }, to: { column: 1, index: 0 },
    });
  });

  it('같은 컬럼의 다른 카드 위에 놓으면 재정렬', () => {
    expect(resolveDrop('c-0-0', 'c-0-1', board)).toEqual({
      kind: 'move', from: { column: 0, index: 0 }, to: { column: 0, index: 1 },
    });
  });

  it('빈 컬럼 바탕에 놓으면 그 컬럼 끝으로', () => {
    expect(resolveDrop('c-0-0', 'col-2', board)).toEqual({
      kind: 'move', from: { column: 0, index: 0 }, to: { column: 2, index: 0 },
    });
  });

  it('다른 컬럼 바탕에 놓으면 그 컬럼 맨 끝(길이) 인덱스', () => {
    expect(resolveDrop('c-0-0', 'col-1', board)).toEqual({
      kind: 'move', from: { column: 0, index: 0 }, to: { column: 1, index: 1 },
    });
  });

  it('자기 컬럼 바탕에 놓으면 제거 후 기준(길이-1) 인덱스', () => {
    expect(resolveDrop('c-0-0', 'col-0', board)).toEqual({
      kind: 'move', from: { column: 0, index: 0 }, to: { column: 0, index: 1 },
    });
  });

  it('제자리에 놓으면 아무 것도 안 함', () => {
    expect(resolveDrop('c-0-0', 'c-0-0', board)).toEqual({ kind: 'none' });
  });
});

describe('resolveDrop — 보드 탭 위에', () => {
  it('다른 보드 탭에 놓으면 그 보드로 이동', () => {
    expect(resolveDrop('c-1-0', 'board-해커톤', board)).toEqual({
      kind: 'toBoard', from: { column: 1, index: 0 }, board: '해커톤',
    });
  });

  it('보드 이름에 하이픈이 있어도 온전히 읽는다', () => {
    expect(resolveDrop('c-0-0', 'board-2026-하반기 계획', board)).toEqual({
      kind: 'toBoard', from: { column: 0, index: 0 }, board: '2026-하반기 계획',
    });
  });

  it('지금 보고 있는 보드 탭에 놓으면 아무 것도 안 함', () => {
    expect(resolveDrop('c-0-0', 'board-파이널 프로젝트', board)).toEqual({ kind: 'none' });
  });
});

describe('하이라이트 대상 읽기', () => {
  it('overColumn: 카드 위면 그 카드의 컬럼', () => {
    expect(overColumn('c-2-3')).toBe(2);
  });

  it('overColumn: 컬럼 바탕이면 그 컬럼', () => {
    expect(overColumn('col-4')).toBe(4);
  });

  it('overColumn: 보드 탭·null·모르는 id면 null', () => {
    expect(overColumn('board-해커톤')).toBeNull();
    expect(overColumn(null)).toBeNull();
    expect(overColumn('뭐지')).toBeNull();
  });

  it('overBoardName: 보드 탭이면 이름', () => {
    expect(overBoardName('board-2026-하반기 계획')).toBe('2026-하반기 계획');
  });

  it('overBoardName: 카드·컬럼·null이면 null', () => {
    expect(overBoardName('c-0-0')).toBeNull();
    expect(overBoardName('col-1')).toBeNull();
    expect(overBoardName(null)).toBeNull();
  });
});

describe('resolveDrop — 방어', () => {
  it('놓은 곳이 없으면(null) 아무 것도 안 함', () => {
    expect(resolveDrop('c-0-0', null, board)).toEqual({ kind: 'none' });
  });

  it('컬럼 바탕을 끌면(카드가 아니면) 아무 것도 안 함', () => {
    expect(resolveDrop('col-0', 'col-1', board)).toEqual({ kind: 'none' });
  });

  it('없는 컬럼 위면 아무 것도 안 함', () => {
    expect(resolveDrop('c-0-0', 'col-9', board)).toEqual({ kind: 'none' });
  });

  it('모르는 id면 아무 것도 안 함', () => {
    expect(resolveDrop('c-0-0', '뭔가-이상한-id', board)).toEqual({ kind: 'none' });
  });
});
