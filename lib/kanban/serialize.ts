import type { BoardDoc, CardBlock, Priority } from './types';

export function serialize(doc: BoardDoc): string {
  const lines: string[] = [...doc.prelude];
  for (const col of doc.columns) {
    lines.push(`## ${col.title}`);
    lines.push(...col.gapBefore);
    for (const card of col.cards) lines.push(...card.lines);
    lines.push(...col.gapAfter);
  }
  lines.push(...doc.trailer);
  return lines.join(doc.eol);
}

export function buildCard(input: {
  title: string; priority?: Priority; due?: string; assignees?: string[]; description?: string;
  createdAt?: string;
}): CardBlock {
  const title = input.title.replace(/\r?\n/g, ' ');
  const prio = input.priority ? `${input.priority} ` : '';
  const due = input.due ? ` · @{${input.due.replace(/\r?\n/g, ' ')}}` : '';
  const tags = (input.assignees ?? [])
    .map((a) => a.replace(/[\s#~]+/g, ''))
    .filter(Boolean)
    .map((a) => ` #${a}`)
    .join('');
  const created = input.createdAt ? ` ⊕{${input.createdAt.replace(/[\r\n}]/g, ' ')}}` : '';
  const lines = [`- [ ] ${prio}**${title}**${due}${tags}${created}`];
  for (const l of (input.description ?? '').split('\n')) {
    if (l.trim() !== '') lines.push(`\t${l}`);
  }
  return { lines };
}
