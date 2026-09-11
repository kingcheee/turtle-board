# HANDOFF — 달력·시간표 배포 (updated 2026-09-11)

## 목표

팀 거북이 보드(https://turtle-board.vercel.app, GitHub `kingcheee/turtle-board`)에 **달력·당일 시간표를 추가하고
팀 채팅을 뺀** 변경을 프로덕션에 올린다. 완료 판정: Supabase에 `kanban_events`·`kanban_timetable` 테이블이 있고,
`main`이 push되어 Vercel 배포가 success이며, 프로덕션에서 일정·블록을 하나씩 추가했을 때 다른 탭에 실시간 반영된다.

## 현재 상태

- [x] 설계 스펙 `docs/superpowers/specs/2026-09-11-calendar-timetable-design.md` (사용자 승인, 커밋 `1d8d232`)
- [x] 구현 완료 · 로컬 커밋 5개(`1d8d232`·`384ab06`·`099e07d`·`dbe36a0`·`faf1615`, 작성자 전부 `kingcheee1101@gmail.com`).
      검증: `npx tsc --noEmit` 통과 · `npm test` 16파일 163 통과 · `npm run build` 통과 · 파일 모드(`next dev -p 3123`)
      브라우저 실측(탭 전환·일정 추가·블록 추가/완료 토글/편집 모달·카드 편집의 담당자 팝업). 계획·검증 기록은
      `docs/superpowers/plans/2026-09-11-calendar-timetable.md`.
- [ ] **Supabase 테이블 생성** — `supabase/setup.sql` 재실행. 이 세션은 Brave Origin의 Supabase가 로그아웃 상태라
      (SQL Editor URL이 sign-in으로 리다이렉트) 실행하지 못했다. 로그인은 사용자만 할 수 있다.
- [ ] **`git push origin main`** — 테이블이 없는 채 push하면 배포된 달력·시간표 API가 500이라(보드는 정상) **일부러
      보류**했다. 위 SQL이 끝난 뒤 push한다.
- [ ] 프로덕션 확인.

## 계획 (전문)

배포 순서는 스펙 §10과 같다. 대화에만 있던 세부:

1. 사용자가 Supabase 대시보드에 로그인 → 프로젝트 `turtle-board`(ref `sszupzdfarrewtavpisa`) → SQL Editor
   (`https://supabase.com/dashboard/project/sszupzdfarrewtavpisa/sql/new`) → `supabase/setup.sql` **전체**를 붙여넣고 Run.
   파일 전체가 idempotent(`create table if not exists`·`create or replace function`·`alter table … enable row level security`
   재실행 안전)라 기존 테이블·RPC는 no-op이고 새 테이블 2개 + 인덱스 2개만 생긴다. `kanban_chat`은 건드리지 않는다.
   - Brave에 로그인만 해 두면 Claude in Chrome으로 대신 실행할 수 있다(에디터는 Monaco — `window.monaco`가 있으니
     `monaco.editor.getModels()[0].setValue(sql)`로 넣고 Run 버튼 클릭). 확인은 Table Editor에 두 테이블이 보이면 된다.
   - 대안 확인 명령(서비스 롤 키는 `~/.config/turtle-board/.env.supabase.keys.backup`):
     `set -a; . ~/.config/turtle-board/.env.supabase.keys.backup; set +a; curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/kanban_events?select=id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"`
     → `[]`이면 테이블 있음, `{"code":"PGRST205"…}`류면 아직 없음.
2. `cd ~/projects/03-personal/turtle-board-team && git log -1 --format=%ae`가 `kingcheee1101@gmail.com`인지 보고
   `git push origin main`. 다른 이메일 커밋은 Vercel이 배포를 막는다(2026-09-07 실측).
3. 배포 상태: `gh api repos/kingcheee/turtle-board/commits/$(git rev-parse HEAD)/status --jq '.state'` → `success`.
   (직전 배포 커밋 `a797788`이 success였다.)
4. 프로덕션(비밀번호 게이트 — `DASHBOARD_PASSWORD`는 Vercel 환경변수, 사용자가 안다)에서 「📅 달력」에 일정 하나,
   「🕐 시간표」에 블록 하나 추가 → 다른 브라우저 탭에서 새로고침 없이 반영되는지(Realtime `{kind:'events'|'timetable'}`).
5. 원하면 Supabase에서 `drop table kanban_chat;` — 메시지 10개뿐, 코드는 더 이상 안 본다. 필수 아님.

## 결정사항과 이유

- 달력은 카드 마감(`@{…}`)과 무관한 독립 저장소 — 마감 표기가 자유 텍스트(`9/1일`·`ASAP`·`금요일 11시`)라 자동 반영 불가(사용자 결정).
- 시간표는 당일 하루 표, 달력과 별개 저장소(사용자 결정). 팀 공용 하나, 담당자 태그로 구분.
- 일정·블록은 행 단위 저장(`lib/storage/rows.ts`), 마지막 쓰기 승리 — CAS는 문서 통째 편집(보드)에만 필요.
- 담당자는 카드처럼 복수 선택(`MemberPicker` 공유). 블록의 날짜는 모달에서 못 바꾼다(지우고 다시 추가).
- 스펙과 달라진 점 둘: `lib/schedule.ts`(클라이언트 안전 타입·`currentBlock`)와 `lib/fields.ts`(공용 검증)를 뺐고,
  `RowStore`에 `get(id)`를 넣었다(부분 patch의 시작·끝 합산 검사용). 이유는 계획 문서 Self-Review에.
- 체크아웃 위치 `~/projects/03-personal/turtle-board-team/` — 2026-09-07 정리 때 `01-final/kanban-board`가 「중복
  체크아웃」으로 삭제됐고(모노repo `.gitignore` 항목도 빠짐), `03-personal/turtle-board`는 개인 파일 모드 보드(systemd
  서비스 실행 중), `03-personal/kanban-board`는 8/28 스냅샷에서 갈라진 개인 포크라 셋 다 이 repo가 아니다.
- `.env.local`은 일부러 안 뒀다 — 키가 있으면 `npm run dev`가 프로덕션 DB에 직접 붙는다. 필요하면
  `cp ~/.config/turtle-board/.env.supabase.keys.backup .env.local`.

## 시도했지만 안 된 것

- `next build`가 `node:fs/promises` 때문에 깨졌다 — `TimetableView`가 `lib/timetable.ts`에서 `currentBlock`을 import해
  저장소 모듈이 클라이언트 번들로 끌려 들어갔다. 타입·순수 함수를 `lib/schedule.ts`로 분리해 해결. 클라이언트는
  `lib/schedule.ts`·`lib/dates.ts`·`lib/members.ts`만 import한다(프로젝트 CLAUDE.md에 규칙으로 적음).
- Claude in Chrome으로 Supabase SQL Editor 실행 — 로그아웃 상태라 sign-in으로 리다이렉트. 로그인은 대신 못 한다.
- 브라우저 도구의 스크린샷이 클릭 직후 30초 타임아웃(「renderer frozen」)을 자주 냈지만 앱 문제가 아니었다(다시 찍으면
  정상, 콘솔 오류 없음). 좌표 클릭보다 `find` → ref 클릭이 안정적이다.

## 핵심 파일·명령

- repo: `~/projects/03-personal/turtle-board-team/` (remote `kingcheee/turtle-board`, repo-local user.email 설정됨)
- 스펙 `docs/superpowers/specs/2026-09-11-calendar-timetable-design.md` · 계획 `docs/superpowers/plans/2026-09-11-calendar-timetable.md`
- SQL `supabase/setup.sql` · 서버 `lib/events.ts` `lib/timetable.ts` `lib/storage/rows.ts` · 클라이언트 `components/CalendarView.tsx`
  `components/TimetableView.tsx` `components/BoardTabs.tsx` `app/page.tsx`
- `npm test` · `npx tsc --noEmit` · `npm run build` · 로컬 UI: `npx next dev -p 3123`(3000은 개인 보드 서비스가 쓴다) 후
  `http://localhost:3123`(파일 모드, 게이트 없음)
- Supabase 키 백업: `~/.config/turtle-board/.env.supabase.keys.backup` (값은 여기 적지 않는다)

## 다음 액션
<!-- NEXT-ACTIONS -->
- [ ] 사용자에게 Supabase 로그인(또는 직접 `supabase/setup.sql` 실행)을 요청하고, 위 curl로 `kanban_events`가 생겼는지 확인
- [ ] 테이블 확인 후 `git push origin main` → `gh api repos/kingcheee/turtle-board/commits/$(git rev-parse HEAD)/status --jq .state`가 success인지
- [ ] 프로덕션에서 일정·블록 추가 → 다른 탭 실시간 반영 확인
- [ ] (선택) 스펙 §7·§3.5에 `lib/schedule.ts`·`lib/fields.ts`·`RowStore.get` 반영 — 계획 Self-Review에 적어둔 차이
<!-- /NEXT-ACTIONS -->

## 추천 스킬·도구

- `claude-in-chrome` — 사용자가 Brave에서 Supabase에 로그인해 두면 SQL 실행·프로덕션 실시간 확인을 브라우저로 한다.
- 새 기능 요청이 오면 `superpowers:brainstorming`부터(이 repo는 스펙 → 계획 흐름으로 작업했다).

## 주의사항

- **push = 프로덕션 배포**(GitHub push 자동). 테이블 생성 전엔 push하지 않는다.
- 커밋 이메일은 반드시 `kingcheee1101@gmail.com`(repo-local 설정 완료). 전역은 `turtle.jiwoo@gmail.com`이라 다른 repo에서
  체크아웃하면 다시 설정해야 한다.
- `data/.events.json`·`data/.timetable.json`(파일 모드 실데이터)은 gitignore. 프로덕션 정본은 Supabase.
- `kanban_chat` 테이블 drop은 사용자 판단 — 시키지 않으면 하지 않는다.
