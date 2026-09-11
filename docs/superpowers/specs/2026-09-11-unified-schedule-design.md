# 달력·시간표 통합 — 일정 하나가 두 화면에 — 설계

> 2026-09-11. 같은 날 앞서 만든 `2026-09-11-calendar-timetable-design.md`의 「시간표는 달력과 별개 저장소」 결정을
> 뒤집는다(사용자 결정: 「하나로 합친다」). 그 문서의 §2.3·§3.6 `lib/timetable.ts`·§4 `/api/timetable`은 이 문서로 대체된다.

## 1. 결정

- **일정(event) 하나 = 달력에도, 그날 시간표에도.** 시간표 블록이라는 별도 데이터는 없앤다.
  어느 화면에서 넣든 둘 다에 보이고, 한 곳에서 고치면 같이 바뀐다.
- `kanban_events`에 `done boolean not null default false` 추가(시간표의 완료 체크가 일정에 붙는다).
- `kanban_timetable` 테이블·`/api/timetable`·`lib/timetable.ts`·`BlockEditor`는 삭제. (프로덕션 테이블은 비어 있었다 — 옮길 행 없음.)

## 2. 화면

- **시간표** = 보고 있는 날짜의 일정 목록. 정렬은 달력과 같다: 시간 없는 것(종일) 먼저 → 시작 시각 → 생성 순.
  행: 체크박스(done) · 시간(`14:00～15:30` / `14:00` / `종일`) · 제목 · 담당자 배지 · 편집.
  형광펜(현재 진행): `time ≤ now < end_time` — 끝 시각이 없는 일정은 칠하지 않는다. 1분마다 재판정(기존과 같음).
  「+ 일정」은 보고 있는 날짜가 채워진 일정 모달을 연다. 빈 날 안내: 「이 날 일정이 없어요 — + 일정으로 추가」.
- **달력** = 기존 그대로 + done인 일정은 취소선·흐리게.
- **편집 모달**은 `EventEditor` 하나(제목·날짜·시작·끝·담당자). 시간표에서 열어도 날짜를 바꿀 수 있다(그러면 그날 목록에서 사라지고 달력의 새 날짜에 보인다).

## 3. 데이터·API

- `TeamEvent`에 `done: boolean`. `validateEventInput`: `done` 미지정이면 false, 오면 boolean. patch는 boolean만.
- `/api/events` GET·POST·PATCH·DELETE 그대로(필드만 늘어남). 시간표도 `GET /api/events?from=D&to=D`로 읽는다.
- 실시간 신호는 `{kind:'events'}` 하나. `{kind:'timetable'}` 제거 — 두 화면 모두 `events` 신호로 재조회.
- `lib/schedule.ts`: `TimeBlock`·`currentBlock` → `currentEvent(events, now)`.

## 4. 배포 순서

1. Supabase: `alter table kanban_events add column if not exists done boolean not null default false;` (구 코드는 이 컬럼을 무시한다)
2. `git push` → Vercel.
3. 프로덕션에서 달력에 넣은 일정이 시간표에 보이고, 시간표 체크가 달력에 반영되는지.
4. `drop table kanban_timetable;` — 새 코드가 더 이상 안 읽는 것을 확인한 뒤 마지막에.
