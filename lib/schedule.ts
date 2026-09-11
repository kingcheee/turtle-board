// 일정의 타입과 순수 함수 — 클라이언트 컴포넌트가 import하므로 node 모듈을 끌어오면 안 된다
// (lib/events.ts는 저장소를 물고 있어 서버 전용). 일정 하나가 달력과 그날 시간표 양쪽에 보인다.

export interface TeamEvent {
  id: string;
  date: string;             // 'YYYY-MM-DD'
  time: string | null;      // 'HH:MM' 또는 null = 시간 없음(종일)
  end_time: string | null;  // 'HH:MM' 또는 null — time이 있을 때만, time보다 늦어야 한다
  title: string;
  members: string[];        // lib/members MEMBERS 이름만
  done: boolean;            // 시간표의 완료 체크
  created_at: string;
}

// 정렬된 목록에서 time ≤ now < end_time 인 첫 일정 — 시간표 형광펜용. 끝 시각 없는 일정·종일은 제외.
export function currentEvent(events: TeamEvent[], now: string): TeamEvent | null {
  return events.find((e) => e.time !== null && e.end_time !== null && e.time <= now && now < e.end_time) ?? null;
}
