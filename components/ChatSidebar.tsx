'use client';

import { useEffect, useRef, useState } from 'react';
import type { TeamChatMsg } from '@/lib/team-chat';
import { MEMBERS, memberColor } from '@/lib/members';

function fmtTime(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function ChatSidebar({ teamMsgs, onSent }: { teamMsgs: TeamChatMsg[]; onSent: () => void }) {
  const [open, setOpen] = useState(true);
  const [sender, setSender] = useState('');
  const [teamInput, setTeamInput] = useState('');
  const [teamErr, setTeamErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = localStorage.getItem('team-sender');
    if (s) setSender(s);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [teamMsgs]);

  function pickSender(name: string) {
    setSender(name);
    localStorage.setItem('team-sender', name);
  }

  async function sendTeam() {
    const text = teamInput.trim();
    if (!text || !sender) return;
    setTeamInput('');
    setTeamErr('');
    try {
      const r = await fetch('/api/team-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, text }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onSent();
    } catch (e) {
      setTeamErr(`전송 실패: ${(e as Error).message}`);
      setTeamInput(text);
    }
  }

  if (!open) {
    return (
      <div className="chat closed">
        <button className="tab" style={{ margin: 12 }} onClick={() => setOpen(true)}>💬 챗</button>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <span className="tab active">팀 채팅</span>
        <button onClick={() => setOpen(false)}>닫기</button>
      </div>
      <div className="chat-msgs">
        {teamMsgs.length === 0 && <div className="msg busy">아직 메시지가 없어요 — 첫 메시지를 남겨보세요.</div>}
        {teamMsgs.map((m) => {
          const c = memberColor(m.sender);
          const mine = sender !== '' && m.sender === sender;
          return (
            <div key={m.id} className={`tmsg${mine ? ' mine' : ''}`}>
              <div className="meta">
                <span className="who" style={{ background: c.bg, color: c.fg }}>{m.sender}</span>
                <span className="when">{fmtTime(m.ts)}</span>
              </div>
              <div className="bubble">{m.text}</div>
            </div>
          );
        })}
        {teamErr && <div className="msg err">{teamErr}</div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input">
        <select value={sender} onChange={(e) => pickSender(e.target.value)} aria-label="보내는 사람">
          <option value="">누구?</option>
          {MEMBERS.filter((m) => m.name !== '모두').map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
        <textarea
          rows={2}
          placeholder={sender ? '팀에게 메시지 보내기' : '먼저 이름을 고르세요'}
          value={teamInput}
          onChange={(e) => setTeamInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTeam(); }
          }}
        />
        <button className="primary" disabled={!sender || !teamInput.trim()} onClick={sendTeam}>전송</button>
      </div>
    </div>
  );
}
