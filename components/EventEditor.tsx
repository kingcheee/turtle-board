'use client';

import { useState } from 'react';
import MemberPicker from './MemberPicker';
import Modal from './Modal';

export interface EventForm { date: string; time: string; end_time: string; title: string; members: string[] } // time·end_time '' = 없음

// 일정 추가·편집 모달. onSubmit이 오류 메시지를 돌려주면 모달을 유지한 채 보여준다(입력은 남는다).
export default function EventEditor({ mode, initial, onSubmit, onDelete, onClose }: {
  mode: 'add' | 'edit';
  initial: EventForm;
  onSubmit: (form: EventForm) => Promise<string | null>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EventForm>(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = !busy && !!form.title.trim() && !!form.date;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setErr('');
    const msg = await onSubmit({ ...form, title: form.title.trim() });
    setBusy(false);
    if (msg) setErr(msg);
  }

  return (
    <Modal title={mode === 'add' ? '일정 추가' : '일정 편집'} onClose={onClose}>
      <input
        placeholder="제목"
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        autoFocus
      />
      <div className="row">
        <input type="date" aria-label="날짜" value={form.date} onChange={(e) => set('date', e.target.value)} />
        <input type="time" aria-label="시작 (선택)" value={form.time} onChange={(e) => set('time', e.target.value)} />
        <input type="time" aria-label="끝 (선택)" value={form.end_time} disabled={!form.time}
          onChange={(e) => set('end_time', e.target.value)} />
        <MemberPicker value={form.members} onChange={(m) => set('members', m)} />
      </div>
      <p className="hint">시간은 비워도 된다 — 비우면 종일 일정. 끝 시각은 시작이 있을 때만.</p>
      {err && <p className="form-err">{err}</p>}
      <div className="actions">
        {mode === 'edit' && onDelete && (
          <button onClick={() => { if (window.confirm('일정을 삭제할까요?')) onDelete(); }}>삭제</button>
        )}
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={!canSave} onClick={save}>저장</button>
      </div>
    </Modal>
  );
}
