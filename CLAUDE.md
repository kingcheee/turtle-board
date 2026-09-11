@AGENTS.md

# 거북이 보드 — 세션 진입점

- **독립 repo다** (2026-08-29 파이널 프로젝트 모노repo에서 분리 — 히스토리는 비공개
  모노repo `kingcheee/yeondongje-calculator`에 있다). 실행·보안·점검 목록은 `README.md`.
- 저장소는 Supabase(드라이버: `lib/storage/`), 실시간은 Realtime 변경 신호.
  배포는 Vercel — GitHub push 자동 배포, 로컬 서빙·터널 없음.
- `data/*.md` 실제 팀 보드 시드는 커밋하지 않는다(.gitignore) — 추적되는 것은
  `data/sample-board.md` 샘플뿐. 정본은 Supabase다.
- 코드 수정 시 반드시 `npm test` 통과 확인. PR도 CI(`.github/workflows/test.yml`)가 같은
  테스트를 돌린다.
- 일정(`lib/events.ts`)·시간표(`lib/timetable.ts`)는 보드와 달리 **행 단위 저장소**(`lib/storage/rows.ts`,
  CAS 없음)다. 클라이언트가 쓰는 타입·순수 함수는 `lib/schedule.ts`·`lib/dates.ts`에만 둔다 — 저장소를
  무는 모듈을 클라이언트 컴포넌트가 import하면 `node:fs` 때문에 빌드가 깨진다(2026-09-11 실측).
- 설계 스펙·구현 계획은 `docs/superpowers/`(specs·plans), 세션 핸드오프는 `docs/handoffs/HANDOFF.md`.
  2026-08-29 이전 구축 경위·룰링은 비공개 모노repo `kingcheee/yeondongje-calculator`의 `docs/handoffs/`에
  있다 — 이 클론엔 없다.
- 로컬 UI 확인은 `npx next dev -p 3123`(3000은 개인 보드 systemd 서비스가 쓴다). `.env.local`이 없으면
  파일 모드·게이트 없음. 커밋은 repo-local `user.email=kingcheee1101@gmail.com`이어야 Vercel이 배포한다.

## 지금 상태 (2026-09-11)

달력·시간표 추가 + 팀 채팅 제거가 **로컬 커밋까지** 끝났고 push(=프로덕션 배포)는 Supabase 테이블 생성 뒤로
보류 중이다. 다음 행동은 `docs/handoffs/HANDOFF.md`의 「다음 액션」.
