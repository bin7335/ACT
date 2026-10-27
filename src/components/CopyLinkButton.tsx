"use client";

import { useState } from "react";
import s from "./WorkCard.module.css";

export function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <button
      type="button"
      className={s.favLabeled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setState("done");
        } catch {
          setState("fail");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M6.5 9.5l3-3M7 4.5l1.5-1.5a2.5 2.5 0 013.5 3.5L10.5 8M9 11.5L7.5 13a2.5 2.5 0 01-3.5-3.5L5.5 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span aria-live="polite">{state === "done" ? "복사됨" : state === "fail" ? "복사 실패" : "링크 복사"}</span>
    </button>
  );
}
