'use client';

import { useRef, type ReactNode } from 'react';

// 모달 껍데기 — 배경 클릭으로 닫힌다. 입력창에서 시작한 드래그(텍스트 선택)가 모달 밖에서 끝나면
// click이 배경에서 발생하므로, "누르기 시작한 지점"이 배경일 때만 닫아야 입력 내용이 날아가지 않는다.
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const downOnBack = useRef(false);
  return (
    <div
      className="modal-back"
      onPointerDown={(e) => { downOnBack.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (downOnBack.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="pixel">{title}</h2>
        {children}
      </div>
    </div>
  );
}
