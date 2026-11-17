"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRegisterCards } from "./ParticleStage";
import s from "./landing.module.css";

/** 서버가 넘기는 최소 정보. 좋아요 수 같은 숫자는 싣지 않는다. */
export type ThumbWork = { slug: string; title: string; src: string; alt: string | null };

/**
 * 좋아요 많은 공개 작품의 실제 썸네일 카드. 각 카드는 /works/{slug}로 가는 진짜 링크다.
 * 원본 이미지는 처음에 가려져 있고, 캔버스 엔진이 같은 이미지를 샘플링한 색 입자를 그 위에 모은 뒤
 * 카드에 data-shown을 붙여 드러낸다. 마크업 계약([data-card] > [data-thumb] > img)은 engine.ts 머리말 참고.
 */
export function ThumbCards({ works }: { works: ThumbWork[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const register = useRegisterCards();

  useEffect(() => {
    if (!register) return;
    register(rootRef.current);
    return () => register(null);
  }, [register, works]);

  // 작품이 없어도 "조회가 끝났다"는 것을 엔진에 알려야 하므로 빈 루트는 남긴다.
  if (!works.length) return <div ref={rootRef} hidden />;

  return (
    <div ref={rootRef} className={s.cards} data-static={register ? undefined : "true"}>
      <p className={`t-eyebrow ${s.cardsHead}`}>Archive / 좋아요 많은 순</p>
      <ul className={s.cardList}>
        {works.map((w, i) => {
          // 업로드 썸네일은 1280w와 -640 두 장이 있다(components/Thumbnail.tsx와 같은 규칙).
          const small = /\.webp$/.test(w.src) ? w.src.replace(/\.webp$/, "-640.webp") : null;
          return (
            <li key={w.slug} className={s.cardItem} data-card>
              <Link href={`/works/${w.slug}`} className={s.card}>
                <span className={s.cardThumb} data-thumb>
                  {/* 업로드할 때 이미 WebP 두 크기로 만들어 두므로 next/image 최적화는 쓰지 않는다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={small ?? w.src}
                    srcSet={small ? `${small} 640w, ${w.src} 1280w` : undefined}
                    sizes="(max-width: 559px) 46vw, (max-width: 959px) 31vw, 220px"
                    alt={w.alt ?? ""}
                    width={640}
                    height={400}
                    // 앞의 넷은 모든 화면에서 보인다. 나머지는 좁은 화면에서 감춰지므로 필요할 때만 받는다.
                    loading={i < 4 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </span>
                <span className={s.cardTitle}>{w.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
