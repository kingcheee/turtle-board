import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, cardMeta, rawPriority, withRawPriority } from '../lib/kanban/parse';

const md = readFileSync(join(__dirname, 'fixtures', 'basic.md'), 'utf-8');

describe('parse', () => {
  it('컬럼 6개와 카드 수를 읽는다', () => {
    const doc = parse(md);
    expect(doc.columns.map((c) => c.title)).toEqual([
      '📥 Backlog', '📋 This Week', '🔨 In Progress',
      '⏳ Waiting On', '📅 Next Week', '✅ Done',
    ]);
    expect(doc.columns.map((c) => c.cards.length)).toEqual([2, 1, 1, 0, 1, 1]);
  });

  it('frontmatter는 prelude에, settings는 trailer에 원문 그대로 남는다', () => {
    const doc = parse(md);
    expect(doc.prelude[0]).toBe('---');
    expect(doc.prelude).toContain('kanban-plugin: board');
    expect(doc.trailer[0]).toBe('%% kanban:settings');
    expect(doc.trailer).toContain('%%');
  });

  it('카드 메타를 추출한다: 우선순위·제목·마감·설명', () => {
    const doc = parse(md);
    const m = cardMeta(doc.columns[0].cards[1]);
    expect(m.checked).toBe(false);
    expect(m.priority).toBe('🟢');
    expect(m.title).toBe('링크 카드');
    expect(m.due).toBe('2026-09-01');
    expect(m.description).toBe('설명 첫 줄. [[Knowledge/링크 노트]] [[People/아무개]]\n설명 둘째 줄.');
  });

  it('담당자 태그(#이름)를 여러 명 추출하고 제목은 오염되지 않는다', () => {
    const m = cardMeta({ lines: ['- [ ] 🟡 **담당 카드** · @{2026-09-01} #김지우 #박규연'] });
    expect(m.assignees).toEqual(['김지우', '박규연']);
    expect(m.title).toBe('담당 카드');
    expect(m.due).toBe('2026-09-01');
  });

  it('완료 처리(~~취소선~~)된 카드에서도 담당자 태그를 추출한다', () => {
    const m = cardMeta({ lines: ['- [x] ~~🟡 **완료 카드** #김기백~~ ✅ 2026-08-26'] });
    expect(m.assignees).toEqual(['김기백']);
    expect(m.checked).toBe(true);
    expect(m.doneDate).toBe('2026-08-26');
  });

  it('담당자 태그가 없으면 빈 배열', () => {
    const m = cardMeta({ lines: ['- [ ] **무담당 카드**'] });
    expect(m.assignees).toEqual([]);
  });

  it('시간 포함 마감과 설명 없는 카드를 처리한다', () => {
    const doc = parse(md);
    expect(cardMeta(doc.columns[1].cards[0]).due).toBe('2026-08-26 15:00');
    const plain = cardMeta(doc.columns[2].cards[0]);
    expect(plain.title).toBe('설명 없는 카드');
    expect(plain.priority).toBeNull();
    expect(plain.description).toBe('');
  });

  it('완료 카드: checked·doneDate·취소선 안쪽 제목', () => {
    const doc = parse(md);
    const m = cardMeta(doc.columns[5].cards[0]);
    expect(m.checked).toBe(true);
    expect(m.doneDate).toBe('2026-08-26');
    expect(m.priority).toBe('🔴');
    expect(m.title).toBe('끝난 카드');
  });

  it('⊕ 생성·✎ 수정 토큰을 추출하고 제목·마감은 오염되지 않는다', () => {
    const m = cardMeta({ lines: ['- [ ] 🟡 **시간 카드** · @{2026-09-01} #김지우 ⊕{2026-08-28 21:05} ✎{2026-08-28 21:40}'] });
    expect(m.createdAt).toBe('2026-08-28 21:05');
    expect(m.updatedAt).toBe('2026-08-28 21:40');
    expect(m.title).toBe('시간 카드');
    expect(m.due).toBe('2026-09-01');
    expect(m.assignees).toEqual(['김지우']);
  });

  it('토큰 없는 카드는 createdAt·updatedAt null', () => {
    const m = cardMeta({ lines: ['- [ ] **옛날 카드**'] });
    expect(m.createdAt).toBeNull();
    expect(m.updatedAt).toBeNull();
  });

  it('완료 카드의 취소선 안 토큰도 추출하고 doneDate는 깨끗하다', () => {
    const m = cardMeta({ lines: ['- [x] ~~**끝난 시간 카드** ⊕{2026-08-28 21:05}~~ ✅ 2026-08-28'] });
    expect(m.checked).toBe(true);
    expect(m.createdAt).toBe('2026-08-28 21:05');
    expect(m.doneDate).toBe('2026-08-28');
    expect(m.title).toBe('끝난 시간 카드');
  });

  it('빈 컬럼은 카드 0개, gap 라인 보존', () => {
    const doc = parse(md);
    expect(doc.columns[3].cards).toEqual([]);
    expect(doc.columns[3].gapBefore.length).toBeGreaterThan(0);
  });
});

describe('rawPriority / withRawPriority', () => {
  it('첫 줄에서 우선순위를 읽는다 — 없으면 null', () => {
    expect(rawPriority('- [ ] 🔴 **급한 카드** ⊕{2026-08-28 14:10}')).toBe('🔴');
    expect(rawPriority('- [ ] **무표시 카드**')).toBeNull();
    expect(rawPriority('그냥 텍스트')).toBeNull();
  });

  it('완료 카드의 ~~ 안쪽 우선순위도 읽는다', () => {
    expect(rawPriority('- [x] ~~🟡 **끝난 카드**~~ ✅ 2026-08-28')).toBe('🟡');
  });

  it('우선순위를 갈아끼운다 — 설명 줄과 토큰은 그대로', () => {
    const raw = '- [ ] 🔴 **카드** · @{08-30} #김지우 ⊕{2026-08-28 14:10}\n\t설명 줄';
    expect(withRawPriority(raw, '🟢'))
      .toBe('- [ ] 🟢 **카드** · @{08-30} #김지우 ⊕{2026-08-28 14:10}\n\t설명 줄');
  });

  it('없던 우선순위를 추가하고, null이면 제거한다', () => {
    expect(withRawPriority('- [ ] **카드**', '🟡')).toBe('- [ ] 🟡 **카드**');
    expect(withRawPriority('- [ ] 🟡 **카드**', null)).toBe('- [ ] **카드**');
  });

  it('완료 카드의 ~~ 안쪽에서 갈아끼운다', () => {
    expect(withRawPriority('- [x] ~~🟡 **끝난 카드**~~ ✅ 2026-08-28', '🔴'))
      .toBe('- [x] ~~🔴 **끝난 카드**~~ ✅ 2026-08-28');
  });

  it('카드 형식이 아니면 원문을 그대로 돌려준다', () => {
    expect(withRawPriority('그냥 텍스트', '🔴')).toBe('그냥 텍스트');
  });
});
