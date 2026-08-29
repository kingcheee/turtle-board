'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { UiBoard } from '@/lib/kanban/types';
import type { Op } from '@/lib/kanban/ops';
import type { Pos } from '@/lib/kanban/dnd-intent';
import type { TeamChatMsg } from '@/lib/team-chat';
import BoardTabs from '@/components/BoardTabs';
import BoardView from '@/components/BoardView';
import { CardBody } from '@/components/CardView';
import ChatSidebar from '@/components/ChatSidebar';
import { useBoardDnd } from '@/components/useBoardDnd';
import { useRealtime } from '@/components/useRealtime';

export default function Page() {
  const [boards, setBoards] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [board, setBoard] = useState<UiBoard | null>(null);
  const [teamMsgs, setTeamMsgs] = useState<TeamChatMsg[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const boardRef = useRef(board);
  boardRef.current = board;

  const refetchBoards = useCallback(async () => {
    const r = await fetch('/api/boards');
    const { boards } = await r.json();
    setBoards(boards);
    setActive((cur) => cur && boards.includes(cur) ? cur : boards[0] ?? null);
  }, []);

  const refetch = useCallback(async () => {
    const name = activeRef.current;
    if (!name) return;
    const r = await fetch(`/api/boards/${encodeURIComponent(name)}`);
    if (r.status === 404) { await refetchBoards(); return; }
    if (!r.ok) return;
    const data = await r.json();
    if (activeRef.current !== name) return;
    setBoard(data);
  }, [refetchBoards]);

  useEffect(() => { refetchBoards(); }, [refetchBoards]);
  useEffect(() => { setBoard(null); refetch(); }, [active, refetch]);

  const fetchTeamChat = useCallback(async () => {
    try {
      const r = await fetch('/api/team-chat');
      if (!r.ok) return;
      const d = await r.json();
      setTeamMsgs(d.messages ?? []);
    } catch {}
  }, []);

  useEffect(() => { fetchTeamChat(); }, [fetchTeamChat]);

  const onRemoteBoard = useCallback((b: string) => {
    if (b === activeRef.current) refetch();
    else refetchBoards();
  }, [refetch, refetchBoards]);

  const onConnect = useCallback(() => {
    refetchBoards();
    refetch();
    fetchTeamChat();
  }, [refetchBoards, refetch, fetchTeamChat]);

  useRealtime({ onBoard: onRemoteBoard, onChat: fetchTeamChat, onConnect });

  const sendOp = useCallback(async (op: Op): Promise<boolean> => {
    const name = activeRef.current;
    const cur = boardRef.current;
    if (!name || !cur || cur.name !== name) return false;
    const r = await fetch(`/api/boards/${encodeURIComponent(name)}/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, version: cur.version }),
    });
    if (r.status === 409) { await refetch(); return false; }
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      window.alert(body?.error ?? `요청 실패 (HTTP ${r.status})`);
      return false;
    }
    await refetch();
    return true;
  }, [refetch]);

  const moveCardToBoard = useCallback(async (from: Pos, toBoard: string): Promise<boolean> => {
    const name = activeRef.current;
    const cur = boardRef.current;
    if (!name || !cur || cur.name !== name) return false;
    const r = await fetch(`/api/boards/${encodeURIComponent(name)}/move-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: cur.version, from, toBoard }),
    });
    if (r.status === 409) { await refetch(); return false; }
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      window.alert(body?.error ?? `보드 이동 실패 (HTTP ${r.status})`);
      return false;
    }
    await refetch();
    return true;
  }, [refetch]);

  const onDeleteBoard = useCallback(async (name: string) => {
    const r = await fetch(`/api/boards/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      window.alert(body?.error ?? `삭제 실패 (HTTP ${r.status})`);
      return;
    }
    await refetchBoards();
  }, [refetchBoards]);

  const { dnd, activeCard, overCol, overBoard } = useBoardDnd({
    board, onOp: sendOp, onMoveToBoard: moveCardToBoard,
  });

  const onCreate = useCallback(async (name: string) => {
    const r = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (r.ok) { await refetchBoards(); setActive(name); }
  }, [refetchBoards]);

  return (
    <DndContext {...dnd}>
      <div className="topbar">
        <h1 className="pixel">거북이 보드</h1>
        <BoardTabs
          boards={boards}
          active={active}
          overBoard={overBoard}
          onSelect={setActive}
          onCreate={onCreate}
          onDelete={onDeleteBoard}
        />
      </div>
      <div className="app">
        {board
          ? <BoardView board={board} onOp={sendOp} overCol={overCol} />
          : <p style={{ padding: 24 }}>불러오는 중…</p>}
        <ChatSidebar teamMsgs={teamMsgs} onSent={fetchTeamChat} />
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className={`card drag-overlay${activeCard.meta.checked ? ' done' : ''}`}>
            <CardBody meta={activeCard.meta} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
