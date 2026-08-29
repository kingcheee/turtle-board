'use client';

import type { UiBoard } from '@/lib/kanban/types';
import type { Op } from '@/lib/kanban/ops';
import ColumnView from './ColumnView';

export default function BoardView({ board, onOp, overCol }: {
  board: UiBoard; onOp: (op: Op) => Promise<boolean>; overCol: number | null;
}) {
  return (
    <div className="board">
      {board.columns.map((c, i) => (
        <ColumnView
          key={`${i}-${c.title}`}
          column={c}
          colIndex={i}
          isDropTarget={overCol === i}
          canDelete={board.columns.length > 1}
          onOp={onOp}
        />
      ))}
    </div>
  );
}
