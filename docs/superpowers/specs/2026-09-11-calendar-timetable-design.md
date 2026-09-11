# 달력·시간표 추가 + 팀 채팅 제거 — 설계

> 2026-09-11. 거북이 보드(팀, https://turtle-board.vercel.app)에 **달력**과 **당일 시간표** 화면을
> 추가하고 **팀 채팅 사이드바를 걷어낸다.** 브레인스토밍에서 합의한 내용의 정본이며,
> 구현 계획은 `docs/superpowers/plans/`에 따로 둔다.

## 1. 목표와 범위

- **달력**: 팀 일정(멘토링·방문·해커톤 마감 등)을 월 그리드에서 직접 추가·편집·삭제한다.
  카드 마감(`@{…}`)과는 무관하다 — 마감 표기가 자유 텍스트(`9/1일`, `ASAP`, `금요일 11시`)라
  자동 반영은 하지 않기로 결정했다.
- **시간표**: 하루 단위 시간 블록표. 기본은 오늘, ‹ ›로 날짜 이동. 팀 공용 하나이고
  블록마다 담당자 태그로 누구 것인지 구분한다. 달력과 **별개 저장소**다.
- **팀 채팅 제거**: 사이드바·API·저장소·테스트·CSS를 전부 지운다. 메시지 10개뿐이라 잃는 게 없다.
- 하지 않는 것: 카드 마감 → 달력 자동 반영, 반복 일정, 주간 시간표, 팀원별 시간표,
  블록 날짜 이동, 알림. 필요해지면 그때 따로 설계한다.

## 2. 화면

### 2.1 내비게이션

상단 탭 줄 **맨 앞에 고정 탭 두 개** 「📅 달력」「🕐 시간표」, 얇은 구분선, 그 뒤 보드 탭들과
「+ 보드」. 개인 거북이보드의 「시간표」 고정 탭과 같은 패턴이다.

- 화면 상태는 `screen: 'board' | 'calendar' | 'timetable'`. 첫 접속은 `board`(고정 보드
  「파이널 프로젝트」)로 기존과 같다.
- 보드 화면일 때만 보드 탭 하나가 active. 달력·시간표 화면에서는 고정 탭이 active고 보드 탭은
  모두 비활성.
- 고정 탭은 카드 드롭 지점이 **아니다**(`useDroppable` 없음). 카드를 끌어다 놓아도 아무 일 없다.
- 채팅 사이드바가 빠지므로 본문(`.app`)은 한 칸 전체 폭이다.

### 2.2 달력 화면

- **월 그리드**: 일요일 시작 7열. 그 달 1일이 든 주의 일요일부터 말일이 든 주의 토요일까지
  (5～6주, 항상 7의 배수 칸). 다른 달 칸은 흐리게(`--faint`). 오늘 칸은 날짜 숫자에 accent.
- **헤더**: `‹` `2026년 9월` `›` `오늘`.
- **칸 안**: 일정을 한 줄씩 — 시간 있으면 `14:00 제목`, 없으면 `제목`. 정렬은 시간 없는 것
  먼저, 그다음 시간 오름차순, 같으면 생성 순. 담당자가 있으면 첫 담당자의 색(`lib/members`)을
  배경으로, 없으면 `--sel`. 제목은 한 줄 말줄임.
- **조작**: 칸의 빈 곳 클릭 → 추가 모달(날짜 채워짐). 일정 클릭 → 편집 모달(삭제 버튼 포함).
- **일정 편집 모달**(`EventEditor`): 제목(자동 포커스) · 날짜(`<input type=date>`) ·
  시간(`<input type=time>`, 비울 수 있음) · 담당자(`MemberPicker`, 복수). 편집 모드에서는 날짜도
  바꿀 수 있다(회의가 미뤄지는 경우). 저장 비활성 조건: 제목 공백.
- **조회 범위**: 클라이언트가 그리드 첫 칸～마지막 칸을 `from`·`to`로 요청한다.

### 2.3 시간표 화면

- **헤더**: `‹` `2026-09-11 (금)` `›` `오늘` · 「+ 블록」.
- **블록 목록**: 시작 시각 오름차순(같으면 끝 시각, 그다음 생성 순). 한 행 =
  `[✓] 09:00～09:40  제목  [담당자 칩…]  편집`. 완료 블록은 카드 완료와 같은 표현(취소선·투명도).
- **현재 블록 형광펜**: 보고 있는 날짜가 KST 오늘이고 `start_time ≤ 지금 < end_time`인 블록은
  `--hl` 배경. 1분마다 다시 판정한다.
- **체크박스**: 클릭 즉시 `PATCH {done}`.
- **블록 편집 모달**(`BlockEditor`): 제목 · 시작(`type=time`) · 끝(`type=time`) · 담당자(복수).
  날짜는 보고 있는 날짜로 고정(모달에서 못 바꾼다). 편집 모드에 삭제 버튼. 저장 비활성 조건:
  제목 공백, 시작·끝 미입력, 끝 ≤ 시작.
- **빈 상태**: 「이 날 시간표가 비어 있어요 — + 블록으로 추가」.

### 2.4 공용 컴포넌트

- `MemberPicker` — `CardEditor`의 담당자 드롭다운(버튼 + 체크박스 팝업)을 그대로 뽑아낸 것.
  `value: string[]`, `onChange`. `CardEditor`·`EventEditor`·`BlockEditor` 셋이 쓴다.
- 모달 껍데기는 기존 `.modal-back`/`.modal` CSS와 「누르기 시작한 지점이 배경일 때만 닫기」
  규칙을 그대로 따른다.

## 3. 데이터

### 3.1 행(row) 저장 — 보드와 다른 이유

보드는 문서 통째 + 버전 CAS다(한 파일을 여럿이 동시에 고치므로). 일정·블록은 **행 하나가 독립**이라
CAS가 필요 없다 — 행 단위 insert/update/delete, 마지막 쓰기 승리. 팀 5명 규모에 충분하다.

### 3.2 타입 (DB 컬럼과 같은 이름 — 매핑 코드를 두지 않는다)

```ts
interface TeamEvent {
  id: string;            // uuid
  date: string;          // 'YYYY-MM-DD'
  time: string | null;   // 'HH:MM' (24h) 또는 null = 시간 없음
  title: string;         // 1～200자, 앞뒤 공백 제거
  members: string[];     // lib/members MEMBERS 이름만. 빈 배열 허용
  created_at: string;    // ISO
}

interface TimeBlock {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  start_time: string;    // 'HH:MM'
  end_time: string;      // 'HH:MM', start_time보다 커야 한다 (문자열 비교로 충분 — 자릿수 고정)
  title: string;         // 1～200자
  members: string[];
  done: boolean;
  created_at: string;
}
```

### 3.3 Supabase (`supabase/setup.sql`에 추가 — 재실행 안전)

```sql
create table if not exists kanban_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text,
  title text not null,
  members text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists kanban_events_date on kanban_events(date);

create table if not exists kanban_timetable (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time text not null,
  end_time text not null,
  title text not null,
  members text[] not null default '{}',
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists kanban_timetable_date on kanban_timetable(date);

alter table kanban_events enable row level security;
alter table kanban_timetable enable row level security;
```

RLS 켜고 정책 없음 — 기존 테이블과 같은 방식(anon은 접근 불가, 서버가 service role로 수행).
`kanban_chat` 생성문은 setup.sql에서 뺀다. **이미 있는 테이블은 건드리지 않는다** — 지우고 싶으면
`drop table kanban_chat;`를 수동으로. (README에 적는다.)

PostgREST가 `date` 컬럼을 `'YYYY-MM-DD'` 문자열로 주고받고, `text[]`는 JSON 배열로 주고받는다 —
클라이언트 쪽 변환 없음.

### 3.4 파일 모드 (`.env.local` 없을 때 — 로컬 UI 확인용)

`data/.events.json`·`data/.timetable.json`에 행 배열을 JSON으로. 파일별 프로미스 큐로 쓰기를
직렬화한다(팀 채팅이 쓰던 방식). `id`는 `randomUUID()`, `created_at`은 `new Date().toISOString()`.
두 파일은 `.gitignore`에 추가(`/data/.team-chat.json` 항목은 제거).

### 3.5 공통 드라이버 `lib/storage/rows.ts`

```ts
interface RowFilter { date?: string; from?: string; to?: string }   // from·to 포함 범위

interface RowStore<T extends { id: string }> {
  list(filter: RowFilter): Promise<T[]>;                // 정렬은 호출자 몫
  get(id: string): Promise<T>;                          // 없으면 NotFoundError — 부분 patch 검증(updateBlock의 시작·끝 합산)용
  insert(row: Omit<T, 'id' | 'created_at'>): Promise<T>;
  update(id: string, patch: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T>;  // 없으면 NotFoundError
  remove(id: string): Promise<void>;                    // 없으면 NotFoundError
}

function rowStore<T extends { id: string }>(table: string, file: string): RowStore<T>;
```

- 모드 선택은 `lib/storage/mode.ts`의 `storageMode(): 'supabase' | 'fs'`로 뽑는다 — 지금
  `lib/store.ts`의 `driver()`에 있는 「Vercel에서 env 누락이면 fs 폴백 금지」 검사를 여기로 옮기고
  `store.ts`도 이걸 쓴다(같은 검사가 두 군데 생기지 않게).
- Supabase 구현: `GET /rest/v1/{table}?date=eq.X` 또는 `date=gte.A&date=lte.B`;
  `POST` + `Prefer: return=representation`; `PATCH ?id=eq.{id}` + representation → 0행이면
  NotFoundError; `DELETE ?id=eq.{id}` + representation → 0행이면 NotFoundError. 기존 `sbRest`를
  그대로 쓴다.
- fs 구현: 파일 없으면 빈 배열. 큐는 `globalThis` 키(`__rows:<file>`)에 매달아 dev 핫리로드에도
  하나만 산다(팀 채팅 방식).

### 3.6 기능 모듈

**`lib/events.ts`**
- `validateEventInput(x: unknown): EventInput` — `date`는 `YYYY-MM-DD`이고 실제 존재하는 날짜,
  `time`은 `HH:MM`(00～23, 00～59) 또는 null/미지정, `title` 1～200자(트림), `members`는 배열이고
  전부 `MEMBERS` 이름(중복 제거). 위반은 `RangeError`(한국어 메시지).
- `listEvents(from, to)` — `from ≤ to`이고 `from`～`to`(양끝 포함) 일수가 62를 넘으면 `RangeError`
  (월 그리드는 최대 42일). 정렬: date → time null 먼저 → time → created_at.
- `createEvent(input)` / `updateEvent(id, patch)` / `deleteEvent(id)` — 각각 성공 후
  `broadcastChange({ kind: 'events' })`. patch도 같은 검증(부분 검증).

**`lib/timetable.ts`**
- `validateBlockInput(x)` — date·title·members는 위와 같고, `start_time`·`end_time` 둘 다 `HH:MM`,
  `end_time > start_time`. `done`은 boolean(기본 false).
- `listBlocks(date)` — 정렬: start_time → end_time → created_at.
- `createBlock` / `updateBlock`(done 토글 포함) / `deleteBlock` → `broadcastChange({ kind: 'timetable' })`.
- `currentBlock(blocks, now: 'HH:MM'): TimeBlock | null` — `start ≤ now < end`인 첫 블록(순수 함수,
  UI가 형광펜에 쓴다). **구현은 `lib/schedule.ts`에 있다** — 3.2의 타입과 함께 클라이언트 안전 모듈로 분리
  (`lib/timetable.ts`는 저장소를 물어 클라이언트가 import하면 `node:fs` 때문에 빌드가 깨진다).

**`lib/fields.ts`** (구현 중 추가) — `checkDate`·`checkTime`·`checkTitle`·`checkMembers`·`checkId`. 위 두 모듈이
같이 쓰는 필드 검증을 한 곳에 둔다. `checkId`는 uuid 형식이 아니면 `NotFoundError`(PostgREST 400이 500으로 새는 것을 막는다).

**`lib/dates.ts`** (순수 함수, 서버·클라이언트 공용)
- `isDate(s)`, `isTime(s)`, `addDays(date, n)`, `weekdayKo(date)` → `'금'`,
  `formatMonthKo(ym)` → `'2026년 9월'`.
- `monthGrid(year, month)` → `{ from, to, cells: string[] }` — 2.2의 규칙.
- `kstNow()` → `{ date: 'YYYY-MM-DD', time: 'HH:MM' }` — `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' … })`.
  `lib/store.ts`의 `localStamp()`가 같은 계산을 하므로 그쪽이 이걸 쓰도록 바꾼다.

## 4. API

기존 라우트의 관례를 그대로: `export const dynamic = 'force-dynamic'`, 본문 JSON 오류·
`TypeError` → 400 `bad-request`, `RangeError` → 400 `{error: 메시지}`, `NotFoundError` → 404.
전부 `proxy.ts` 비밀번호 게이트 뒤에 있다(추가 설정 없음).

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /api/events?from=&to=` | 둘 다 필수 | `{ events: TeamEvent[] }` |
| `POST /api/events` | `{ date, time?, title, members? }` | `201 { event }` |
| `PATCH /api/events/[id]` | 위 필드 중 일부 | `{ event }` |
| `DELETE /api/events/[id]` | — | `{ ok: true }` |
| `GET /api/timetable?date=` | 필수 | `{ blocks: TimeBlock[] }` |
| `POST /api/timetable` | `{ date, start_time, end_time, title, members? }` | `201 { block }` |
| `PATCH /api/timetable/[id]` | `{ title?, start_time?, end_time?, members?, done? }` | `{ block }` |
| `DELETE /api/timetable/[id]` | — | `{ ok: true }` |

`PATCH`로 시작·끝 중 하나만 바꿀 때는 저장된 나머지 값과 합쳐서 `end > start`를 검사한다.

## 5. 실시간

- `lib/broadcast.ts`의 `ChangeSignal`을
  `{ kind: 'board'; board } | { kind: 'events' } | { kind: 'timetable' }`로 바꾼다(`chat` 제거).
  신호에 내용은 싣지 않는 원칙 그대로.
- `useRealtime({ onBoard, onEvents, onTimetable, onConnect })`.
- `page.tsx`는 `eventsKey`·`timetableKey`(숫자)를 들고 있다가 해당 신호·재접속(`onConnect`) 때
  +1 한다. `CalendarView`·`TimetableView`는 자기 조회 범위(월/날짜)와 이 키가 바뀔 때 재조회한다.
  화면에 떠 있지 않은 뷰는 마운트되지 않으므로 조회하지 않는다 — 다시 열면 그때 조회한다.

## 6. 팀 채팅 제거 목록

| 지우는 것 | 비고 |
|---|---|
| `components/ChatSidebar.tsx` | |
| `lib/team-chat.ts` | |
| `app/api/team-chat/route.ts` | |
| `tests/team-chat.test.ts` | |
| `app/globals.css`의 `.chat*` `.msg*` `.tmsg*` `.chat-input*` | `button.primary`는 모달이 쓰므로 남긴다 |
| `.app` 그리드 2열 → 1열 | |
| `lib/broadcast.ts`의 `kind: 'chat'` | `tests/broadcast.test.ts`·`store-broadcast.test.ts`의 chat 케이스 갱신 |
| `useRealtime`의 `onChat` | |
| `page.tsx`의 `teamMsgs`·`fetchTeamChat` | |
| `supabase/setup.sql`의 `kanban_chat` | 실제 테이블은 수동 drop |
| `.gitignore`의 `/data/.team-chat.json` | |
| `README.md`의 팀 채팅 항목(쓰는 법·테이블·테스트 목록) | |

## 7. 코드 구조 (변경 후)

```
app/page.tsx                  셸: screen 상태, 보드 목록, 실시간 구독, DndContext (보드 화면만 의미 있음)
components/BoardTabs.tsx      고정 탭 2개 + 구분선 + 보드 탭 (screen·onScreen prop 추가)
components/CalendarView.tsx   월 그리드 + 조회 + EventEditor 호출
components/EventEditor.tsx
components/TimetableView.tsx  하루 블록 목록 + 조회 + BlockEditor 호출 + 1분 타이머
components/BlockEditor.tsx
components/MemberPicker.tsx   CardEditor에서 추출
lib/dates.ts                  순수 날짜 함수 + kstNow
lib/schedule.ts               TeamEvent·TimeBlock 타입 + currentBlock (클라이언트 안전 — 저장소를 물지 않는다)
lib/fields.ts                 일정·블록 공용 필드 검증 (checkDate·checkTime·checkTitle·checkMembers·checkId)
lib/events.ts  lib/timetable.ts   서버 전용 (저장소 + broadcastChange)
lib/storage/mode.ts  lib/storage/rows.ts
app/api/events/route.ts  app/api/events/[id]/route.ts
app/api/timetable/route.ts  app/api/timetable/[id]/route.ts
```

`page.tsx`에서 보드 화면 전용 로직(sendOp·moveCardToBoard·DnD)은 그대로 두되, 달력·시간표 뷰는
자기 데이터를 스스로 조회하는 독립 컴포넌트라 `page.tsx`가 더 커지지 않는다.

## 8. 오류 처리

- 서버 검증 실패(400)는 모달 안에 메시지로 보여주고 입력을 유지한다(채팅이 하던 「전송 실패」 패턴).
- 편집·삭제 대상이 그새 지워져 404면 `window.alert` 후 재조회(보드 409 처리와 같은 결).
- 조회 실패는 조용히 무시하고 이전 화면을 유지한다(다음 신호·조작에서 회복).
- Supabase 쓰기 HTTP 오류는 `Error`로 던져 500 — 기존 드라이버와 같다.

## 9. 테스트 (vitest, 기존처럼 로직만)

| 파일 | 내용 |
|---|---|
| `tests/rows-fs.test.ts` | insert → list(date / from·to) → update → remove, NotFoundError, 병렬 insert 전부 보존 |
| `tests/rows-supabase.test.ts` | fetch 모킹: 쿼리스트링·Prefer 헤더, PATCH/DELETE 0행 → NotFoundError |
| `tests/events.test.ts` | 검증(날짜·시간·제목·담당자), 정렬, 범위 상한, broadcast 호출 |
| `tests/timetable.test.ts` | 검증(끝>시작, 부분 patch 합산), 정렬, `currentBlock` |
| `tests/dates.test.ts` | `monthGrid`(일요일 시작·7배수·from/to), `addDays` 월말·윤년, `isDate` 존재 검사, `kstNow` 형식 |
| 기존 `broadcast`·`store-broadcast` | chat 케이스 제거·events/timetable 케이스 추가 |

UI(달력 그리드·시간표 목록·모달)는 파일 모드로 `npm run dev` 띄워 브라우저에서 확인한다.

## 10. 배포 순서

1. Supabase SQL Editor에서 갱신된 `supabase/setup.sql` 재실행(테이블 2개 생성, 나머지는 no-op).
2. `main`에 push → Vercel 자동 배포. 커밋 이메일은 repo-local `kingcheee1101@gmail.com`
   (다른 이메일이면 Vercel이 배포를 막는다 — 2026-09-07 실측).
3. 배포 후 프로덕션에서 일정·블록 하나씩 추가해 실시간 반영을 확인한다.

## 11. 결정 기록

- 달력은 카드 마감과 무관(사용자 결정, 2026-09-11) — 마감 표기가 자유 텍스트라서.
- 시간표는 당일 하루 표, 달력과 별개 저장소(사용자 결정).
- 행 단위 저장·마지막 쓰기 승리 — CAS는 문서 통째 편집에만 필요.
- 담당자는 카드와 같은 복수 선택 — `MemberPicker`를 추출해 셋이 공유.
- `kanban_chat` 실제 테이블은 남긴다 — 데이터 삭제는 코드 배포와 분리.
