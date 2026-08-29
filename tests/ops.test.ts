import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, cardMeta } from '../lib/kanban/parse';
import { serialize } from '../lib/kanban/serialize';
import { applyOp } from '../lib/kanban/ops';

const md = readFileSync(join(__dirname, 'fixtures', 'basic.md'), 'utf-8');
const TODAY = '2026-08-27 13:45';

describe('applyOp', () => {
  it('add: 컬럼 끝에 표준 카드 추가', () => {
    const doc = applyOp(parse(md), {
      type: 'add', column: 1, title: '추가된 카드', priority: '🟡',
      due: '2026-09-02', description: '메모',
    }, TODAY);
    const cards = doc.columns[1].cards;
    expect(cards).toHaveLength(2);
    expect(cards[1].lines[0]).toBe('- [ ] 🟡 **추가된 카드** · @{2026-09-02} ⊕{2026-08-27 13:45}');
    expect(cards[1].lines[1]).toBe('\t메모');
  });

  it('add: 생성 시간 ⊕ 토큰이 찍히고 메타로 읽힌다', () => {
    const doc = applyOp(parse(md), { type: 'add', column: 0, title: '시간 카드' }, TODAY);
    const m = cardMeta(doc.columns[0].cards[2]);
    expect(m.createdAt).toBe('2026-08-27 13:45');
    expect(m.updatedAt).toBeNull();
    expect(m.title).toBe('시간 카드');
  });

  it('add: index 지정 시 그 위치에 삽입', () => {
    const doc = applyOp(parse(md), { type: 'add', column: 0, index: 0, title: '맨 앞' }, TODAY);
    expect(cardMeta(doc.columns[0].cards[0]).title).toBe('맨 앞');
    expect(doc.columns[0].cards).toHaveLength(3);
  });

  it('move: 컬럼 간 이동', () => {
    const doc = applyOp(parse(md), {
      type: 'move', from: { column: 0, index: 0 }, to: { column: 2, index: 0 },
    }, TODAY);
    expect(doc.columns[0].cards).toHaveLength(1);
    expect(doc.columns[2].cards).toHaveLength(2);
    expect(cardMeta(doc.columns[2].cards[0]).title).toBe('파서 픽스처 카드 (t1)');
  });

  it('move: 같은 컬럼 재정렬 (제거 후 인덱스)', () => {
    const doc = applyOp(parse(md), {
      type: 'move', from: { column: 0, index: 0 }, to: { column: 0, index: 1 },
    }, TODAY);
    expect(cardMeta(doc.columns[0].cards[1]).title).toBe('파서 픽스처 카드 (t1)');
  });

  it('toggle: 완료 처리 — 취소선 + ✅ 날짜', () => {
    const doc = applyOp(parse(md), { type: 'toggle', column: 0, index: 0 }, TODAY);
    expect(doc.columns[0].cards[0].lines[0])
      .toBe('- [x] ~~🟡 **파서 픽스처 카드 (t1)**~~ ✅ 2026-08-27');
  });

  it('toggle: 완료 해제 — 원래 본문 복원', () => {
    const doc = applyOp(parse(md), { type: 'toggle', column: 5, index: 0 }, TODAY);
    expect(doc.columns[5].cards[0].lines[0]).toBe('- [ ] 🔴 **끝난 카드**');
  });

  it('edit: raw 교체 + 들여쓰기 정규화', () => {
    const doc = applyOp(parse(md), {
      type: 'edit', column: 2, index: 0, raw: '- [ ] 🔴 **바뀐 카드**\n설명 줄',
    }, TODAY);
    expect(doc.columns[2].cards[0].lines).toEqual(['- [ ] 🔴 **바뀐 카드** ✎{2026-08-27 13:45}', '\t설명 줄']);
  });

  it('edit: 체크박스 없는 첫 줄엔 접두어를 붙인다', () => {
    const doc = applyOp(parse(md), { type: 'edit', column: 2, index: 0, raw: '그냥 텍스트' }, TODAY);
    expect(doc.columns[2].cards[0].lines).toEqual(['- [ ] 그냥 텍스트 ✎{2026-08-27 13:45}']);
  });

  it('edit: 기존 ✎ 토큰은 갈아끼우고 ⊕ 토큰은 보존한다', () => {
    let doc = applyOp(parse(md), {
      type: 'edit', column: 2, index: 0, raw: '- [ ] **첫 편집** ⊕{2026-08-01 09:00} ✎{2026-08-02 10:00}',
    }, TODAY);
    doc = applyOp(doc, { type: 'edit', column: 2, index: 0, raw: doc.columns[2].cards[0].lines[0] }, '2026-08-27 14:00');
    expect(doc.columns[2].cards[0].lines).toEqual(['- [ ] **첫 편집** ⊕{2026-08-01 09:00} ✎{2026-08-27 14:00}']);
    const m = cardMeta(doc.columns[2].cards[0]);
    expect(m.createdAt).toBe('2026-08-01 09:00');
    expect(m.updatedAt).toBe('2026-08-27 14:00');
    expect(m.title).toBe('첫 편집');
  });

  it('delete: 카드 제거', () => {
    const doc = applyOp(parse(md), { type: 'delete', column: 0, index: 1 }, TODAY);
    expect(doc.columns[0].cards).toHaveLength(1);
  });

  it('addColumn: 새 컬럼', () => {
    const doc = applyOp(parse(md), { type: 'addColumn', title: '🧊 Icebox' }, TODAY);
    expect(doc.columns[6].title).toBe('🧊 Icebox');
    expect(doc.columns[6].cards).toEqual([]);
  });

  it('범위 밖 인덱스는 RangeError', () => {
    expect(() => applyOp(parse(md), { type: 'delete', column: 9, index: 0 }, TODAY)).toThrow(RangeError);
    expect(() => applyOp(parse(md), { type: 'delete', column: 0, index: 9 }, TODAY)).toThrow(RangeError);
  });

  it('add: index 초과 범위 → RangeError', () => {
    const doc = parse(md);
    expect(() => applyOp(doc, { type: 'add', column: 0, index: 10, title: '범위 초과' }, TODAY)).toThrow(RangeError);
  });

  it('add: 음수 index → RangeError', () => {
    const doc = parse(md);
    expect(() => applyOp(doc, { type: 'add', column: 0, index: -1, title: '음수' }, TODAY)).toThrow(RangeError);
  });

  it('add: index==length 경계값 → 성공 (끝에 추가)', () => {
    const doc = applyOp(parse(md), { type: 'add', column: 0, index: 2, title: '경계값' }, TODAY);
    expect(doc.columns[0].cards).toHaveLength(3);
    expect(cardMeta(doc.columns[0].cards[2]).title).toBe('경계값');
  });

  it('move.to: 범위 초과 → RangeError', () => {
    const doc = parse(md);
    expect(() => applyOp(doc, {
      type: 'move', from: { column: 0, index: 0 }, to: { column: 2, index: 10 },
    }, TODAY)).toThrow(RangeError);
  });

  it('move.to: 음수 → RangeError', () => {
    const doc = parse(md);
    expect(() => applyOp(doc, {
      type: 'move', from: { column: 0, index: 0 }, to: { column: 2, index: -1 },
    }, TODAY)).toThrow(RangeError);
  });

  it('move.to: 제거 후 경계값 (다른 컬럼) → 성공', () => {
    const doc = applyOp(parse(md), {
      type: 'move', from: { column: 0, index: 0 }, to: { column: 1, index: 1 },
    }, TODAY);
    expect(doc.columns[1].cards).toHaveLength(2);
    expect(cardMeta(doc.columns[1].cards[1]).title).toBe('파서 픽스처 카드 (t1)');
  });

  it('move.to: 제거 후 경계값 (같은 컬럼) → 성공', () => {
    const doc = applyOp(parse(md), {
      type: 'move', from: { column: 0, index: 0 }, to: { column: 0, index: 1 },
    }, TODAY);
    expect(doc.columns[0].cards).toHaveLength(2);
    expect(cardMeta(doc.columns[0].cards[1]).title).toBe('파서 픽스처 카드 (t1)');
  });

  it('add: title에 개행 주입 시도 → 공백으로 collapse, 컬럼 수 불변', () => {
    const doc = parse(md);
    const colCountBefore = doc.columns.length;
    const result = applyOp(doc, { type: 'add', column: 0, title: 'x\n## Evil' }, TODAY);
    expect(result.columns).toHaveLength(colCountBefore);
    const added = result.columns[0].cards[result.columns[0].cards.length - 1];
    expect(added.lines).toEqual(['- [ ] **x ## Evil** ⊕{2026-08-27 13:45}']);
  });

  it('addColumn: title에 개행 주입 시도 → 공백으로 collapse', () => {
    const doc = applyOp(parse(md), { type: 'addColumn', title: 'x\n%% kanban:settings' }, TODAY);
    const newCol = doc.columns[doc.columns.length - 1];
    expect(newCol.title).toBe('x %% kanban:settings');
  });

  it('deleteColumn: 컬럼과 그 안의 카드를 함께 제거', () => {
    const doc = applyOp(parse(md), { type: 'deleteColumn', column: 1 }, TODAY);
    expect(doc.columns).toHaveLength(5);
    expect(doc.columns.map((c) => c.title)).not.toContain('📋 This Week');
    expect(doc.columns[1].title).toBe('🔨 In Progress');
  });

  it('deleteColumn: 첫 컬럼 삭제 후 다시 파싱해도 나머지가 온전하다', () => {
    const doc = applyOp(parse(md), { type: 'deleteColumn', column: 0 }, TODAY);
    const again = parse(serialize(doc));
    expect(again.columns).toHaveLength(5);
    expect(again.columns[0].title).toBe('📋 This Week');
    expect(cardMeta(again.columns[0].cards[0]).title).toBe('마감 있는 카드');
  });

  it('deleteColumn: 마지막 컬럼 삭제 후에도 settings 트레일러가 남는다', () => {
    const doc = applyOp(parse(md), { type: 'deleteColumn', column: 5 }, TODAY);
    const text = serialize(doc);
    expect(text).toContain('%% kanban:settings');
    const again = parse(text);
    expect(again.columns).toHaveLength(5);
    expect(again.columns[4].title).toBe('📅 Next Week');
    expect(cardMeta(again.columns[4].cards[0]).title).toBe('다음 주 카드');
  });

  it('deleteColumn: 마지막 남은 컬럼은 거부 → RangeError', () => {
    let doc = parse(md);
    for (let i = 5; i >= 1; i--) doc = applyOp(doc, { type: 'deleteColumn', column: i }, TODAY);
    expect(doc.columns).toHaveLength(1);
    expect(() => applyOp(doc, { type: 'deleteColumn', column: 0 }, TODAY)).toThrow(RangeError);
    expect(doc.columns).toHaveLength(1);
  });

  it('deleteColumn: 범위 밖 → RangeError', () => {
    expect(() => applyOp(parse(md), { type: 'deleteColumn', column: 9 }, TODAY)).toThrow(RangeError);
    expect(() => applyOp(parse(md), { type: 'deleteColumn', column: -1 }, TODAY)).toThrow(RangeError);
  });

  it('알 수 없는 op type → RangeError', () => {
    const doc = parse(md);
    expect(() => applyOp(doc, { type: '뭐든' } as unknown as Parameters<typeof applyOp>[1], TODAY))
      .toThrow(RangeError);
  });

  it('move: 유실 방지 (to 검증 전 from 수정 안 함)', () => {
    const doc = parse(md);
    const originalCard = cardMeta(doc.columns[0].cards[0]).title;
    try {
      applyOp(doc, {
        type: 'move', from: { column: 0, index: 0 }, to: { column: 99, index: 0 },
      }, TODAY);
    } catch (e) {
      if (e instanceof RangeError) {
        // 컬럼 검증 실패
        expect(doc.columns[0].cards).toHaveLength(2);
        expect(cardMeta(doc.columns[0].cards[0]).title).toBe(originalCard);
      }
    }
  });
});
