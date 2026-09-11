import { parse, cardMeta } from './kanban/parse';
import { serialize } from './kanban/serialize';
import { applyOp, type Op } from './kanban/ops';
import type { UiBoard } from './kanban/types';
import { NotFoundError, VersionConflictError } from './storage/errors';
import { fileVersion } from './storage/version';
import type { StorageDriver } from './storage/types';
import { fsDriver } from './storage/fs';
import { storageMode } from './storage/mode';
import { supabaseDriver } from './storage/supabase';
import { broadcastChange } from './broadcast';
import { kstNow } from './dates';

export { NotFoundError, VersionConflictError } from './storage/errors';
export { fileVersion } from './storage/version';
export { boardsDir } from './storage/fs';

const TEMPLATE_COLUMNS = ['📥 아이디어', '📋 이번주', '🔨 진행중', '⏳ 대기중', '📅 할일', '✅ 완료'];

// 팀 메인 보드 — 탭 맨 앞에 고정되고, 첫 접속 시 기본으로 열린다(page.tsx가 boards[0]을 연다).
const PINNED_BOARD = '파이널 프로젝트';

function driver(): StorageDriver {
  return storageMode() === 'supabase' ? supabaseDriver : fsDriver;
}

export function sanitizeName(name: string): string {
  if (!name || /[\\/:*?"<>|]/.test(name) || name.includes('..') || name.startsWith('.') || name.trim().toUpperCase() === 'AGENTS') {
    throw new NotFoundError(`잘못된 보드 이름: ${name}`);
  }
  return name;
}

export async function listBoards(): Promise<string[]> {
  const names = await driver().list();
  return names.sort((a, b) => Number(b === PINNED_BOARD) - Number(a === PINNED_BOARD) || a.localeCompare(b));
}

export async function readBoard(name: string): Promise<UiBoard> {
  sanitizeName(name);
  const content = await driver().readRaw(name);
  const doc = parse(content);
  return {
    name,
    version: fileVersion(content),
    columns: doc.columns.map((c) => ({
      title: c.title,
      cards: c.cards.map((card) => ({ raw: card.lines.join('\n'), meta: cardMeta(card) })),
    })),
  };
}

// 카드 타임스탬프 'YYYY-MM-DD HH:mm' — 프로세스 TZ와 무관하게 KST(kstNow)
function localStamp(): string {
  const { date, time } = kstNow();
  return `${date} ${time}`;
}

export async function applyBoardOp(name: string, op: Op, expectedVersion: string): Promise<{ version: string }> {
  sanitizeName(name);
  const content = await driver().readRaw(name);
  if (fileVersion(content) !== expectedVersion) throw new VersionConflictError('보드가 그새 바뀌었어요');
  const doc = applyOp(parse(content), op, localStamp());
  const next = serialize(doc);
  const res = await driver().casWrite({ name, expectedVersion, next, nextVersion: fileVersion(next) });
  await broadcastChange({ kind: 'board', board: name });
  return res;
}

// 보드 간 카드 이동 — 두 보드를 CAS 쌍으로 갱신한다(드라이버가 원자성/순서를 책임진다).
// 대상 컬럼은 같은 제목을 우선하고(템플릿 보드끼리는 항상 맞는다) 없으면 첫 컬럼으로 보낸다.
export async function moveCardToBoard(
  from: string,
  expectedVersion: string,
  at: { column: number; index: number },
  to: string,
): Promise<{ version: string }> {
  sanitizeName(from);
  sanitizeName(to);
  if (from === to) throw new RangeError('같은 보드로는 옮길 수 없어요');

  const srcRaw = await driver().readRaw(from);
  if (fileVersion(srcRaw) !== expectedVersion) throw new VersionConflictError('보드가 그새 바뀌었어요');
  const dstRaw = await driver().readRaw(to);

  const srcDoc = parse(srcRaw);
  const srcCol = srcDoc.columns[at.column];
  if (!srcCol) throw new RangeError(`컬럼 없음: ${at.column}`);
  const card = srcCol.cards[at.index];
  if (!card) throw new RangeError(`카드 없음: ${at.index}`);

  const dstDoc = parse(dstRaw);
  if (dstDoc.columns.length === 0) throw new RangeError(`컬럼이 없는 보드: ${to}`);
  const dstCol = dstDoc.columns.find((c) => c.title === srcCol.title) ?? dstDoc.columns[0];
  dstCol.cards.push({ lines: [...card.lines] });
  srcCol.cards.splice(at.index, 1);

  const dstNext = serialize(dstDoc);
  const srcNext = serialize(srcDoc);
  const res = await driver().casWritePair(
    { name: to, expectedVersion: fileVersion(dstRaw), next: dstNext, nextVersion: fileVersion(dstNext) },
    { name: from, expectedVersion, next: srcNext, nextVersion: fileVersion(srcNext) },
  );
  await broadcastChange({ kind: 'board', board: to });
  await broadcastChange({ kind: 'board', board: from });
  return res;
}

export async function deleteBoard(name: string): Promise<void> {
  sanitizeName(name);
  const boards = await listBoards();
  if (!boards.includes(name)) throw new NotFoundError(`보드 없음: ${name}`);
  if (boards.filter((b) => b !== name).length === 0) throw new RangeError('마지막 남은 보드는 삭제할 수 없어요');
  await driver().trash(name);
  await broadcastChange({ kind: 'board', board: name });
}

export async function createBoard(name: string): Promise<void> {
  sanitizeName(name);
  const cols = TEMPLATE_COLUMNS.map((t) => `## ${t}\n\n`).join('\n');
  const settings = '%% kanban:settings\n```\n' +
    JSON.stringify({ 'kanban-plugin': 'board', 'list-collapse': TEMPLATE_COLUMNS.map(() => false) }) +
    '\n```\n%%\n';
  const content = `---\n\nkanban-plugin: board\n\n---\n\n${cols}\n${settings}`;
  await driver().create(name, content, fileVersion(content));
  await broadcastChange({ kind: 'board', board: name });
}
