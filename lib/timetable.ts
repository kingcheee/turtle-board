import { checkDate, checkId, checkMembers, checkTime, checkTitle } from './fields';
import { rowStore } from './storage/rows';
import { broadcastChange } from './broadcast';
import type { TimeBlock } from './schedule';

// 당일 시간표 블록 — kanban_timetable 테이블(fs 모드: data/.timetable.json). 팀 공용 하루 한 벌,
// 담당자 태그로 누구 것인지 구분한다. 달력 일정과는 별개 저장소.
// 서버 전용(저장소를 문다) — 타입·currentBlock은 lib/schedule.ts.

export type BlockInput = Omit<TimeBlock, 'id' | 'created_at'>;
export type BlockPatch = Partial<Omit<BlockInput, 'date'>>; // 블록은 보고 있는 날에 속한다 — 날짜는 못 바꾼다

const store = () => rowStore<TimeBlock>('kanban_timetable', '.timetable.json');

function checkRange(start: string, end: string): void {
  if (end <= start) throw new RangeError('끝 시각은 시작보다 늦어야 해요');
}

function checkDone(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new RangeError('done은 true/false여야 해요');
  return v;
}

export function validateBlockInput(x: unknown): BlockInput {
  const o = (x ?? {}) as Record<string, unknown>;
  const start_time = checkTime(o.start_time);
  const end_time = checkTime(o.end_time);
  checkRange(start_time, end_time);
  return {
    date: checkDate(o.date), start_time, end_time,
    title: checkTitle(o.title), members: checkMembers(o.members),
    done: o.done === undefined ? false : checkDone(o.done),
  };
}

// 부분 갱신 — 시작·끝 중 하나만 오면 저장된 값(current)과 합쳐 순서를 검사한다
export function validateBlockPatch(x: unknown, current: Pick<TimeBlock, 'start_time' | 'end_time'>): BlockPatch {
  const o = (x ?? {}) as Record<string, unknown>;
  const p: BlockPatch = {};
  if (o.start_time !== undefined) p.start_time = checkTime(o.start_time);
  if (o.end_time !== undefined) p.end_time = checkTime(o.end_time);
  if (p.start_time !== undefined || p.end_time !== undefined) {
    checkRange(p.start_time ?? current.start_time, p.end_time ?? current.end_time);
  }
  if (o.title !== undefined) p.title = checkTitle(o.title);
  if (o.members !== undefined) p.members = checkMembers(o.members);
  if (o.done !== undefined) p.done = checkDone(o.done);
  if (Object.keys(p).length === 0) throw new RangeError('바꿀 내용이 없어요');
  return p;
}

// 시작 → 끝 → 생성 순
function compare(a: TimeBlock, b: TimeBlock): number {
  return a.start_time.localeCompare(b.start_time)
    || a.end_time.localeCompare(b.end_time)
    || a.created_at.localeCompare(b.created_at);
}

export async function listBlocks(date: unknown): Promise<TimeBlock[]> {
  return (await store().list({ date: checkDate(date) })).sort(compare);
}

export async function createBlock(input: unknown): Promise<TimeBlock> {
  const created = await store().insert(validateBlockInput(input));
  await broadcastChange({ kind: 'timetable' });
  return created;
}

export async function updateBlock(id: string, patch: unknown): Promise<TimeBlock> {
  const current = await store().get(checkId(id));
  const updated = await store().update(id, validateBlockPatch(patch, current));
  await broadcastChange({ kind: 'timetable' });
  return updated;
}

export async function deleteBlock(id: string): Promise<void> {
  await store().remove(checkId(id));
  await broadcastChange({ kind: 'timetable' });
}
