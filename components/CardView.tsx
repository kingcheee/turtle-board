'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UiCard } from '@/lib/kanban/types';
import type { Op } from '@/lib/kanban/ops';
import { memberColor } from '@/lib/members';
import CardEditor from './CardEditor';

// 표시용 축약 — 올해 연도는 뗀다 ('2026-08-28 21:05' → '08-28 21:05')
function shortTime(ts: string): string {
  return ts.startsWith(`${new Date().getFullYear()}-`) ? ts.slice(5) : ts;
}

export function CardBody({ meta, onToggle, onEdit }: {
  meta: UiCard['meta']; onToggle?: () => void; onEdit?: () => void;
}) {
  return (
    <>
      <div className="card-title">{meta.priority ? `${meta.priority} ` : ''}{meta.title}</div>
      {meta.description && <div className="card-desc">{meta.description}</div>}
      {meta.due && <span className="badge">@ {meta.due}</span>}
      {meta.doneDate && <span className="badge">✅ {meta.doneDate}</span>}
      {meta.assignees.map((a) => {
        const c = memberColor(a);
        return <span key={a} className="badge member" style={{ background: c.bg, color: c.fg }}>{a}</span>;
      })}
      <div className="card-actions">
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onToggle}>
          {meta.checked ? '↩ 복구' : '✓ 완료'}
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onEdit}>편집</button>
        {(meta.createdAt || meta.updatedAt) && (
          <span className="card-times">
            {meta.createdAt && <span title={`만든 시간 ${meta.createdAt}`}>⊕ {shortTime(meta.createdAt)}</span>}
            {meta.updatedAt && <span title={`수정 시간 ${meta.updatedAt}`}>✎ {shortTime(meta.updatedAt)}</span>}
          </span>
        )}
      </div>
    </>
  );
}

export default function CardView({ id, card, colIndex, cardIndex, onOp }: {
  id: string; card: UiCard; colIndex: number; cardIndex: number;
  onOp: (op: Op) => Promise<boolean>;
}) {
  // data.card — 드래그 오버레이가 id를 되파싱하지 않고 카드를 바로 집어 쓰게
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { card } });
  const [editing, setEditing] = useState(false);
  const { meta } = card;

  return (
    <>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`card${meta.checked ? ' done' : ''}`}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined }}
      >
        <CardBody
          meta={meta}
          onToggle={() => onOp({ type: 'toggle', column: colIndex, index: cardIndex })}
          onEdit={() => setEditing(true)}
        />
      </div>
      {editing && (
        <CardEditor
          mode="edit"
          initial={{ raw: card.raw }}
          onClose={() => setEditing(false)}
          onSubmit={async (p) => {
            if (p.raw !== undefined) await onOp({ type: 'edit', column: colIndex, index: cardIndex, raw: p.raw });
            setEditing(false);
          }}
          onDelete={async () => {
            await onOp({ type: 'delete', column: colIndex, index: cardIndex });
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
