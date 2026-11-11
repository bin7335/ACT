"use client";

import { useState, useTransition } from "react";
import { setBookmarkAction, toggleLikeAction } from "@/app/actions";
import { toggleFavorite, useFavorites } from "./favorites";
import s from "./WorkCard.module.css";

/** 카드 하단 반응 줄 — 좋아요·조회·북마크를 숫자와 함께 보여주고, 좋아요와 북마크는 바로 누를 수 있다. */
export function CardActions({
  slug, title, likeCount, viewCount, bookmarkCount, liked, bookmarked,
}: {
  slug: string;
  title: string;
  likeCount: number;
  viewCount: number;
  bookmarkCount: number;
  liked?: boolean;
  bookmarked?: boolean;
}) {
  const saved = useFavorites().includes(slug);
  const [like, setLike] = useState({ liked: !!liked, count: likeCount });
  const [marks, setMarks] = useState({ bookmarked: !!bookmarked, count: bookmarkCount });
  const [, start] = useTransition();

  return (
    <div className={s.stats}>
      <button
        type="button"
        className={s.statButton}
        aria-pressed={like.liked}
        aria-label={like.liked ? `${title} 좋아요 취소` : `${title} 좋아요`}
        title={like.liked ? "좋아요 취소" : "좋아요"}
        onClick={() =>
          start(async () => {
            const next = await toggleLikeAction(slug);
            if (next) setLike(next);
          })
        }
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M8 13.5S2.5 10.2 2.5 6.6A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5.5 1.6c0 3.6-5.5 6.9-5.5 6.9z"
            fill={like.liked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <span className="t-mono">{like.count}</span>
      </button>

      <span className={s.stat} title="조회수">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path d="M1.5 8S3.8 3.8 8 3.8 14.5 8 14.5 8 12.2 12.2 8 12.2 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <span className="t-mono">{viewCount}</span>
        <span className="visually-hidden">조회</span>
      </span>

      <button
        type="button"
        className={s.statButton}
        aria-pressed={saved || marks.bookmarked}
        aria-label={saved || marks.bookmarked ? `${title} 북마크 해제` : `${title} 북마크`}
        title={saved || marks.bookmarked ? "북마크 해제" : "북마크"}
        onClick={() =>
          start(async () => {
            const on = toggleFavorite(slug);
            const next = await setBookmarkAction(slug, on);
            setMarks(next ? { bookmarked: next.bookmarked, count: next.count } : { bookmarked: !!on, count: marks.count });
          })
        }
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M4 2h8v12l-4-3-4 3z"
            fill={saved || marks.bookmarked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <span className="t-mono">{marks.count}</span>
      </button>
    </div>
  );
}
