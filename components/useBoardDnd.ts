'use client';

import { useState } from 'react';
import {
  PointerSensor, closestCorners, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import type { UiBoard, UiCard } from '@/lib/kanban/types';
import type { Op } from '@/lib/kanban/ops';
import { overBoardName, overColumn, resolveDrop, type Pos } from '@/lib/kanban/dnd-intent';

// 포인터가 들어가 있는 카드·컬럼·보드탭을 우선하고, 사이 틈에서 놓쳤을 때만 모서리 거리로 폴백
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : closestCorners(args);
};

// 드래그 상태는 보드(컬럼)와 상단 탭 양쪽이 같이 봐야 해서 DndContext를 페이지 루트에 둔다.
export function useBoardDnd({ board, onOp, onMoveToBoard }: {
  board: UiBoard | null;
  onOp: (op: Op) => Promise<boolean>;
  onMoveToBoard: (from: Pos, toBoard: string) => Promise<boolean>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeCard, setActiveCard] = useState<UiCard | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function reset() {
    setActiveCard(null);
    setOver(null);
  }

  const dnd = {
    sensors,
    collisionDetection,
    onDragStart(e: DragStartEvent) {
      setActiveCard((e.active.data.current as { card?: UiCard } | undefined)?.card ?? null);
    },
    onDragOver(e: DragOverEvent) {
      setOver(e.over ? String(e.over.id) : null);
    },
    onDragCancel: reset,
    onDragEnd(e: DragEndEvent) {
      reset();
      if (!board) return;
      const intent = resolveDrop(String(e.active.id), e.over ? String(e.over.id) : null, board);
      if (intent.kind === 'move') onOp({ type: 'move', from: intent.from, to: intent.to });
      else if (intent.kind === 'toBoard') onMoveToBoard(intent.from, intent.board);
    },
  };

  return {
    dnd,
    activeCard,
    overCol: activeCard ? overColumn(over) : null,
    overBoard: activeCard ? overBoardName(over) : null,
  };
}
