"use client";

import { useState, useTransition } from "react";
import { toggleLikeAction } from "@/app/actions";
import s from "./WorkCard.module.css";

/** 좋아요 — 로그인 없이 누를 수 있다. 같은 브라우저에서는 한 번만 센다. */
export function LikeButton({ slug, liked, count }: { slug: string; liked: boolean; count: number }) {
  const [state, setState] = useState({ liked, count });
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={s.favLabeled}
      aria-pressed={state.liked}
      title={state.liked ? "좋아요 취소" : "좋아요"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = await toggleLikeAction(slug);
          if (next) setState(next);
        })
      }
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path
          d="M8 13.5S2.5 10.2 2.5 6.6A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5.5 1.6c0 3.6-5.5 6.9-5.5 6.9z"
          fill={state.liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span>좋아요</span>
      <span className="t-mono">{state.count}</span>
    </button>
  );
}
