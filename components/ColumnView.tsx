'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { UiColumn } from '@/lib/kanban/types';
import type { Op } from '@/lib/kanban/ops';
import { cardId, columnId } from '@/lib/kanban/dnd-intent';
import CardView from './CardView';
import CardEditor from './CardEditor';

export default function ColumnView({ column, colIndex, isDropTarget, canDelete, onOp }: {
  column: UiColumn; colIndex: number; isDropTarget?: boolean; canDelete?: boolean;
  onOp: (op: Op) => Promise<boolean>;
}) {
  const { setNodeRef } = useDroppable({ id: columnId(colIndex) });
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const ids = column.cards.map((_, i) => cardId(colIndex, i));

  return (
    <div className={`column${isDropTarget ? ' drop-target' : ''}`} ref={setNodeRef}>
      <div
        className="col-title pixel"
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        title="우클릭 — 컬럼 삭제"
      >
        {column.title}
        <span className="col-count">{column.cards.length}</span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {column.cards.map((card, i) => (
          <CardView key={ids[i]} id={ids[i]} card={card} colIndex={colIndex} cardIndex={i} onOp={onOp} />
        ))}
      </SortableContext>
      <button className="add-card" onClick={() => setAdding(true)}>+ 카드</button>
      {menu && (
        <>
          <div className="ctx-back" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="ctx-menu" style={{ left: menu.x, top: menu.y }}>
            <button
              className="danger"
              disabled={!canDelete}
              title={canDelete ? undefined : '마지막 남은 컬럼은 삭제할 수 없어요'}
              onClick={() => {
                setMenu(null);
                const n = column.cards.length;
                const warn = n > 0 ? `\n안에 있는 카드 ${n}장도 함께 지워집니다.` : '';
                if (window.confirm(`컬럼 "${column.title}"을(를) 삭제할까요?${warn}\n(되돌릴 수 없어요)`)) {
                  onOp({ type: 'deleteColumn', column: colIndex });
                }
              }}
            >
              🗑 컬럼 삭제
            </button>
          </div>
        </>
      )}
      {adding && (
        <CardEditor
          mode="add"
          initial={null}
          onClose={() => setAdding(false)}
          onSubmit={async (p) => {
            await onOp({ type: 'add', column: colIndex, title: p.title ?? '', priority: p.priority, due: p.due || undefined, assignees: p.assignees, description: p.description || undefined });
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
