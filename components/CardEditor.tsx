'use client';

import { useEffect, useState } from 'react';
import type { Priority } from '@/lib/kanban/types';
import { rawPriority, withRawPriority } from '@/lib/kanban/parse';
import MemberPicker from './MemberPicker';
import Modal from './Modal';

export default function CardEditor({ mode, initial, onSubmit, onDelete, onClose }: {
  mode: 'add' | 'edit';
  initial: { raw: string } | null;
  onSubmit: (p: { title?: string; priority?: Priority; due?: string; assignees?: string[]; description?: string; raw?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('🟡');
  const [due, setDue] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [raw, setRaw] = useState(initial?.raw ?? '');

  useEffect(() => {
    setRaw(initial?.raw ?? '');
  }, [initial?.raw]);

  return (
    <Modal title={mode === 'add' ? '카드 추가' : '카드 편집'} onClose={onClose}>
      {mode === 'add' ? (
        <>
          <input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <div className="row">
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
              <option value="🔴">🔴 급함</option>
              <option value="🟡">🟡 보통</option>
              <option value="🟢">🟢 여유</option>
              <option value="">없음</option>
            </select>
            <input placeholder="마감 (예: 08-28 — 비워도 됨)" value={due} onChange={(e) => setDue(e.target.value)} />
            <MemberPicker value={assignees} onChange={setAssignees} />
          </div>
          <textarea placeholder="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </>
      ) : (
        <>
          <textarea className="raw" value={raw} onChange={(e) => setRaw(e.target.value)} autoFocus />
          <p className="hint">카드 마크다운 원문 — 첫 줄이 카드, 다음 줄들은 설명(자동 탭 들여쓰기).
            마감은 첫 줄의 @{'{'}...{'}'} — 08-28처럼 짧게 써도, 아예 빼도 된다.</p>
        </>
      )}
      <div className="actions">
        {mode === 'edit' && (
          <select
            aria-label="우선순위"
            value={rawPriority(raw) ?? ''}
            onChange={(e) => setRaw(withRawPriority(raw, (e.target.value || null) as Priority | null))}
          >
            <option value="🔴">🔴 급함</option>
            <option value="🟡">🟡 보통</option>
            <option value="🟢">🟢 여유</option>
            <option value="">없음</option>
          </select>
        )}
        {mode === 'edit' && onDelete && (
          <button onClick={() => { if (window.confirm('카드를 삭제할까요?')) onDelete(); }}>삭제</button>
        )}
        <button onClick={onClose}>취소</button>
        <button
          className="primary"
          disabled={mode === 'add' ? !title.trim() : !raw.trim()}
          onClick={() => (mode === 'add'
            ? onSubmit({ title: title.trim(), priority: priority || undefined, due: due.trim() || undefined, assignees: assignees.length ? assignees : undefined, description })
            : onSubmit({ raw }))}
        >
          저장
        </button>
      </div>
    </Modal>
  );
}
