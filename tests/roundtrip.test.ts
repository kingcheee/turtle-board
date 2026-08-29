import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../lib/kanban/parse';
import { serialize, buildCard } from '../lib/kanban/serialize';

const md = readFileSync(join(__dirname, 'fixtures', 'basic.md'), 'utf-8');

describe('serialize', () => {
  it('라운드트립 바이트 동일 (LF)', () => {
    expect(serialize(parse(md))).toBe(md);
  });

  it('라운드트립 바이트 동일 (CRLF)', () => {
    const crlf = md.replace(/\n/g, '\r\n');
    expect(serialize(parse(crlf))).toBe(crlf);
  });

  it('buildCard: 표준 형태의 새 카드', () => {
    const card = buildCard({
      title: '새 카드', priority: '🟡', due: '2026-09-07',
      description: '첫 줄\n둘째 줄',
    });
    expect(card.lines).toEqual([
      '- [ ] 🟡 **새 카드** · @{2026-09-07}',
      '\t첫 줄',
      '\t둘째 줄',
    ]);
  });

  it('buildCard: 제목만', () => {
    expect(buildCard({ title: '제목만' }).lines).toEqual(['- [ ] **제목만**']);
  });

  it('buildCard: createdAt이 있으면 줄 끝에 ⊕ 토큰', () => {
    expect(buildCard({ title: '시간', createdAt: '2026-08-28 21:05' }).lines)
      .toEqual(['- [ ] **시간** ⊕{2026-08-28 21:05}']);
  });

  // turtle-jiwoo 실물이 있는 머신에서만 도는 검증 (커밋 안 함)
  const real = 'C:/projects/03-personal/turtle-jiwoo/Boards/Work.md';
  it.skipIf(!existsSync(real))('turtle-jiwoo Work.md 라운드트립', () => {
    const t = readFileSync(real, 'utf-8');
    expect(serialize(parse(t))).toBe(t);
  });
});
