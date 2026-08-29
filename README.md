# 거북이 보드 — 팀 칸반 대시보드

팀 거북이의 웹 칸반 대시보드. **데이터 정본은 Supabase**(`kanban_boards`·
`kanban_chat`·`kanban_trash` 테이블) — `data/*.md`(obsidian-kanban 포맷)는 로컬 파일
모드용 시드일 뿐 정본이 아니다(옵시디언 호환은 2026-08-28 폐기 결정). 이 repo에는
샘플(`data/sample-board.md`)만 추적되고 실제 팀 보드 데이터는 커밋하지 않는다.
설계 문서·구축 이력은 비공개 모노repo(`kingcheee/yeondongje-calculator`)에 있다.

## 실행 (로컬 개발)

    npm install
    npm run dev          # http://localhost:3000
    npm run build

- `.env.local`에 Supabase 키(`NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`·
  `SUPABASE_SERVICE_ROLE_KEY`)가 있으면 **supabase 모드**로 뜬다 — **프로덕션 DB에 직접
  붙는다**, 로컬 실험으로 실데이터를 건드리지 않도록 주의.
- 키가 없으면 **파일 모드**(`data/*.md`)로 뜬다 — 다른 클라이언트와 실시간 동기화는
  안 되지만 로컬 UI 확인용으로는 충분하다. 기여자는 이 모드로 개발하면 된다.

## 기여 (PR 환영)

1. repo를 포크해서 브랜치를 만들고 수정한다.
2. `npm test`가 전부 통과해야 한다 — PR을 올리면 CI(`.github/workflows/test.yml`)가
   같은 테스트를 돌린다.
3. 판정·파싱 로직(`lib/kanban/`)을 고치면 해당 테스트도 함께 추가·수정할 것.

## 배포 (Vercel)

- **프로덕션: https://turtle-board.vercel.app** (Vercel 프로젝트 `turtle-board`,
  Supabase 프로젝트도 `turtle-board`).
- 이 repo 루트가 곧 앱 루트다(Root Directory 설정 없음). GitHub push로 자동 배포.
- 환경 변수 4개(Vercel 프로젝트 설정에 등록):
  `DASHBOARD_PASSWORD` · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` ·
  `SUPABASE_SERVICE_ROLE_KEY`
- **최초 1회 셋업**(순서 고정):
  1. Supabase SQL Editor에서 `supabase/setup.sql` 실행 (테이블·RLS·RPC 함수 생성)
  2. `.env.local`에 위 키 설정
  3. `npm run seed` — `data/*.md` 시드를 Supabase로 적재
  4. Vercel에 위 4개 환경 변수 등록 후 배포
- Vercel 프로젝트 Node 버전 22.x 확인(`@supabase/supabase-js` 요구).

## 보드 쓰는 법 (팀원용)

- **카드 옮기기**: 드래그. 같은 보드 안에서는 컬럼끼리, **다른 보드로 보내려면 카드를 위쪽
  보드 탭에 떨어뜨린다** — 같은 이름의 컬럼으로 들어가고, 그런 컬럼이 없으면 첫 컬럼으로 간다.
- **마감일**: 카드 첫 줄의 `@{...}`. `08-28`처럼 짧게 써도 되고 아예 없어도 된다.
- **담당자**: 카드 추가 창의 담당자 드롭다운(파일에는 `#이름` 태그로 저장).
- **우선순위**: 카드 추가·편집 창의 드롭다운(🔴 급함 · 🟡 보통 · 🟢 여유).
- **컬럼 삭제**: 컬럼 제목 **우클릭** → 「🗑 컬럼 삭제」. 안의 카드까지 함께 지워지고
  **되돌릴 수 없다**(보드 삭제와 달리 휴지통으로 가지 않는다). 마지막 남은 컬럼은 못 지운다.
- **보드 삭제**: 보드 탭 우클릭. 이건 휴지통으로 옮겨져 복구할 수 있다.
- **팀 채팅**: 오른쪽 사이드바. 보내는 사람을 드롭다운에서 고르면 기억된다.

## 실시간 동기화

Supabase Realtime 공개 채널 `kanban`에 **내용 없는 변경 신호**만 흐른다 — 클라이언트는
신호를 받으면 비밀번호 게이트 뒤의 API로 다시 조회해서 최신 상태를 반영한다(신호 자체에
보드·카드 내용은 실리지 않는다).

## 환경 변수 (`.env.local`, 예시는 `.env.local.example`)

- `DASHBOARD_PASSWORD` — 팀 공유 비밀번호. 비우면 게이트 없음(로컬 전용).
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 브라우저에 노출되는 anon 키.
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용. 절대 클라이언트로 보내지 않는다.
- 서버 저장 전환 스위치는 URL+SERVICE_ROLE_KEY 존재 여부다 — 셋 중 일부만 설정하면 반쪽 상태(예:
  anon 없으면 실시간만 죽음)가 되니 셋 다 넣거나 셋 다 비울 것.

## 보안 주의

- **비밀번호 게이트(`proxy.ts`)가 유일한 접근 제어**다. 코드가 바뀌면 핫리로드 없음 —
  재배포 필요.
- **RLS 정책이 없다** — 즉 anon 키만으로는 Supabase 데이터에 직접 접근할 수 없다(테이블에
  아무 정책도 없으면 anon 역할의 기본 접근이 거부된다). 실제 읽기·쓰기는 전부 서버 API가
  `SUPABASE_SERVICE_ROLE_KEY`로 수행한다.
- **Realtime 채널은 공개**지만 내용 없는 변경 신호만 흐른다 — 신호를 엿봐도 보드 내용은
  알 수 없다.

## 테스트

    npm test    # 파서 라운드트립 · 연산 · 저장소(파일/Supabase) · 드래그 판정 · 팀 채팅 · 실시간 브로드캐스트
