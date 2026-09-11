'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { boardTabId } from '@/lib/kanban/dnd-intent';

export type Screen = 'board' | 'calendar' | 'timetable';

// 탭 줄 맨 앞의 고정 탭 — 보드가 아니라 화면을 고른다. 카드 드롭 지점이 아니다(useDroppable 없음).
const FIXED: { screen: Exclude<Screen, 'board'>; label: string }[] = [
  { screen: 'calendar', label: '📅 달력' },
  { screen: 'timetable', label: '🕐 시간표' },
];

function BoardTab({ name, isActive, isDropTarget, onSelect, onMenu }: {
  name: string; isActive: boolean; isDropTarget: boolean;
  onSelect: () => void; onMenu: (x: number, y: number) => void;
}) {
  // 탭이 곧 드롭 지점 — 카드를 여기 떨어뜨리면 그 보드로 옮겨진다
  const { setNodeRef } = useDroppable({ id: boardTabId(name) });
  return (
    <button
      ref={setNodeRef}
      className={`tab${isActive ? ' active' : ''}${isDropTarget ? ' drop-target' : ''}`}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
    >
      {name}
    </button>
  );
}

export default function BoardTabs({ screen, boards, active, overBoard, onScreen, onSelect, onCreate, onDelete }: {
  screen: Screen; boards: string[]; active: string | null; overBoard: string | null;
  onScreen: (s: Screen) => void; onSelect: (n: string) => void; onCreate: (n: string) => void; onDelete: (n: string) => void;
}) {
  const [menu, setMenu] = useState<{ name: string; x: number; y: number } | null>(null);

  return (
    <div className="tabs">
      {FIXED.map((f) => (
        <button key={f.screen} className={`tab${screen === f.screen ? ' active' : ''}`} onClick={() => onScreen(f.screen)}>
          {f.label}
        </button>
      ))}
      <span className="tab-sep" />
      {boards.map((b) => (
        <BoardTab
          key={b}
          name={b}
          isActive={screen === 'board' && b === active}
          isDropTarget={overBoard === b}
          onSelect={() => onSelect(b)}
          onMenu={(x, y) => setMenu({ name: b, x, y })}
        />
      ))}
      <button
        className="tab ghost"
        onClick={() => {
          const name = window.prompt('새 보드 이름');
          if (name?.trim()) onCreate(name.trim());
        }}
      >
        + 보드
      </button>
      {menu && (
        <>
          <div className="ctx-back" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="ctx-menu" style={{ left: menu.x, top: menu.y }}>
            <button
              className="danger"
              onClick={() => {
                const { name } = menu;
                setMenu(null);
                if (window.confirm(`보드 "${name}"을(를) 삭제할까요?\n(파일은 data/.trash로 이동 — 복구 가능)`)) onDelete(name);
              }}
            >
              🗑 보드 삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}
