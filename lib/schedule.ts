// 일정·시간표의 타입과 순수 함수 — 클라이언트 컴포넌트가 import하므로 node 모듈을 끌어오면 안 된다
// (lib/events.ts·lib/timetable.ts는 저장소를 물고 있어 서버 전용).

export interface TeamEvent {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  time: string | null;   // 'HH:MM' 또는 null = 시간 없음
  title: string;
  members: string[];     // lib/members MEMBERS 이름만
  created_at: string;
}

export interface TimeBlock {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  start_time: string;  // 'HH:MM'
  end_time: string;    // 'HH:MM', start_time보다 커야 한다(자릿수 고정이라 문자열 비교로 충분)
  title: string;
  members: string[];
  done: boolean;
  created_at: string;
}

// 정렬된 목록에서 start ≤ now < end 인 첫 블록 — 시간표 형광펜용
export function currentBlock(blocks: TimeBlock[], now: string): TimeBlock | null {
  return blocks.find((b) => b.start_time <= now && now < b.end_time) ?? null;
}
