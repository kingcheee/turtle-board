// 팀원 명단과 배지 색 (2026-08-26 사용자 지정: 기백=노랑·지우=연두·규연=핑크·원준=파랑·지명=회색,
// 전원 담당은 "모두" 태그 — 색은 미지정이라 남는 보라 계열로 정함).
// 카드에는 #이름 태그로 저장되고, 색은 UI에서만 입힌다.

export interface Member { name: string; bg: string; fg: string }

export const MEMBERS: Member[] = [
  { name: '김기백', bg: '#FBE7A2', fg: '#7A5B00' },
  { name: '김지우', bg: '#D9F0BE', fg: '#3F6B1C' },
  { name: '박규연', bg: '#F9D5E2', fg: '#A3355F' },
  { name: '이원준', bg: '#CFE2F8', fg: '#21568F' },
  { name: '정지명', bg: '#E3E3E6', fg: '#55555C' },
  { name: '모두', bg: '#E4D9F5', fg: '#5B3B8F' },
];

const byName = new Map(MEMBERS.map((m) => [m.name, m]));

export function memberColor(name: string): Member {
  return byName.get(name) ?? { name, bg: '#E3E3E6', fg: '#55555C' };
}
