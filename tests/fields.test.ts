import { describe, it, expect } from 'vitest';
import { checkDate, checkId, checkMembers, checkTime, checkTitle } from '../lib/fields';
import { NotFoundError } from '../lib/storage/errors';

describe('fields', () => {
  it('checkDate: 형식·존재 검사, 아니면 RangeError', () => {
    expect(checkDate('2026-09-11')).toBe('2026-09-11');
    expect(() => checkDate('2026-02-30')).toThrow(RangeError);
    expect(() => checkDate('9/11')).toThrow(/YYYY-MM-DD/);
    expect(() => checkDate(undefined)).toThrow(RangeError);
  });

  it('checkTime: HH:MM만', () => {
    expect(checkTime('09:05')).toBe('09:05');
    expect(() => checkTime('9:05')).toThrow(/HH:MM/);
    expect(() => checkTime(null)).toThrow(RangeError);
  });

  it('checkTitle: 트림, 빈 값·200자 초과·비문자열 거부', () => {
    expect(checkTitle('  회의  ')).toBe('회의');
    expect(() => checkTitle('   ')).toThrow(/비어/);
    expect(() => checkTitle('a'.repeat(201))).toThrow(/200자/);
    expect(checkTitle('a'.repeat(200))).toHaveLength(200);
    expect(() => checkTitle(123)).toThrow(RangeError);
  });

  it('checkMembers: 미지정은 [], 명단 밖 이름 거부, 중복 제거', () => {
    expect(checkMembers(undefined)).toEqual([]);
    expect(checkMembers(['김지우', '모두', '김지우'])).toEqual(['김지우', '모두']);
    expect(() => checkMembers(['외부인'])).toThrow(/팀원이 아님: 외부인/);
    expect(() => checkMembers('김지우')).toThrow(RangeError);
    expect(() => checkMembers([1])).toThrow(RangeError);
  });

  it('checkId: UUID만 통과, 아니면 NotFoundError', () => {
    expect(checkId('11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
    expect(() => checkId('abc')).toThrow(NotFoundError);
    expect(() => checkId('')).toThrow(NotFoundError);
  });
});
