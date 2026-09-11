import { describe, it, expect } from 'vitest';
import { addDays, addMonths, formatMonthKo, isDate, isTime, kstNow, monthGrid, weekdayKo } from '../lib/dates';

describe('isDate', () => {
  it('YYYY-MM-DD 형식이고 실제 있는 날짜만 true', () => {
    expect(isDate('2026-09-11')).toBe(true);
    expect(isDate('2028-02-29')).toBe(true); // 윤년
    expect(isDate('2026-02-29')).toBe(false); // 평년
    expect(isDate('2026-13-01')).toBe(false);
    expect(isDate('2026-9-1')).toBe(false);
    expect(isDate('20260911')).toBe(false);
    expect(isDate(20260911)).toBe(false);
    expect(isDate(null)).toBe(false);
  });
});

describe('isTime', () => {
  it('HH:MM 24시간제만 true', () => {
    expect(isTime('00:00')).toBe(true);
    expect(isTime('23:59')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(isTime('9:30')).toBe(false);
    expect(isTime('09:60')).toBe(false);
    expect(isTime('09:30:00')).toBe(false);
    expect(isTime(930)).toBe(false);
  });
});

describe('addDays / addMonths', () => {
  it('월말·연말·윤년을 넘는다', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-11', 0)).toBe('2026-09-11');
  });
  it('addMonths: 연도 경계', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-09', 0)).toBe('2026-09');
  });
});

describe('weekdayKo / formatMonthKo', () => {
  it('2026-09-11은 금요일, 09-13은 일요일', () => {
    expect(weekdayKo('2026-09-11')).toBe('금');
    expect(weekdayKo('2026-09-13')).toBe('일');
  });
  it('formatMonthKo: 앞자리 0 없이', () => {
    expect(formatMonthKo('2026-09')).toBe('2026년 9월');
    expect(formatMonthKo('2026-12')).toBe('2026년 12월');
  });
});

describe('monthGrid', () => {
  it('2026년 9월: 1일이 화요일 → 8/30(일)부터 10/3(토)까지 35칸', () => {
    const g = monthGrid(2026, 9);
    expect(g.from).toBe('2026-08-30');
    expect(g.to).toBe('2026-10-03');
    expect(g.cells).toHaveLength(35);
    expect(g.cells[0]).toBe('2026-08-30');
    expect(g.cells[34]).toBe('2026-10-03');
  });
  it('1일이 일요일이면 그 날부터 시작한다 (2026년 11월)', () => {
    const g = monthGrid(2026, 11);
    expect(g.from).toBe('2026-11-01');
    expect(g.to).toBe('2026-12-05');
    expect(g.cells).toHaveLength(35);
  });
  it('6주짜리 달 (2026년 8월: 토요일 시작, 31일)', () => {
    const g = monthGrid(2026, 8);
    expect(g.from).toBe('2026-07-26');
    expect(g.to).toBe('2026-09-05');
    expect(g.cells).toHaveLength(42);
  });
  it('칸 수는 항상 7의 배수, 연속된 날짜', () => {
    for (let m = 1; m <= 12; m++) {
      const g = monthGrid(2026, m);
      expect(g.cells.length % 7).toBe(0);
      for (let i = 1; i < g.cells.length; i++) expect(g.cells[i]).toBe(addDays(g.cells[i - 1], 1));
    }
  });
});

describe('kstNow', () => {
  it('UTC 15:30 = KST 다음날 00:30 (프로세스 TZ 무관)', () => {
    expect(kstNow(new Date('2026-09-11T15:30:00Z'))).toEqual({ date: '2026-09-12', time: '00:30' });
    expect(kstNow(new Date('2026-09-11T00:05:00Z'))).toEqual({ date: '2026-09-11', time: '09:05' });
  });
  it('인자 없으면 지금', () => {
    const n = kstNow();
    expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.time).toMatch(/^\d{2}:\d{2}$/);
  });
});
