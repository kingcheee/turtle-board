import { addDays, weekdayKo } from './dates';

// 한국 공휴일 — 「관공서의 공휴일에 관한 규정」(2023-05-04 시행 기준). 순수 함수, 클라이언트 안전.
// 양력 고정 공휴일은 규칙으로, 음력 기준 셋(설날·부처님오신날·추석)은 연도별 표로, 대체공휴일은 제3조 규칙으로 계산한다.
// 선거일·임시공휴일은 정부 지정이라 EXTRA에 손으로 넣는다. LUNAR에 없는 해는 음력 공휴일·그 대체일이 빠진다.
//
// 대체공휴일 규칙(제3조):
//   A군(삼일절·광복절·개천절·한글날·어린이날·부처님오신날·성탄절): 토·일 또는 다른 공휴일과 겹치면 대체.
//   B군(설·추석 연휴 3일): 일요일 또는 다른 공휴일과 겹치면 대체 — 토요일은 대체 사유가 아니다(2023 추석 10/2가 임시공휴일이었던 이유).
//   신정·현충일·선거일·임시공휴일: 대체 없음.
//   대체일 = 겹친 날 다음의 첫 비공휴일(주말·연휴 나머지를 건너뛴다). 같은 날 겹친 공휴일이 여럿이어도 대체는 하루.

export interface Holiday { date: string; name: string }

type Rule = 'A' | 'B' | null; // 대체공휴일 규칙군

const FIXED: { month: number; day: number; name: string; rule: Rule }[] = [
  { month: 1, day: 1, name: '신정', rule: null },
  { month: 3, day: 1, name: '삼일절', rule: 'A' },
  { month: 5, day: 5, name: '어린이날', rule: 'A' },
  { month: 6, day: 6, name: '현충일', rule: null },
  { month: 8, day: 15, name: '광복절', rule: 'A' },
  { month: 10, day: 3, name: '개천절', rule: 'A' },
  { month: 10, day: 9, name: '한글날', rule: 'A' },
  { month: 12, day: 25, name: '성탄절', rule: 'A' },
];

// 음력 기준 공휴일의 양력 날짜(당일) — 해를 늘리려면 여기에 세 날짜를 넣는다
const LUNAR: Record<number, { seol: string; buddha: string; chuseok: string }> = {
  2025: { seol: '2025-01-29', buddha: '2025-05-05', chuseok: '2025-10-06' },
  2026: { seol: '2026-02-17', buddha: '2026-05-24', chuseok: '2026-09-25' },
  2027: { seol: '2027-02-06', buddha: '2027-05-13', chuseok: '2027-09-15' },
};

// 정부 지정 — 임기만료 선거일(공직선거법 제34조)·임시공휴일
const EXTRA: Holiday[] = [
  { date: '2025-01-27', name: '임시공휴일' },
  { date: '2025-06-03', name: '대통령선거' },
  { date: '2026-06-03', name: '지방선거' },
];

const SUBSTITUTE = '대체공휴일';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isWeekend(date: string): boolean {
  const w = weekdayKo(date);
  return w === '토' || w === '일';
}

function baseHolidays(year: number): { holiday: Holiday; rule: Rule }[] {
  const out: { holiday: Holiday; rule: Rule }[] = FIXED.map((f) => ({
    holiday: { date: `${year}-${pad2(f.month)}-${pad2(f.day)}`, name: f.name }, rule: f.rule,
  }));
  const lunar = LUNAR[year];
  if (lunar) {
    for (const [d, name] of [[lunar.seol, '설날'], [lunar.chuseok, '추석']] as const) {
      out.push({ holiday: { date: addDays(d, -1), name: `${name} 연휴` }, rule: 'B' });
      out.push({ holiday: { date: d, name }, rule: 'B' });
      out.push({ holiday: { date: addDays(d, 1), name: `${name} 연휴` }, rule: 'B' });
    }
    out.push({ holiday: { date: lunar.buddha, name: '부처님오신날' }, rule: 'A' });
  }
  for (const h of EXTRA) if (h.date.startsWith(`${year}-`)) out.push({ holiday: h, rule: null });
  return out;
}

const cache = new Map<number, Holiday[]>();

export function holidaysOfYear(year: number): Holiday[] {
  const hit = cache.get(year);
  if (hit) return hit;

  const base = baseHolidays(year);
  const count = new Map<string, number>();
  for (const { holiday } of base) count.set(holiday.date, (count.get(holiday.date) ?? 0) + 1);

  // 대체 사유가 있는 날짜(중복 제거) — 규칙군별로 겹침 조건이 다르다
  const triggered = new Set<string>();
  for (const { holiday, rule } of base) {
    const overlapsOther = (count.get(holiday.date) ?? 0) > 1;
    if (rule === 'A' && (isWeekend(holiday.date) || overlapsOther)) triggered.add(holiday.date);
    if (rule === 'B' && (weekdayKo(holiday.date) === '일' || overlapsOther)) triggered.add(holiday.date);
  }

  const taken = new Set(base.map((b) => b.holiday.date));
  const result: Holiday[] = base.map((b) => b.holiday);
  for (const from of [...triggered].sort()) {
    let d = addDays(from, 1);
    while (taken.has(d) || isWeekend(d)) d = addDays(d, 1);
    taken.add(d);
    result.push({ date: d, name: SUBSTITUTE });
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  cache.set(year, result);
  return result;
}

// 그날의 공휴일 이름(겹치면 '·'로 잇는다). 일요일은 공휴일 이름이 아니다 — isRedDay가 따로 본다.
export function holidayName(date: string): string | null {
  const names = holidaysOfYear(Number(date.slice(0, 4))).filter((h) => h.date === date).map((h) => h.name);
  return names.length ? names.join('·') : null;
}

// 빨간날 — 일요일 또는 공휴일
export function isRedDay(date: string): boolean {
  return weekdayKo(date) === '일' || holidayName(date) !== null;
}
