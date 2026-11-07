import Link from "next/link";
import { LINK_LABEL, type WorkSummary } from "@/lib/content/types";
import { formatMonth } from "@/lib/format";
import { FavoriteButton } from "./FavoriteButton";
import { Thumbnail } from "./Thumbnail";
import { ExternalButton, TypeBadge } from "./ui";
import s from "./WorkCard.module.css";

export function WorkCard({ work, priority }: { work: WorkSummary; priority?: boolean }) {
  const meta = [work.audience.join("·"), work.subjects.join("·"), work.publishedAt && formatMonth(work.publishedAt)].filter(Boolean).join(" · ");
  return (
    <article className={s.card}>
      <Link href={`/works/${work.slug}`} className={s.thumb}>
        <Thumbnail src={work.thumbnail} alt={work.thumbnailAlt} title={work.title} purpose={work.purpose} priority={priority} />
        <span className={s.badge}>
          <TypeBadge purpose={work.purpose} type={work.type} />
        </span>
      </Link>
      <div className={s.body}>
        <h3 className={s.title}>
          <Link href={`/works/${work.slug}`}>{work.title}</Link>
        </h3>
        <p className={s.summary}>{work.summary}</p>
      </div>
      <p className={s.meta}>{meta}</p>
      <div className={s.footer}>
        {work.primaryLink ? (
          <ExternalButton href={work.primaryLink.url} size="sm" aria-label={`${work.title} ${LINK_LABEL[work.primaryLink.kind]}`}>
            {work.primaryLink.kind === "youtube" ? "영상 보기" : work.primaryLink.kind.startsWith("store") ? "앱 받기" : "바로 열기"}
          </ExternalButton>
        ) : (
          <Link href={`/works/${work.slug}`} className={s.more}>
            자세히
          </Link>
        )}
        <div className={s.footerRight}>
          {work.makers.length > 0 && (
            <span className={s.maker}>
              <span className={s.by}>BY</span>
              <Link href={`/makers/${work.makers[0].slug}`}>{work.makers[0].name}</Link>
              {work.makers.length > 1 && <span className={s.more}> 외 {work.makers.length - 1}</span>}
            </span>
          )}
          <FavoriteButton slug={work.slug} title={work.title} />
        </div>
      </div>
    </article>
  );
}

export function WorkGrid({ works, priorityCount = 0 }: { works: WorkSummary[]; priorityCount?: number }) {
  return (
    <ul className={s.grid}>
      {works.map((w, i) => (
        <li key={w.slug}>
          <WorkCard work={w} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function WorkGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className={s.grid} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={s.skeleton}>
          <div className={s.skelThumb} />
          <div className={s.skelLine} style={{ width: "60%" }} />
          <div className={s.skelLine} />
        </li>
      ))}
    </ul>
  );
}
