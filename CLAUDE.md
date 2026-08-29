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
- 사용자 PC 로컬 체크아웃(`C:\projects\01-final\kanban-board`)에서는 비공개 모노repo 문서
  `../docs/handoffs/HANDOFF.md`(구축 경위·룰링·알려진 한계)가 옆에 있다 — 클론 환경엔 없다.
