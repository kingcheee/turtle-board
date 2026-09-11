'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TeamEvent } from '@/lib/schedule';
import { addMonths, formatMonthKo, kstNow, monthGrid } from '@/lib/dates';
import { memberColor } from '@/lib/members';
import { holidayName, isRedDay } from '@/lib/holidays';
import EventEditor, { type EventForm } from './EventEditor';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const JSON_H = { 'Content-Type': 'application/json' };

type Editor = { mode: 'add'; date: string } | { mode: 'edit'; event: TeamEvent };

// 월 그리드 달력 — 자기 조회 범위(그리드 첫 칸～마지막 칸)를 스스로 불러오고, refreshKey가 바뀌면 다시 불러온다.
export default function CalendarView({ refreshKey }: { refreshKey: number }) {
  const [ym, setYm] = useState(() => kstNow().date.slice(0, 7));
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const today = kstNow().date;
  const grid = monthGrid(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)));

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/events?from=${grid.from}&to=${grid.to}`);
      if (!r.ok) return;
      const d = await r.json();
      setEvents(d.events ?? []);
    } catch {}
  }, [grid.from, grid.to]);

  useEffect(() => { refetch(); }, [refetch, refreshKey]);

  const byDate = new Map<string, TeamEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date);
    if (list) list.push(e);
    else byDate.set(e.date, [e]);
  }

  async function submit(form: EventForm): Promise<string | null> {
    const body = { date: form.date, time: form.time || null, title: form.title, members: form.members };
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

  const initial: EventForm | null = editor === null ? null
    : editor.mode === 'add' ? { date: editor.date, time: '', title: '', members: [] }
    : { date: editor.event.date, time: editor.event.time ?? '', title: editor.event.title, members: editor.event.members };

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-nav">
          <button className="nav" onClick={() => setYm(addMonths(ym, -1))} aria-label="이전 달">‹</button>
          <span className="pixel title">{formatMonthKo(ym)}</span>
          <button className="nav" onClick={() => setYm(addMonths(ym, 1))} aria-label="다음 달">›</button>
          <button className="tab ghost" onClick={() => setYm(today.slice(0, 7))}>오늘</button>
        </div>
      </div>
      <div className="cal-wds">
        {WEEKDAYS.map((w) => <div key={w} className={`cal-wd${w === '일' ? ' red' : ''}`}>{w}</div>)}
      </div>
      <div className="cal-grid">
        {grid.cells.map((d) => {
          const holiday = holidayName(d);
          return (
            <div
              key={d}
              className={`cal-cell${d.slice(0, 7) !== ym ? ' other' : ''}${d === today ? ' today' : ''}${isRedDay(d) ? ' red' : ''}`}
              onClick={() => setEditor({ mode: 'add', date: d })}
            >
              <div className="cal-daybar">
                <span className="cal-day">{Number(d.slice(8, 10))}</span>
                {holiday && <span className="cal-hol" title={holiday}>{holiday}</span>}
              </div>
              {(byDate.get(d) ?? []).map((e) => {
                const c = e.members[0] ? memberColor(e.members[0]) : null;
                return (
                  <button
                    key={e.id}
                    className="cal-ev"
                    style={c ? { background: c.bg, color: c.fg } : undefined}
                    title={`${e.time ? `${e.time} ` : ''}${e.title}${e.members.length ? ` — ${e.members.join(', ')}` : ''}`}
                    onClick={(ev) => { ev.stopPropagation(); setEditor({ mode: 'edit', event: e }); }}
                  >
                    {e.time && <span className="cal-ev-time">{e.time}</span>}{e.title}
                  </button>
                );
              })}
            </div>
          );
        })}
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
