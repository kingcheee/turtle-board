'use client';

import { useCallback, useEffect, useState } from 'react';
import { currentEvent, type TeamEvent } from '@/lib/schedule';
import { addDays, kstNow, weekdayKo } from '@/lib/dates';
import { memberColor } from '@/lib/members';
import EventEditor, { type EventForm } from './EventEditor';

const JSON_H = { 'Content-Type': 'application/json' };

type Editor = { mode: 'add' } | { mode: 'edit'; event: TeamEvent };

// 당일 시간표 — 보고 있는 날짜의 일정(달력과 같은 행)을 스스로 불러오고, refreshKey가 바뀌면 다시 불러온다.
// 종일 일정 먼저, 그다음 시작 시각 순(서버 정렬). 오늘이면 현재 시각이 든 일정에 형광펜(1분마다 다시 판정).
export default function TimetableView({ refreshKey }: { refreshKey: number }) {
  const [date, setDate] = useState(() => kstNow().date);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [now, setNow] = useState(kstNow);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(kstNow()), 60_000);
    return () => clearInterval(t);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/events?from=${date}&to=${date}`);
      if (!r.ok) return;
      const d = await r.json();
      setEvents(d.events ?? []);
    } catch {}
  }, [date]);

  useEffect(() => { refetch(); }, [refetch, refreshKey]);

  const current = date === now.date ? currentEvent(events, now.time) : null;

  async function submit(form: EventForm): Promise<string | null> {
    const time = form.time || null;
    const body = { date: form.date, time, end_time: time ? form.end_time || null : null, title: form.title, members: form.members };
    try {
      const r = editor?.mode === 'edit'
        ? await fetch(`/api/events/${editor.event.id}`, { method: 'PATCH', headers: JSON_H, body: JSON.stringify(body) })
        : await fetch('/api/events', { method: 'POST', headers: JSON_H, body: JSON.stringify(body) });
      if (r.status === 404) { window.alert('일정이 그새 지워졌어요'); setEditor(null); await refetch(); return null; }
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
    const r = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) { window.alert(`삭제 실패 (HTTP ${r.status})`); return; }
    setEditor(null);
    await refetch();
  }

  async function toggleDone(e: TeamEvent) {
    const r = await fetch(`/api/events/${e.id}`, { method: 'PATCH', headers: JSON_H, body: JSON.stringify({ done: !e.done }) });
    if (r.status === 404) window.alert('일정이 그새 지워졌어요');
    else if (!r.ok) window.alert(`저장 실패 (HTTP ${r.status})`);
    await refetch();
  }

  const initial: EventForm | null = editor === null ? null
    : editor.mode === 'add' ? { date, time: '', end_time: '', title: '', members: [] }
    : { date: editor.event.date, time: editor.event.time ?? '', end_time: editor.event.end_time ?? '',
        title: editor.event.title, members: editor.event.members };

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-nav">
          <button className="nav" onClick={() => setDate(addDays(date, -1))} aria-label="전날">‹</button>
          <span className="pixel title">{date} ({weekdayKo(date)})</span>
          <button className="nav" onClick={() => setDate(addDays(date, 1))} aria-label="다음날">›</button>
          <button className="tab ghost" onClick={() => setDate(now.date)}>오늘</button>
        </div>
        <button className="tab ghost screen-side" onClick={() => setEditor({ mode: 'add' })}>+ 일정</button>
      </div>
      {events.length === 0 && <p className="tt-empty">이 날 일정이 없어요 — + 일정으로 추가</p>}
      <div className="tt-list">
        {events.map((e) => (
          <div key={e.id} className={`tt-row${e.done ? ' done' : ''}${current?.id === e.id ? ' now' : ''}`}>
            <input type="checkbox" checked={e.done} onChange={() => toggleDone(e)} aria-label="완료" />
            <span className={`tt-time${e.time ? '' : ' allday'}`}>
              {e.time ? (e.end_time ? `${e.time}～${e.end_time}` : e.time) : '종일'}
            </span>
            <span className="tt-text">{e.title}</span>
            {e.members.map((m) => {
              const c = memberColor(m);
              return <span key={m} className="badge member" style={{ background: c.bg, color: c.fg }}>{m}</span>;
            })}
            <button className="tt-edit" onClick={() => setEditor({ mode: 'edit', event: e })}>편집</button>
          </div>
        ))}
      </div>
      {editor && initial && (
        <EventEditor
          mode={editor.mode}
          initial={initial}
          onClose={() => setEditor(null)}
          onSubmit={submit}
          onDelete={editor.mode === 'edit' ? () => remove(editor.event.id) : undefined}
        />
      )}
    </div>
  );
}
