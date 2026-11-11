"use client";

import { useEffect, useState, type ReactNode } from "react";
import s from "./ui.module.css";

/**
 * 화면 오른쪽 아래에 잠깐 떠 있는 완료 알림. 본문 자리를 차지하지 않는다.
 * signal이 바뀔 때마다 다시 뜬다(같은 화면에서 여러 번 저장할 때).
 * clearParam을 주면 주소에서 그 값을 지워, 새로 고쳐도 다시 뜨지 않게 한다.
 */
export function Toast({ children, signal, clearParam, duration = 6000 }: { children: ReactNode; signal?: unknown; clearParam?: string; duration?: number }) {
  const [closedFor, setClosedFor] = useState<unknown>(NEVER);
  const open = closedFor !== signal;

  useEffect(() => {
    if (!clearParam) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(clearParam)) return;
    url.searchParams.delete(clearParam);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [clearParam]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setClosedFor(signal), duration);
    return () => window.clearTimeout(timer);
  }, [open, signal, duration]);

  return (
    <div className={s.toastRegion} role="status">
      {open && (
        <div className={s.toast}>
          <p>{children}</p>
          <button type="button" className={s.toastClose} aria-label="알림 닫기" onClick={() => setClosedFor(signal)}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

const NEVER = Symbol("never");
