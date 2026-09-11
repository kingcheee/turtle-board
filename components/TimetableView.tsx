'use client';

import { useCallback, useEffect, useState } from 'react';
import { currentBlock, type TimeBlock } from '@/lib/schedule';
import { addDays, kstNow, weekdayKo } from '@/lib/dates';
import { memberColor } from '@/lib/members';
import BlockEditor, { type BlockForm } from './BlockEditor';

const JSON_H = { 'Content-Type': 'application/json' };

type Editor = { mode: 'add' } | { mode: 'edit'; block: TimeBlock };

// 당일 시간표 — 보고 있는 날짜의 블록을 스스로 불러오고, refreshKey가 바뀌면 다시 불러온다.
// 오늘이면 현재 시각이 든 블록에 형광펜(1분마다 다시 판정).
export default function TimetableView({ refreshKey }: { refreshKey: number }) {
  const [date, setDate] = useState(() => kstNow().date);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [now, setNow] = useState(kstNow);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(kstNow()), 60_000);
    return () => clearInterval(t);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/timetable?date=${date}`);
      if (!r.ok) return;
      const d = await r.json();
      setBlocks(d.blocks ?? []);
    } catch {}
  }, [date]);

  useEffect(() => { refetch(); }, [refetch, refreshKey]);

  const current = date === now.date ? currentBlock(blocks, now.time) : null;

  async function submit(form: BlockForm): Promise<string | null> {
    try {
      const r = editor?.mode === 'edit'
        ? await fetch(`/api/timetable/${editor.block.id}`, { method: 'PATCH', headers: JSON_H, body: JSON.stringify(form) })
        : await fetch('/api/timetable', { method: 'POST', headers: JSON_H, body: JSON.stringify({ ...form, date }) });
      if (r.status === 404) { window.alert('블록이 그새 지워졌어요'); setEditor(null); await refetch(); return null; }
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        return d?.error ?? `저장 실패 (HTTP ${r.status})`;
      }
    } catch (e) {
      return `저장 실패: ${(e as Error).message}`;
    }
    setEditor(null);
    await refetch();
    return null;
  }

  async function remove(id: string) {
    const r = await fetch(`/api/timetable/${id}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) { window.alert(`삭제 실패 (HTTP ${r.status})`); return; }
    setEditor(null);
    await refetch();
  }

  async function toggleDone(b: TimeBlock) {
    const r = await fetch(`/api/timetable/${b.id}`, { method: 'PATCH', headers: JSON_H, body: JSON.stringify({ done: !b.done }) });
    if (r.status === 404) window.alert('블록이 그새 지워졌어요');
    else if (!r.ok) window.alert(`저장 실패 (HTTP ${r.status})`);
    await refetch();
  }

  const initial: BlockForm | null = editor === null ? null
    : editor.mode === 'add' ? { title: '', start_time: '', end_time: '', members: [] }
    : { title: editor.block.title, start_time: editor.block.start_time, end_time: editor.block.end_time, members: editor.block.members };

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-nav">
          <button className="nav" onClick={() => setDate(addDays(date, -1))} aria-label="전날">‹</button>
          <span className="pixel title">{date} ({weekdayKo(date)})</span>
          <button className="nav" onClick={() => setDate(addDays(date, 1))} aria-label="다음날">›</button>
          <button className="tab ghost" onClick={() => setDate(now.date)}>오늘</button>
        </div>
        <button className="tab ghost screen-side" onClick={() => setEditor({ mode: 'add' })}>+ 블록</button>
      </div>
      {blocks.length === 0 && <p className="tt-empty">이 날 시간표가 비어 있어요 — + 블록으로 추가</p>}
      <div className="tt-list">
        {blocks.map((b) => (
          <div key={b.id} className={`tt-row${b.done ? ' done' : ''}${current?.id === b.id ? ' now' : ''}`}>
            <input type="checkbox" checked={b.done} onChange={() => toggleDone(b)} aria-label="완료" />
            <span className="tt-time">{b.start_time}～{b.end_time}</span>
            <span className="tt-text">{b.title}</span>
            {b.members.map((m) => {
              const c = memberColor(m);
              return <span key={m} className="badge member" style={{ background: c.bg, color: c.fg }}>{m}</span>;
            })}
            <button className="tt-edit" onClick={() => setEditor({ mode: 'edit', block: b })}>편집</button>
          </div>
        ))}
      </div>
      {editor && initial && (
        <BlockEditor
          mode={editor.mode}
          initial={initial}
          onClose={() => setEditor(null)}
          onSubmit={submit}
          onDelete={editor.mode === 'edit' ? () => remove(editor.block.id) : undefined}
        />
      )}
    </div>
  );
}
