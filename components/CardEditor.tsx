'use client';

import { useEffect, useRef, useState } from 'react';
import type { Priority } from '@/lib/kanban/types';
import { rawPriority, withRawPriority } from '@/lib/kanban/parse';
import { MEMBERS, memberColor } from '@/lib/members';

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
  const [namesOpen, setNamesOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [raw, setRaw] = useState(initial?.raw ?? '');
  // 입력창에서 시작한 드래그(텍스트 선택)가 모달 밖에서 끝나면 click이 배경에서 발생한다 —
  // "누르기 시작한 지점"이 배경일 때만 닫아야 입력 내용이 날아가지 않는다.
  const downOnBack = useRef(false);

  function toggleAssignee(name: string) {
    setAssignees((a) => a.includes(name) ? a.filter((x) => x !== name) : [...a, name]);
  }

  useEffect(() => {
    setRaw(initial?.raw ?? '');
  }, [initial?.raw]);

  return (
    <div
      className="modal-back"
      onPointerDown={(e) => { downOnBack.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (downOnBack.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="pixel">{mode === 'add' ? '카드 추가' : '카드 편집'}</h2>
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
              <div className="name-dd">
                <button type="button" onClick={() => setNamesOpen((o) => !o)}>
                  {assignees.length === 0
                    ? '담당자'
                    : assignees.map((a) => {
                        const c = memberColor(a);
                        return <span key={a} className="name-chip" style={{ background: c.bg, color: c.fg }}>{a}</span>;
                      })}
                </button>
                {namesOpen && (
                  <>
                    <div className="ctx-back" onClick={() => setNamesOpen(false)} />
                    <div className="name-pop">
                      {MEMBERS.map((m) => (
                        <label key={m.name}>
                          <input
                            type="checkbox"
                            checked={assignees.includes(m.name)}
                            onChange={() => toggleAssignee(m.name)}
                          />
                          <span className="name-dot" style={{ background: m.bg, borderColor: m.fg }} />
                          <span style={{ color: m.fg }}>{m.name}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
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
      </div>
    </div>
  );
}
