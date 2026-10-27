"use client";

import { useEffect, useRef } from "react";

// Native <dialog> wrapper: Esc and a click on the backdrop close it.
export function Modal({ onClose, wide, children }: { onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : undefined}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {children}
    </dialog>
  );
}

export function ModalHead({ title, extra, onClose }: { title: string; extra?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="mhead">
      <div className="grow"><h2 style={{ margin: 0, fontFamily: "var(--f-display)", fontSize: 18 }}>{title}</h2></div>
      {extra}
      <button className="x" type="button" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}
