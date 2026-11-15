"use client";

import { startTransition } from "react";
import { setBookmarkAction } from "@/app/actions";
import { toggleFavorite, useFavorites } from "./favorites";
import s from "./WorkCard.module.css";

export function FavoriteButton({ slug, title, withLabel }: { slug: string; title: string; withLabel?: boolean }) {
  const saved = useFavorites().includes(slug);
  return (
    <button
      type="button"
      className={withLabel ? s.favLabeled : s.fav}
      aria-pressed={saved}
      aria-label={withLabel ? undefined : saved ? `${title} 즐겨찾기 해제` : `${title} 즐겨찾기`}
      title={saved ? "즐겨찾기 해제" : "즐겨찾기"}
      onClick={() => {
        const on = toggleFavorite(slug);
        // 숫자 집계도 함께 맞춘다(화면 표시는 브라우저 저장소가 기준).
        startTransition(() => void setBookmarkAction(slug, on));
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M4 2h8v12l-4-3-4 3z" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {withLabel && <span>{saved ? "즐겨찾기됨" : "즐겨찾기"}</span>}
    </button>
  );
}
