// 날짜·시각 순수 함수 — 서버·클라이언트 공용. 값은 전부 문자열('YYYY-MM-DD'·'HH:MM'·'YYYY-MM')이고
// Date 객체는 계산 중에만 UTC로 쓴다(프로세스·브라우저 TZ에 영향받지 않게).

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 형식뿐 아니라 실제 있는 날짜인지도 본다 — '2026-02-30'은 Date가 03-02로 넘겨버려 되돌리면 달라진다
export function isDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = s.match(DATE_RE);
  if (!m) return false;
  return fromUtc(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))) === s;
}

export function isTime(s: unknown): s is string {
  return typeof s === 'string' && TIME_RE.test(s);
}

export function addDays(date: string, n: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function addMonths(ym: string, n: number): string {
  return fromUtc(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1))).slice(0, 7);
}

export function weekdayKo(date: string): string {
  return WEEKDAYS_KO[toUtc(date).getUTCDay()];
}

export function formatMonthKo(ym: string): string {
  return `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(5, 7))}월`;
}

export interface MonthGrid { from: string; to: string; cells: string[] }

// 일요일 시작 월 그리드 — 1일이 든 주의 일요일부터 말일이 든 주의 토요일까지(항상 7의 배수 칸).
export function monthGrid(year: number, month: number): MonthGrid {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const from = addDays(fromUtc(first), -first.getUTCDay());
  const to = addDays(fromUtc(last), 6 - last.getUTCDay());
  const cells: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) cells.push(d);
  return { from, to, cells };
}

// 프로세스·브라우저 TZ와 무관하게 KST — Vercel(TZ=UTC)에서도 정확해야 한다
export function kstNow(now: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
