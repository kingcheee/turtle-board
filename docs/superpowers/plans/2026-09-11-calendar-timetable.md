# 달력·시간표 추가 + 팀 채팅 제거 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 거북이 보드에 팀 달력(월 그리드)과 당일 시간표 화면을 붙이고 팀 채팅 사이드바를 걷어낸다.

**Architecture:** 일정·블록은 보드(문서 통째 + CAS)와 달리 **행 단위 저장소**(`lib/storage/rows.ts`, Supabase PostgREST / 파일 모드 JSON)에 넣는다. 서버 모듈(`lib/events.ts`·`lib/timetable.ts`)이 검증·정렬·신호 발신을 맡고, 클라이언트 뷰(`CalendarView`·`TimetableView`)는 자기 조회 범위를 스스로 불러오며 실시간 신호로 올라오는 `refreshKey`가 바뀌면 다시 불러온다. 화면 전환은 탭 줄 맨 앞의 고정 탭 두 개.

**Tech Stack:** Next.js 16.3 (App Router, `proxy.ts` 게이트), React 19, Supabase(PostgREST + Realtime broadcast), vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-11-calendar-timetable-design.md`

## Global Constraints

- 날짜는 `'YYYY-MM-DD'`, 시각은 `'HH:MM'`(24시간), 월은 `'YYYY-MM'` — 전부 문자열. Date 객체는 계산 중 UTC로만.
- 제목 1～200자(트림). 담당자는 `lib/members.ts`의 `MEMBERS` 이름만, 중복 제거, 빈 배열 허용.
- 일정 조회 범위(양끝 포함) 62일 초과 → 400. 블록 `end_time > start_time`(문자열 비교).
- 서버 오류 매핑은 기존 라우트와 동일: `SyntaxError`·`TypeError` → 400 `bad-request`, `RangeError` → 400 `{error}`, `NotFoundError` → 404.
- **클라이언트 컴포넌트는 `lib/schedule.ts`·`lib/dates.ts`·`lib/members.ts`만 import한다.** 저장소를 무는 `lib/events.ts`·`lib/timetable.ts`를 클라이언트가 import하면 `node:fs/promises` 때문에 `next build`가 깨진다(이 세션 실측).
- 커밋 이메일은 repo-local `kingcheee1101@gmail.com`(다른 이메일이면 Vercel 배포 차단).
- 한국어 주석·메시지, 기존 코드 밀도에 맞춘다.

## 실행 기록

이 계획은 스펙 승인 직후 **같은 세션에서 코드를 먼저 초안·검증하며** 썼다(tsc·vitest 163개·`next build`·파일 모드 브라우저 실측 통과). 아래 작업은 그 검증된 변경을 컴파일되는 단위로 잘라 커밋하는 순서다. 각 작업의 「검증」은 실제로 돌린 명령이다.

---

### Task 1: 날짜 함수·행 저장소·필드 검증 (기반 모듈)

**Files:**
- Create: `lib/dates.ts`, `lib/fields.ts`, `lib/storage/mode.ts`, `lib/storage/rows.ts`
- Modify: `lib/store.ts` (`driver()` → `storageMode()`, `localStamp()` → `kstNow()`), `vitest.config.ts` (`@` 별칭)
- Test: `tests/dates.test.ts`, `tests/fields.test.ts`, `tests/rows-fs.test.ts`, `tests/rows-supabase.test.ts`

**Interfaces (Produces):**
```ts
// lib/dates.ts
isDate(s: unknown): s is string; isTime(s: unknown): s is string
addDays(date: string, n: number): string; addMonths(ym: string, n: number): string
weekdayKo(date: string): string; formatMonthKo(ym: string): string
monthGrid(year: number, month: number): { from: string; to: string; cells: string[] }
kstNow(now?: Date): { date: string; time: string }
// lib/fields.ts — 통과하면 정규화 값, 아니면 RangeError(checkId는 NotFoundError)
checkDate, checkTime, checkTitle(v: unknown): string; checkMembers(v: unknown): string[]; checkId(v: string): string
// lib/storage/mode.ts
storageMode(): 'supabase' | 'fs'   // VERCEL에서 env 누락이면 throw (store.ts의 가드를 옮김)
// lib/storage/rows.ts
interface Row { id: string; date: string; created_at: string }
interface RowFilter { date?: string; from?: string; to?: string }
interface RowStore<T extends Row> { list(f); get(id); insert(row); update(id, patch); remove(id) }
rowStore<T extends Row>(table: string, file: string): RowStore<T>   // 호출 시점의 env로 모드 결정
```

- [x] **Step 1: 테스트 작성** — `tests/dates.test.ts`(isDate 존재 검사·윤년, isTime, addDays 월말·연말, addMonths 연도 경계, weekdayKo, formatMonthKo, monthGrid 2026-09/11/08 + 12개월 7배수·연속, kstNow UTC15:30→다음날00:30), `tests/fields.test.ts`(5개 검증 함수), `tests/rows-fs.test.ts`(빈 목록·insert 파일 저장·date/from·to 필터·get·update·remove·NotFoundError·동시 insert 3건·파일 분리), `tests/rows-supabase.test.ts`(fetch 모킹 — eq/gte/lte 쿼리, POST/PATCH/DELETE + `Prefer: return=representation`, 0행 → NotFoundError, HTTP 오류 → Error)
- [x] **Step 2: 구현** — 위 4개 모듈. `rows.ts`의 fs 큐는 `globalThis['__rows:<file>']`에 매달아 핫리로드에도 하나만 산다.
- [x] **Step 3: `lib/store.ts` 리팩터** — `driver()`는 `storageMode()`로, `localStamp()`는 `kstNow()`로. 기존 `store-broadcast.test.ts`의 「VERCEL 가드」·`kst-stamp.test.ts`가 그대로 통과해야 한다.
- [x] **Step 4: `vitest.config.ts`에 `resolve: { alias: { '@': process.cwd() } }`** — Task 3의 라우트 테스트가 `app/api/*`를 불러오려면 필요.
- [x] **Step 5: 검증** — `npx tsc --noEmit` / `npm test` → 기존 120 + 신규 통과
- [ ] **Step 6: 커밋** — `feat: 날짜 함수·행 저장소·필드 검증 모듈`

### Task 2: 일정·시간표 서버 모듈 + API 라우트 + SQL

**Files:**
- Create: `lib/schedule.ts`(클라이언트 안전 타입·`currentBlock`), `lib/events.ts`, `lib/timetable.ts`, `app/api/events/route.ts`, `app/api/events/[id]/route.ts`, `app/api/timetable/route.ts`, `app/api/timetable/[id]/route.ts`
- Modify: `lib/broadcast.ts`(`ChangeSignal`에 `events`·`timetable` 추가 — `chat`은 Task 4까지 남긴다), `supabase/setup.sql`(테이블 2개 + RLS)
- Test: `tests/events.test.ts`, `tests/timetable.test.ts`, `tests/api-schedule.test.ts`

**Interfaces:**
- Consumes: Task 1 전부.
- Produces:
```ts
// lib/schedule.ts
interface TeamEvent { id; date; time: string | null; title; members: string[]; created_at }
interface TimeBlock { id; date; start_time; end_time; title; members: string[]; done: boolean; created_at }
currentBlock(blocks: TimeBlock[], now: string): TimeBlock | null
// lib/events.ts (서버 전용)
validateEventInput(x: unknown): EventInput; validateEventPatch(x: unknown): Partial<EventInput>
listEvents(from: unknown, to: unknown); createEvent(input); updateEvent(id, patch); deleteEvent(id)  // 쓰기 후 {kind:'events'}
// lib/timetable.ts (서버 전용)
validateBlockInput(x); validateBlockPatch(x, current: Pick<TimeBlock,'start_time'|'end_time'>): BlockPatch  // 날짜는 못 바꾼다
listBlocks(date); createBlock(input); updateBlock(id, patch)  /* get → 검증 → update */; deleteBlock(id)  // {kind:'timetable'}
// API (스펙 §4 표 그대로)
GET /api/events?from=&to= → {events} · POST → 201 {event} · PATCH/DELETE /api/events/[id]
GET /api/timetable?date= → {blocks} · POST → 201 {block} · PATCH/DELETE /api/timetable/[id]
```

- [x] **Step 1: 테스트 작성** — `tests/events.test.ts`(입력·patch 검증, 정렬 date→시간없음→시간→생성, 62일 경계 9/1～11/1 허용·11/2 거부, update/delete·NotFoundError·uuid 아닌 id, 신호 3회·실패 시 0회), `tests/timetable.test.ts`(입력 검증 끝≤시작, patch 합산 검사, currentBlock 경계, 정렬 시작→끝→생성, done 토글, 신호), `tests/api-schedule.test.ts`(핸들러 직접 호출 — 400/201/200/404 매핑)
- [x] **Step 2: 구현** — 위 모듈·라우트. `updateBlock`은 항상 `get` 먼저(시작·끝 하나만 바꿀 때 순서 검사에 저장값이 필요하고, 404가 검증보다 먼저 난다).
- [x] **Step 3: `supabase/setup.sql`** — `kanban_events`·`kanban_timetable`(스펙 §3.3 그대로) + `date` 인덱스 + RLS. `kanban_chat` 생성문은 빼고 「수동 drop」 주석.
- [x] **Step 4: 검증** — `npm test`(163 통과), `npx tsc --noEmit`
- [ ] **Step 5: 커밋** — `feat: 일정·시간표 서버 모듈 + API 라우트 + Supabase 테이블`

### Task 3: 공용 컴포넌트 추출 — Modal·MemberPicker

**Files:**
- Create: `components/Modal.tsx`, `components/MemberPicker.tsx`
- Modify: `components/CardEditor.tsx`(둘을 쓰도록 — 동작 변화 없음)

- [x] **Step 1: `Modal`** — `{ title, onClose, children }`. 「누르기 시작한 지점이 배경일 때만 닫기」 규칙을 그대로 옮긴다.
- [x] **Step 2: `MemberPicker`** — `{ value: string[], onChange }`. CardEditor의 `name-dd`/`name-pop` 마크업 그대로.
- [x] **Step 3: `CardEditor`** — `useRef`·`namesOpen`·`toggleAssignee`·`MEMBERS` import 제거, `<Modal>`·`<MemberPicker value={assignees} onChange={setAssignees} />`.
- [x] **Step 4: 검증** — `npx tsc --noEmit`; 브라우저에서 「+ 카드」 → 담당자 팝업 열림 확인(실측)
- [ ] **Step 5: 커밋** — `refactor: Modal·MemberPicker 공용 컴포넌트 추출`

### Task 4: 달력·시간표 화면 + 탭 + 팀 채팅 제거 + 문서

**Files:**
- Create: `components/EventEditor.tsx`, `components/CalendarView.tsx`, `components/BlockEditor.tsx`, `components/TimetableView.tsx`
- Modify: `components/BoardTabs.tsx`(고정 탭 + `Screen` 타입), `app/page.tsx`(screen 상태·`eventsKey`/`timetableKey`·채팅 제거), `components/useRealtime.ts`(`onChat` → `onEvents`·`onTimetable`), `lib/broadcast.ts`(`chat` 제거), `app/globals.css`(채팅 CSS 제거·`.app` 1열·`.tab-sep`·`.screen*`·`.cal-*`·`.tt-*`·`.form-err`), `tests/broadcast.test.ts`(`chat` → `events`), `.gitignore`, `README.md`, `CLAUDE.md`
- Delete: `components/ChatSidebar.tsx`, `lib/team-chat.ts`, `app/api/team-chat/route.ts`, `tests/team-chat.test.ts`

**Interfaces:**
- Consumes: `lib/schedule.ts`·`lib/dates.ts`·`lib/members.ts`(클라이언트), Task 2 API, Task 3 컴포넌트.
- Produces: `BoardTabs` props `{ screen, boards, active, overBoard, onScreen, onSelect, onCreate, onDelete }`; `CalendarView`/`TimetableView` props `{ refreshKey: number }`; `EventForm { date; time: ''|'HH:MM'; title; members }`; `BlockForm { title; start_time; end_time; members }`; 편집 모달 `onSubmit(form) → Promise<string | null>`(오류 메시지면 모달 유지).

- [x] **Step 1: 채팅 제거** — 파일 4개 삭제, `broadcast.ts`·`useRealtime.ts`·`page.tsx`·CSS·`.gitignore`(`/data/.team-chat.json` → `/data/.events.json`·`/data/.timetable.json`)에서 흔적 제거.
- [x] **Step 2: `BoardTabs`** — `FIXED = [달력, 시간표]` 고정 탭 + `.tab-sep` + 보드 탭(`isActive = screen === 'board' && b === active`).
- [x] **Step 3: `page.tsx`** — `screen` 상태, `onSelectBoard`(보드 클릭·생성 시 `screen='board'`), `onEvents`/`onTimetable`이 키 +1, `onConnect`는 넷 다 재조회, 본문은 screen별 분기.
- [x] **Step 4: `CalendarView` + `EventEditor`** — `monthGrid` 칸 렌더, `byDate` 맵, 빈 칸 클릭 → add(날짜 채움), 일정 클릭(`stopPropagation`) → edit, 첫 담당자 색, 404 → alert + 재조회, 400 → 모달 안 메시지.
- [x] **Step 5: `TimetableView` + `BlockEditor`** — 날짜 ‹ ›·오늘, 1분 타이머로 `kstNow()` 갱신, `currentBlock`에 `.now`(`--hl`), 체크박스 PATCH `{done}`, 빈 상태 문구, 블록 모달은 날짜 없음·끝≤시작 즉시 경고.
- [x] **Step 6: CSS** — 스펙 §2 표현. `.cal-grid{grid-auto-rows:minmax(92px,1fr)}`, `.tt-row.now{background:var(--hl)}`.
- [x] **Step 7: 문서** — README(개요 테이블 목록·파일 모드 파일·setup.sql 재실행·「달력·시간표」 절·신호 종류·테스트 목록·`kanban_chat` 수동 drop), CLAUDE.md(행 저장소·클라이언트 import 규칙·docs 위치).
- [x] **Step 8: 검증** — `npx tsc --noEmit` / `npm test`(16 파일 163 통과) / `npm run build`(라우트 8개 생성) / 파일 모드 `next dev -p 3123`으로 브라우저 실측: 탭 전환, 달력에 일정 추가(9/17 10:30 김지우) → 초록 표시, 시간표 블록 3개·현재 블록 형광펜·완료 토글·블록 추가·편집 모달, 카드 추가 모달의 담당자 팝업.
- [ ] **Step 9: 커밋** — `feat: 달력·시간표 화면 추가, 팀 채팅 제거`

### Task 5: 배포

- [ ] **Step 1: Supabase SQL Editor에서 `supabase/setup.sql` 재실행** — `kanban_events`·`kanban_timetable` 생성(나머지는 no-op). **push보다 먼저** — 테이블 없이 배포되면 달력·시간표 API가 500.
- [ ] **Step 2: `git push origin main`** → Vercel 자동 배포. 커밋 작성자 이메일이 `kingcheee1101@gmail.com`인지 `git log -1 --format=%ae`로 확인.
- [ ] **Step 3: 프로덕션 확인** — https://turtle-board.vercel.app 에서 일정·블록 하나씩 추가, 다른 탭에서 실시간 반영.

## Self-Review

- **Spec coverage**: §2.1 탭(Task 4-2·3) · §2.2 달력(4-4) · §2.3 시간표(4-5) · §2.4 공용 컴포넌트(Task 3) · §3.2～3.6 데이터(Task 1·2) · §4 API(Task 2) · §5 실시간(4-3, `useRealtime`) · §6 제거 목록(4-1·7) · §7 구조(파일 목록 일치 + `lib/schedule.ts`·`lib/fields.ts` 추가 — 클라이언트/서버 분리와 검증 공유를 위해) · §8 오류 처리(4-4·5) · §9 테스트(Task 1·2 + 라우트 테스트 추가) · §10 배포(Task 5).
- **스펙과 다른 점**: `lib/schedule.ts`(타입·`currentBlock`)와 `lib/fields.ts`(공용 검증)를 뺐다 — 스펙 §7엔 없지만 클라이언트 번들 문제와 중복 제거 때문. `RowStore`에 `get(id)`가 추가됐다(`updateBlock`의 합산 검사용). 스펙에 반영할 만한 차이는 이 둘뿐이다.
- **Type consistency**: `EventForm.time`은 `''`가 「없음」이고 API로 보낼 때 `null`로 바꾼다(`CalendarView.submit`). `BlockPatch`는 `date`를 제외한 Partial. 라우트의 `Ctx = { params: Promise<{ id: string }> }`는 기존 `[name]` 라우트와 같은 꼴.
