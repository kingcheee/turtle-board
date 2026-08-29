'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Realtime 공개 채널 'kanban' 구독 — 서버가 쓰기 성공 후 보내는 내용 없는
// 변경 신호({kind:'board',board}|{kind:'chat'})를 받아 재조회를 트리거한다.
// env 미설정(fs dev 모드)이면 구독하지 않는다(단일 사용자 — 무동기화 수용).
// onConnect는 구독 성립·재성립 시마다 불린다 — 연결 공백 동안 놓친 신호를 전체 재조회로 보정.
export function useRealtime(handlers: {
  onBoard: (board: string) => void;
  onChat: () => void;
  onConnect: () => void;
}): void {
  const { onBoard, onChat, onConnect } = handlers;
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supa = createClient(url, key);
    const ch = supa
      .channel('kanban')
      .on('broadcast', { event: 'change' }, ({ payload }) => {
        if (payload?.kind === 'chat') onChat();
        else if (payload?.kind === 'board' && typeof payload.board === 'string') onBoard(payload.board);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') onConnect();
      });
    return () => { void supa.removeChannel(ch); };
  }, [onBoard, onChat, onConnect]);
}
