import { addDays } from './dates';
import { checkDate, checkId, checkMembers, checkTime, checkTitle } from './fields';
import { rowStore } from './storage/rows';
import { broadcastChange } from './broadcast';
import type { TeamEvent } from './schedule';

// 달력 일정 — kanban_events 테이블(fs 모드: data/.events.json). 카드 마감과 무관한 독립 저장소.
// 서버 전용(저장소를 문다) — 타입·순수 함수는 lib/schedule.ts.

export type EventInput = Omit<TeamEvent, 'id' | 'created_at'>;

const MAX_RANGE_DAYS = 62; // 월 그리드는 최대 42일 — 여유를 두되 전체 덤프는 막는다

const store = () => rowStore<TeamEvent>('kanban_events', '.events.json');

function checkOptionalTime(v: unknown): string | null {
  return v === undefined || v === null || v === '' ? null : checkTime(v);
}

export function validateEventInput(x: unknown): EventInput {
  const o = (x ?? {}) as Record<string, unknown>;
  return { date: checkDate(o.date), time: checkOptionalTime(o.time), title: checkTitle(o.title), members: checkMembers(o.members) };
}

// 부분 갱신 — 온 필드만 검증한다
export function validateEventPatch(x: unknown): Partial<EventInput> {
  const o = (x ?? {}) as Record<string, unknown>;
  const p: Partial<EventInput> = {};
  if (o.date !== undefined) p.date = checkDate(o.date);
  if (o.time !== undefined) p.time = checkOptionalTime(o.time);
  if (o.title !== undefined) p.title = checkTitle(o.title);
  if (o.members !== undefined) p.members = checkMembers(o.members);
  if (Object.keys(p).length === 0) throw new RangeError('바꿀 내용이 없어요');
  return p;
}

// 날짜 → 시간 없는 것 먼저 → 시간 → 생성 순
function compare(a: TeamEvent, b: TeamEvent): number {
  return a.date.localeCompare(b.date)
    || Number(a.time !== null) - Number(b.time !== null)
    || (a.time ?? '').localeCompare(b.time ?? '')
    || a.created_at.localeCompare(b.created_at);
}

export async function listEvents(from: unknown, to: unknown): Promise<TeamEvent[]> {
  const f = checkDate(from);
  const t = checkDate(to);
  if (f > t) throw new RangeError('from이 to보다 늦어요');
  if (addDays(f, MAX_RANGE_DAYS - 1) < t) throw new RangeError(`조회 범위는 ${MAX_RANGE_DAYS}일까지예요`);
  return (await store().list({ from: f, to: t })).sort(compare);
}

export async function createEvent(input: unknown): Promise<TeamEvent> {
  const created = await store().insert(validateEventInput(input));
  await broadcastChange({ kind: 'events' });
  return created;
}

export async function updateEvent(id: string, patch: unknown): Promise<TeamEvent> {
  const updated = await store().update(checkId(id), validateEventPatch(patch));
  await broadcastChange({ kind: 'events' });
  return updated;
}

export async function deleteEvent(id: string): Promise<void> {
  await store().remove(checkId(id));
  await broadcastChange({ kind: 'events' });
}
