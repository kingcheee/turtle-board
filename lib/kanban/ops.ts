import type { BoardDoc, CardBlock, ColumnBlock, Priority } from './types';
import { buildCard } from './serialize';

export type Op =
  | { type: 'add'; column: number; index?: number; title: string; priority?: Priority; due?: string; assignees?: string[]; description?: string }
  | { type: 'edit'; column: number; index: number; raw: string }
  | { type: 'delete'; column: number; index: number }
  | { type: 'move'; from: { column: number; index: number }; to: { column: number; index: number } }
  | { type: 'toggle'; column: number; index: number }
  | { type: 'addColumn'; title: string }
  | { type: 'deleteColumn'; column: number };

function col(doc: BoardDoc, i: number): ColumnBlock {
  const c = doc.columns[i];
  if (!c) throw new RangeError(`컬럼 없음: ${i}`);
  return c;
}

function card(c: ColumnBlock, i: number): CardBlock {
  const k = c.cards[i];
  if (!k) throw new RangeError(`카드 없음: ${i}`);
  return k;
}

function normalizeRaw(raw: string): string[] {
  const lines = raw.split(/\r?\n/).filter((l, i) => i === 0 || l.trim() !== '');
  if (lines.length === 0 || lines[0].trim() === '') throw new RangeError('빈 카드');
  if (!/^- \[[ xX]\] /.test(lines[0])) lines[0] = `- [ ] ${lines[0]}`;
  return lines.map((l, i) => (i === 0 ? l : /^(\t| {4})/.test(l) ? l : `\t${l}`));
}

// now: 'YYYY-MM-DD HH:mm' 로컬 타임스탬프 — add는 ⊕{생성}, edit은 ✎{수정}으로 카드 첫 줄에 찍힌다
export function applyOp(doc: BoardDoc, op: Op, now: string): BoardDoc {
  switch (op.type) {
    case 'add': {
      const c = col(doc, op.column);
      const nu = buildCard({ ...op, createdAt: now });
      if (op.index !== undefined) {
        if (op.index < 0 || op.index > c.cards.length) {
          throw new RangeError(`add index 범위 초과: ${op.index}`);
        }
        c.cards.splice(op.index, 0, nu);
      } else {
        c.cards.splice(c.cards.length, 0, nu);
      }
      break;
    }
    case 'edit': {
      const c = col(doc, op.column);
      card(c, op.index);
      const lines = normalizeRaw(op.raw);
      // 기존 ✎ 토큰은 갈아끼운다 — 편집 raw에 남아 있어도 중복으로 쌓이지 않게
      lines[0] = `${lines[0].replace(/\s*✎\{[^}]+\}/g, '').trimEnd()} ✎{${now}}`;
      c.cards[op.index] = { lines };
      break;
    }
    case 'delete': {
      const c = col(doc, op.column);
      card(c, op.index);
      c.cards.splice(op.index, 1);
      break;
    }
    case 'move': {
      const from = col(doc, op.from.column);
      card(from, op.from.index);
      const to = col(doc, op.to.column);
      // 제거 후 기준 길이 계산 (같은 컬럼인 경우 제거 후 길이 반영)
      const postRemovalToLength = op.from.column === op.to.column ? to.cards.length - 1 : to.cards.length;
      if (op.to.index < 0 || op.to.index > postRemovalToLength) {
        throw new RangeError(`move to.index 범위 초과: ${op.to.index}`);
      }
      const [k] = from.cards.splice(op.from.index, 1);
      to.cards.splice(op.to.index, 0, k);
      break;
    }
    case 'toggle': {
      const c = col(doc, op.column);
      const k = card(c, op.index);
      const m = k.lines[0].match(/^- \[([ xX])\] (.*)$/);
      if (!m) throw new RangeError('카드 형식 아님');
      if (m[1] === ' ') {
        k.lines[0] = `- [x] ~~${m[2]}~~ ✅ ${now.slice(0, 10)}`;
      } else {
        const inner = m[2].match(/^~~(.*)~~/);
        k.lines[0] = `- [ ] ${inner ? inner[1] : m[2]}`;
      }
      break;
    }
    case 'addColumn': {
      const title = op.title.replace(/\r?\n/g, ' ');
      doc.columns.push({ title, gapBefore: [''], cards: [], gapAfter: ['', ''] });
      break;
    }
    case 'deleteColumn': {
      col(doc, op.column);
      // 보드 삭제와 같은 규칙 — 마지막 하나는 남긴다(컬럼 0개짜리 보드는 카드를 넣을 데가 없다)
      if (doc.columns.length <= 1) throw new RangeError('마지막 남은 컬럼은 삭제할 수 없어요');
      doc.columns.splice(op.column, 1);
      break;
    }
    default:
      throw new RangeError(`알 수 없는 연산: ${(op as { type?: string }).type}`);
  }
  return doc;
}
