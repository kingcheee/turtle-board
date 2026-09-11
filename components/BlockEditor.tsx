'use client';

import { useState } from 'react';
import MemberPicker from './MemberPicker';
import Modal from './Modal';

export interface BlockForm { title: string; start_time: string; end_time: string; members: string[] }

// 시간표 블록 추가·편집 모달 — 날짜는 보고 있는 날로 고정이라 폼에 없다.
export default function BlockEditor({ mode, initial, onSubmit, onDelete, onClose }: {
  mode: 'add' | 'edit';
  initial: BlockForm;
  onSubmit: (form: BlockForm) => Promise<string | null>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BlockForm>(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof BlockForm>(k: K, v: BlockForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = !busy && !!form.title.trim() && !!form.start_time && !!form.end_time && form.end_time > form.start_time;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setErr('');
    const msg = await onSubmit({ ...form, title: form.title.trim() });
    setBusy(false);
    if (msg) setErr(msg);
  }

  return (
    <Modal title={mode === 'add' ? '블록 추가' : '블록 편집'} onClose={onClose}>
      <input
        placeholder="제목"
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        autoFocus
      />
      <div className="row">
        <input type="time" aria-label="시작" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
        <input type="time" aria-label="끝" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
        <MemberPicker value={form.members} onChange={(m) => set('members', m)} />
      </div>
      {form.start_time && form.end_time && form.end_time <= form.start_time && (
        <p className="form-err">끝 시각은 시작보다 늦어야 해요</p>
      )}
      {err && <p className="form-err">{err}</p>}
      <div className="actions">
        {mode === 'edit' && onDelete && (
          <button onClick={() => { if (window.confirm('블록을 삭제할까요?')) onDelete(); }}>삭제</button>
        )}
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={!canSave} onClick={save}>저장</button>
      </div>
    </Modal>
  );
}
