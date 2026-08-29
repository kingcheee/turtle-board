-- 거북이 보드 v2 스키마 — Supabase SQL Editor에 한 번 붙여넣어 실행한다.
-- 재실행해도 안전(idempotent): create table if not exists + create or replace function.

create table if not exists kanban_boards (
  name text primary key,
  content text not null,
  version text not null,
  updated_at timestamptz not null default now()
);

create table if not exists kanban_chat (
  id uuid primary key default gen_random_uuid(),
  sender text not null,
  text text not null,
  ts timestamptz not null default now()
);

create table if not exists kanban_trash (
  id bigint generated always as identity primary key,
  name text not null,
  content text not null,
  trashed_at timestamptz not null default now()
);

-- RLS 켜고 정책 없음: anon·authenticated는 아무것도 못 읽고 못 쓴다.
-- 서버(service role)는 RLS를 우회한다. anon 키는 Realtime 구독에만 쓰인다.
alter table kanban_boards enable row level security;
alter table kanban_chat enable row level security;
alter table kanban_trash enable row level security;

-- 보드 간 카드 이동 — 두 보드를 한 트랜잭션에서 버전 조건부 갱신.
-- 하나라도 stale이면 전체 롤백 + 'version-conflict' 예외 (서버가 409로 변환).
create or replace function kanban_move_card(
  src_name text, src_version text, src_content text, src_new_version text,
  dst_name text, dst_version text, dst_content text, dst_new_version text
) returns void
language plpgsql
as $$
begin
  update kanban_boards
    set content = dst_content, version = dst_new_version, updated_at = now()
    where name = dst_name and version = dst_version;
  if not found then
    raise exception 'version-conflict';
  end if;
  update kanban_boards
    set content = src_content, version = src_new_version, updated_at = now()
    where name = src_name and version = src_version;
  if not found then
    raise exception 'version-conflict';
  end if;
end
$$;

-- anon이 RPC를 직접 호출하지 못하게 (PostgREST는 기본으로 노출한다)
revoke execute on function kanban_move_card(text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
