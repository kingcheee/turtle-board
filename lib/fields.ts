import { isDate, isTime } from './dates';
import { MEMBERS } from './members';
import { NotFoundError } from './storage/errors';

// 일정·시간표 블록이 같이 쓰는 필드 검증 — 통과하면 정규화된 값을 돌려주고, 아니면 RangeError(한국어 메시지).

const MAX_TITLE = 200;
const NAMES = new Set(MEMBERS.map((m) => m.name));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function checkDate(v: unknown): string {
  if (!isDate(v)) throw new RangeError('날짜는 YYYY-MM-DD 형식이어야 해요');
  return v;
}

export function checkTime(v: unknown): string {
  if (!isTime(v)) throw new RangeError('시각은 HH:MM 형식이어야 해요');
  return v;
}

export function checkTitle(v: unknown): string {
  if (typeof v !== 'string') throw new RangeError('제목이 필요해요');
  const t = v.trim();
  if (!t) throw new RangeError('제목이 비어 있어요');
  if (t.length > MAX_TITLE) throw new RangeError(`제목이 너무 길어요(최대 ${MAX_TITLE}자)`);
  return t;
}

export function checkMembers(v: unknown): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x): x is string => typeof x === 'string')) {
    throw new RangeError('담당자는 이름 배열이어야 해요');
  }
  const unknown = v.find((x) => !NAMES.has(x));
  if (unknown !== undefined) throw new RangeError(`팀원이 아님: ${unknown}`);
  return [...new Set(v)];
}

// id는 uuid만 — 아무 문자열이나 PostgREST 필터에 넣으면 400(uuid 파싱 실패)이 500으로 새므로 먼저 404로 끊는다
export function checkId(v: string): string {
  if (!UUID_RE.test(v)) throw new NotFoundError(`없는 행: ${v}`);
  return v;
}
