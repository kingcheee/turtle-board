import { describe, it, expect } from 'vitest';
import { holidaysOfYear, holidayName, isRedDay } from '../lib/holidays';

const dates = (year: number) => holidaysOfYear(year).map((h) => h.date);

describe('holidaysOfYear', () => {
  it('2026 — 공휴일 20일 (설·추석 연휴, 대체공휴일 4일, 지방선거 포함)', () => {
    expect(holidaysOfYear(2026)).toEqual([
      { date: '2026-01-01', name: '신정' },
      { date: '2026-02-16', name: '설날 연휴' },
      { date: '2026-02-17', name: '설날' },
      { date: '2026-02-18', name: '설날 연휴' },
      { date: '2026-03-01', name: '삼일절' },
      { date: '2026-03-02', name: '대체공휴일' }, // 삼일절(일)
      { date: '2026-05-05', name: '어린이날' },
      { date: '2026-05-24', name: '부처님오신날' },
      { date: '2026-05-25', name: '대체공휴일' }, // 부처님오신날(일)
      { date: '2026-06-03', name: '지방선거' },
      { date: '2026-06-06', name: '현충일' },
      { date: '2026-08-15', name: '광복절' },
      { date: '2026-08-17', name: '대체공휴일' }, // 광복절(토) → 일요일 건너뛰고 월
      { date: '2026-09-24', name: '추석 연휴' },
      { date: '2026-09-25', name: '추석' },
      { date: '2026-09-26', name: '추석 연휴' },
      { date: '2026-10-03', name: '개천절' },
      { date: '2026-10-05', name: '대체공휴일' }, // 개천절(토)
      { date: '2026-10-09', name: '한글날' },
      { date: '2026-12-25', name: '성탄절' },
    ]);
  });

  it('현충일·신정은 주말과 겹쳐도 대체공휴일이 없다 (2026 현충일 토요일)', () => {
    expect(dates(2026)).not.toContain('2026-06-08');
  });

  it('설·추석 연휴는 토요일과 겹쳐도 대체하지 않는다 (2026 추석 연휴 마지막 날 토요일)', () => {
    expect(dates(2026)).not.toContain('2026-09-28');
  });

  it('설·추석 연휴가 일요일과 겹치면 연휴 뒤 첫 비공휴일이 대체공휴일 (2027 설, 2025 추석)', () => {
    expect(dates(2027)).toContain('2027-02-08'); // 연휴 2/5(금)～2/7(일)
    expect(dates(2025)).toContain('2025-10-08'); // 연휴 10/5(일)～10/7(화)
  });

  it('두 공휴일이 같은 날이면 대체공휴일은 하루만 (2025 어린이날 = 부처님오신날)', () => {
    const d = dates(2025);
    expect(d.filter((x) => x === '2025-05-06')).toHaveLength(1);
    expect(d).not.toContain('2025-05-07');
  });

  it('2025 — 삼일절(토) 대체 3/3, 임시공휴일 1/27, 대통령선거 6/3', () => {
    const d = dates(2025);
    expect(d).toContain('2025-03-03');
    expect(d).toContain('2025-01-27');
    expect(d).toContain('2025-06-03');
  });

  it('2027 — 광복절(일)·개천절(일)·한글날(토)·성탄절(토) 대체공휴일', () => {
    const d = dates(2027);
    expect(d).toEqual(expect.arrayContaining(['2027-08-16', '2027-10-04', '2027-10-11', '2027-12-27']));
    expect(d).not.toContain('2027-06-07'); // 현충일(일)은 대체 없음
  });

  it('음력표에 없는 해는 양력 공휴일만 나오고 던지지 않는다', () => {
    const d = dates(2031);
    expect(d).toContain('2031-01-01');
    expect(d).toContain('2031-10-09');
    expect(d.every((x) => x.startsWith('2031-'))).toBe(true);
  });

  it('날짜순 정렬', () => {
    for (const y of [2025, 2026, 2027]) {
      const d = dates(y);
      expect([...d].sort()).toEqual(d);
    }
  });
});

describe('holidayName', () => {
  it('공휴일이면 이름, 겹치면 · 로 잇고, 아니면 null', () => {
    expect(holidayName('2026-02-17')).toBe('설날');
    expect(holidayName('2026-03-02')).toBe('대체공휴일');
    expect(holidayName('2025-05-05')).toBe('어린이날·부처님오신날');
    expect(holidayName('2026-09-11')).toBeNull();
    expect(holidayName('2026-09-13')).toBeNull(); // 일요일은 공휴일 이름이 아니다
  });
});

describe('isRedDay', () => {
  it('일요일 또는 공휴일', () => {
    expect(isRedDay('2026-09-13')).toBe(true); // 일
    expect(isRedDay('2026-09-12')).toBe(false); // 토
    expect(isRedDay('2026-10-09')).toBe(true); // 한글날(금)
    expect(isRedDay('2026-09-11')).toBe(false);
  });
});
