'use client';

import { useState } from 'react';
import { MEMBERS, memberColor } from '@/lib/members';

// 담당자 복수 선택 — 버튼에 선택된 이름 칩, 누르면 체크박스 팝업. 카드·일정·블록 편집 모달이 공유한다.
export default function MemberPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);

  function toggle(name: string) {
    onChange(value.includes(name) ? value.filter((x) => x !== name) : [...value, name]);
  }

  return (
    <div className="name-dd">
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {value.length === 0
          ? '담당자'
          : value.map((a) => {
              const c = memberColor(a);
              return <span key={a} className="name-chip" style={{ background: c.bg, color: c.fg }}>{a}</span>;
            })}
      </button>
      {open && (
        <>
          <div className="ctx-back" onClick={() => setOpen(false)} />
          <div className="name-pop">
            {MEMBERS.map((m) => (
              <label key={m.name}>
                <input type="checkbox" checked={value.includes(m.name)} onChange={() => toggle(m.name)} />
                <span className="name-dot" style={{ background: m.bg, borderColor: m.fg }} />
                <span style={{ color: m.fg }}>{m.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
