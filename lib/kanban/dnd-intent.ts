import type { UiBoard } from './types';

// 드래그 id ↔ 의미 변환. dnd-kit이 주는 "무엇을 어디에 놓았나"(문자열 id 두 개)를
// 보드 연산으로 옮기는 순수 함수 — 인덱스 계산이 여기 한 곳에만 있게 한다.

export interface Pos { column: number; index: number }

export type DropIntent =
  | { kind: 'none' }
  | { kind: 'move'; from: Pos; to: Pos }
  | { kind: 'toBoard'; from: Pos; board: string };

const NONE: DropIntent = { kind: 'none' };
const BOARD_PREFIX = 'board-';

export const cardId = (column: number, index: number) => `c-${column}-${index}`;
export const columnId = (column: number) => `col-${column}`;
// 보드 이름은 하이픈·공백을 포함할 수 있어 접두어만 떼고 통째로 쓴다.
export const boardTabId = (name: string) => `${BOARD_PREFIX}${name}`;

function parseCard(id: string): Pos | null {
  const m = id.match(/^c-(\d+)-(\d+)$/);
  return m ? { column: Number(m[1]), index: Number(m[2]) } : null;
}

// 드래그 중 하이라이트용 — "지금 포인터 밑에 있는 것"만 알려준다(옮길 수 있는지는 따지지 않는다).
export function overColumn(overId: string | null): number | null {
  if (!overId) return null;
  const card = parseCard(overId);
  if (card) return card.column;
  const m = overId.match(/^col-(\d+)$/);
  return m ? Number(m[1]) : null;
}

export function overBoardName(overId: string | null): string | null {
  if (!overId?.startsWith(BOARD_PREFIX)) return null;
  return overId.slice(BOARD_PREFIX.length) || null;
}

export function resolveDrop(activeId: string, overId: string | null, board: UiBoard): DropIntent {
  const from = parseCard(activeId);
  if (!from || !overId) return NONE;

  if (overId.startsWith(BOARD_PREFIX)) {
    const name = overId.slice(BOARD_PREFIX.length);
    return name && name !== board.name ? { kind: 'toBoard', from, board: name } : NONE;
  }

  const overCard = parseCard(overId);
  if (overCard) {
    if (!board.columns[overCard.column]) return NONE;
    return from.column === overCard.column && from.index === overCard.index
      ? NONE
      : { kind: 'move', from, to: overCard };
  }

  const m = overId.match(/^col-(\d+)$/);
  if (!m) return NONE;
  const column = Number(m[1]);
  const target = board.columns[column];
  if (!target) return NONE;
  // 컬럼 바탕에 놓으면 맨 끝으로. 같은 컬럼이면 자기를 뺀 뒤 기준이라 하나 앞이다.
  const index = from.column === column ? target.cards.length - 1 : target.cards.length;
  return from.column === column && from.index === index ? NONE : { kind: 'move', from, to: { column, index } };
}
