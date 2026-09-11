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
- 설계 스펙·구현 계획은 `docs/superpowers/`(specs·plans). 2026-08-29 이전 구축 경위·룰링은 비공개
  모노repo `kingcheee/yeondongje-calculator`의 `docs/handoffs/`에 있다 — 이 클론엔 없다.
