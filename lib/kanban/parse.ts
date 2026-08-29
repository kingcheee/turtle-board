import type { BoardDoc, CardBlock, CardMeta, ColumnBlock, Priority } from './types';

const CARD_RE = /^- \[[ xX]\] /;
const HEADING_RE = /^## (.*)$/;
const CONT_RE = /^(\t| {4})/;
const PRIORITIES: Priority[] = ['🔴', '🟡', '🟢'];
// 첫 줄 접두(체크박스 + 완료 카드의 여는 ~~)와 본문 분리 — 우선순위는 본문 맨 앞에 산다
const FIRST_LINE_RE = /^(- \[[ xX]\] (?:~~)?)(.*)$/;

export function parse(md: string): BoardDoc {
  const eol: '\n' | '\r\n' = md.includes('\r\n') ? '\r\n' : '\n';
  const lines = md.split('\n').map((l) => l.replace(/\r$/, ''));

  const doc: BoardDoc = { eol, prelude: [], columns: [], trailer: [] };
  let col: ColumnBlock | null = null;
  let pending: string[] = []; // 아직 소속이 안 정해진 라인들(빈 줄·미인식 라인)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(HEADING_RE);
    if (line === '%% kanban:settings') {
      if (col) col.gapAfter.push(...pending);
      else doc.prelude.push(...pending);
      // settings부터 파일 끝까지(마지막 개행이 만든 빈 요소 포함) 전부 trailer로
      doc.trailer = [line, ...lines.slice(i + 1)];
      return finalize(doc, col);
    }
    if (h) {
      if (col) {
        if (col.cards.length === 0) {
          col.gapBefore = pending;
        } else {
          col.gapAfter = pending;
        }
        doc.columns.push(col);
      } else doc.prelude.push(...pending);
      pending = [];
      col = { title: h[1], gapBefore: [], cards: [], gapAfter: [] };
      continue;
    }
    if (!col) { doc.prelude.push(line); continue; }
    if (CARD_RE.test(line)) {
      if (col.cards.length === 0) { col.gapBefore.push(...pending); }
      else if (pending.length) { col.cards[col.cards.length - 1].lines.push(...pending); }
      pending = [];
      col.cards.push({ lines: [line] });
      continue;
    }
    if (CONT_RE.test(line) && col.cards.length > 0 && pending.length === 0) {
      col.cards[col.cards.length - 1].lines.push(line);
      continue;
    }
    pending.push(line);
  }
  if (col) { col.gapAfter = pending; }
  else doc.prelude.push(...pending);
  return finalize(doc, col);
}

function finalize(doc: BoardDoc, col: ColumnBlock | null): BoardDoc {
  if (col) doc.columns.push(col);
  return doc;
}

export function cardMeta(card: CardBlock): CardMeta {
  // 생성 ⊕{ts}·수정 ✎{ts} 토큰은 먼저 뽑아내고 지운다 — 제목·완료날짜가 오염되지 않게
  const createdAt = card.lines[0].match(/⊕\{([^}]+)\}/)?.[1] ?? null;
  const updatedAt = card.lines[0].match(/✎\{([^}]+)\}/)?.[1] ?? null;
  const first = card.lines[0].replace(/\s*[⊕✎]\{[^}]+\}/g, '');
  const m = first.match(/^- \[([ xX])\] (.*)$/);
  const checked = !!m && m[1] !== ' ';
  let body = m ? m[2] : first;
  let doneDate: string | null = null;

  if (checked) {
    const done = body.match(/^~~(.*)~~\s*(?:✅\s*(\S+.*))?$/);
    if (done) { body = done[1]; doneDate = done[2]?.trim() ?? null; }
  }

  let priority: Priority | null = null;
  for (const p of PRIORITIES) {
    if (body.startsWith(p)) { priority = p; body = body.slice(p.length).trimStart(); break; }
  }

  const due = first.match(/@\{([^}]+)\}/)?.[1] ?? null;

  // 담당자 = 첫 줄의 #태그들 (obsidian-kanban에서도 태그로 렌더되는 호환 표기)
  const assignees = [...first.matchAll(/#([^\s#~]+)/g)].map((t) => t[1]);

  const bold = body.match(/\*\*(.+?)\*\*/);
  const title = bold
    ? bold[1]
    : body.replace(/\s*·\s*@\{[^}]+\}\s*/, '').replace(/#[^\s#~]+/g, '').trim();

  const description = card.lines
    .slice(1)
    .filter((l) => l.trim() !== '')
    .map((l) => l.replace(CONT_RE, ''))
    .join('\n');

  return { checked, priority, title, due, doneDate, assignees, createdAt, updatedAt, description };
}

// 편집 모달 드롭다운용 — raw 첫 줄에서 우선순위만 읽거나 갈아끼운다 (완료 카드의 ~~ 안쪽 포함)
export function rawPriority(raw: string): Priority | null {
  const m = raw.split('\n', 1)[0].match(FIRST_LINE_RE);
  if (!m) return null;
  for (const p of PRIORITIES) if (m[2].startsWith(p)) return p;
  return null;
}

export function withRawPriority(raw: string, priority: Priority | null): string {
  const nl = raw.search(/\r?\n/);
  const first = nl === -1 ? raw : raw.slice(0, nl);
  const rest = nl === -1 ? '' : raw.slice(nl);
  const m = first.match(FIRST_LINE_RE);
  if (!m) return raw;
  let body = m[2];
  for (const p of PRIORITIES) {
    if (body.startsWith(p)) { body = body.slice(p.length).trimStart(); break; }
  }
  return `${m[1]}${priority ? `${priority} ` : ''}${body}${rest}`;
}
