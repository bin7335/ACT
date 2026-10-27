"use client";

import { useEffect, useState } from "react";
import { useFavorites } from "@/components/favorites";
import { ButtonLink } from "@/components/ui";
import { WorkGrid, WorkGridSkeleton } from "@/components/WorkCard";
import p from "@/components/page.module.css";
import type { WorkSummary } from "@/lib/content/types";

type Revived = Omit<WorkSummary, "publishedAt" | "updatedAt"> & { publishedAt: string | null; updatedAt: string };

export function FavoriteList() {
  const slugs = useFavorites();
  const key = slugs.join(",");
  const [state, setState] = useState<{ key: string; works: WorkSummary[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetch(`/api/works?slugs=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { works: Revived[] }) =>
        setState({
          key,
          works: data.works.map((w) => ({ ...w, publishedAt: w.publishedAt ? new Date(w.publishedAt) : null, updatedAt: new Date(w.updatedAt) })),
        }),
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, [key]);

  if (!key) {
    return (
      <div className={p.empty}>
        <h2 className="t-h3">아직 즐겨찾기한 작품이 없어요</h2>
        <p>작품 카드의 책갈피 아이콘을 누르면 여기에 모아 둘 수 있어요.</p>
        <div className={p.emptyActions}>
          <ButtonLink href="/works">작품 둘러보기</ButtonLink>
        </div>
      </div>
    );
  }
  if (!state || state.key !== key) return <WorkGridSkeleton count={Math.min(slugs.length, 8)} />;
  return (
    <>
      <WorkGrid works={state.works} />
      {state.works.length < slugs.length && <p className="t-meta">비공개로 바뀌었거나 삭제된 작품 {slugs.length - state.works.length}개는 표시하지 않았어요.</p>}
    </>
  );
}
