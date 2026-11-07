import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Chip, ButtonLink } from "@/components/ui";
import { WorkGrid, WorkGridSkeleton } from "@/components/WorkCard";
import p from "@/components/page.module.css";
import { allSubjects, getArchive, parseArchiveQuery, type ArchiveQuery } from "@/lib/content/queries";
import { AUDIENCES, WORK_PURPOSE_LABEL, WORK_PURPOSES, WORK_TYPE_LABEL, WORK_TYPES } from "@/lib/content/types";
import { withParams } from "@/lib/format";

export const metadata: Metadata = {
  title: "작품",
  description: "선생님들이 만든 수업 도구, 업무 도구, 교실 놀이를 용도·형태·대상·교과로 찾아보세요.",
  alternates: { canonical: "/works" },
};

export default function WorksPage(props: PageProps<"/works">) {
  return (
    <div className={`container ${p.page}`}>
      <Suspense fallback={<ArchiveFallback />}>
        <Archive searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function ArchiveFallback() {
  return (
    <>
      <SectionHeader eyebrow="WORK ARCHIVE" title="선생님들이 만든 작품" action={<ButtonLink href="/submit" variant="primary">작품 올리기</ButtonLink>} />
      <WorkGridSkeleton />
    </>
  );
}

async function Archive({ searchParams }: { searchParams: PageProps<"/works">["searchParams"] }) {
  const query = parseArchiveQuery(await searchParams);
  const [result, subjects] = await Promise.all([getArchive(query), allSubjects()]);
  const current: Record<string, string | undefined> = {
    use: query.purpose,
    type: query.type,
    audience: query.audience,
    subject: query.subject,
    q: query.q,
    sort: query.sort === "title" ? "title" : undefined,
  };
  const href = (patch: Record<string, string | undefined>) => withParams("/works", current, patch);
  const filtered = !!(query.purpose || query.type || query.audience || query.subject || query.q);
  const purposeTotal = Object.values(result.facets.purpose).reduce((a, b) => a + b, 0);

  return (
    <>
      <SectionHeader
        eyebrow={`WORK ARCHIVE / ${result.facets.all}`}
        title="선생님들이 만든 작품"
        action={
          <ButtonLink href="/submit" variant="primary">
            작품 올리기
          </ButtonLink>
        }
      />

      <div className={p.filters}>
        <div className={p.filterTop}>
          <nav aria-label="용도" className={p.row}>
            <Chip href={href({ use: undefined })} label="전체" count={purposeTotal} selected={!query.purpose} />
            {WORK_PURPOSES.map((u) => (
              <Chip key={u} href={href({ use: u })} label={WORK_PURPOSE_LABEL[u]} count={result.facets.purpose[u] ?? 0} selected={query.purpose === u} />
            ))}
          </nav>
          <form action="/works" role="search" className={p.search}>
            {Object.entries(current).map(([k, v]) => k !== "q" && v && <input key={k} type="hidden" name={k} value={v} />)}
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <label htmlFor="q" className="visually-hidden">
              작품 검색
            </label>
            <input id="q" name="q" type="search" defaultValue={query.q} placeholder="작품명, 제작자, 교과 검색" maxLength={60} />
            <button className={p.searchBtn}>검색</button>
          </form>
        </div>
        <nav aria-label="형태" className={p.row}>
          <Chip href={href({ type: undefined })} label="모든 형태" selected={!query.type} />
          {WORK_TYPES.map((t) => (
            <Chip key={t} href={href({ type: t })} label={WORK_TYPE_LABEL[t]} count={result.facets.type[t] ?? 0} selected={query.type === t} />
          ))}
        </nav>
        <nav aria-label="대상" className={p.row}>
          <Chip href={href({ audience: undefined })} label="모든 대상" selected={!query.audience} />
          {AUDIENCES.map((a) => (
            <Chip key={a} href={href({ audience: a })} label={a} count={result.facets.audience[a] ?? 0} selected={query.audience === a} />
          ))}
        </nav>
        {subjects.length > 0 && (
          <nav aria-label="교과" className={p.row}>
            <Chip href={href({ subject: undefined })} label="모든 교과" selected={!query.subject} />
            {subjects.map((sub) => (
              <Chip key={sub} href={href({ subject: sub })} label={sub} count={result.facets.subject[sub] ?? 0} selected={query.subject === sub} />
            ))}
          </nav>
        )}
      </div>

      <div className={p.toolbar}>
        <p aria-live="polite">
          <strong>{result.total}</strong>개 작품
          {filtered && (
            <>
              {" · "}
              <Link href="/works" className={p.reset}>
                필터 초기화
              </Link>
            </>
          )}
        </p>
        <div className={p.toolbarLinks}>
          <Link href={href({ sort: undefined })} aria-current={query.sort !== "title" ? "true" : undefined} scroll={false}>
            최신순
          </Link>
          <Link href={href({ sort: "title" })} aria-current={query.sort === "title" ? "true" : undefined} scroll={false}>
            이름순
          </Link>
        </div>
      </div>

      {result.items.length ? (
        <WorkGrid works={result.items} priorityCount={4} />
      ) : (
        <Empty query={query} />
      )}
      {result.pageCount > 1 &&<Pagination page={result.page} pageCount={result.pageCount} href={(n) => href({ page: n === 1 ? undefined : String(n) })} />}
    </>
  );
}

function Empty({ query }: { query: ArchiveQuery }) {
  return (
    <div className={p.empty}>
      <h2 className="t-h3">{query.q ? `‘${query.q}’에 맞는 작품이 없어요` : "조건에 맞는 작품이 없어요"}</h2>
      <p>필터를 줄이거나 다른 단어로 찾아보세요. 찾는 도구를 직접 만드셨다면 아카이브에 올려 주세요.</p>
      <div className={p.emptyActions}>
        <ButtonLink href="/works">전체 작품 보기</ButtonLink>
        <ButtonLink href="/submit" variant="ghost">
          작품 올리기
        </ButtonLink>
      </div>
    </div>
  );
}

function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (n: number) => string }) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 2);
  return (
    <nav aria-label="페이지" className={p.pagination}>
      <Link className={p.pageLink} href={href(page - 1)} aria-disabled={page === 1} aria-label="이전 페이지">
        ←
      </Link>
      {pages.map((n, i) => (
        <span key={n} style={{ display: "contents" }}>
          {i > 0 && n - pages[i - 1] > 1 && <span className={p.pageLink} aria-hidden>…</span>}
          <Link className={p.pageLink} href={href(n)} aria-current={n === page ? "page" : undefined}>
            {n}
          </Link>
        </span>
      ))}
      <Link className={p.pageLink} href={href(page + 1)} aria-disabled={page === pageCount} aria-label="다음 페이지">
        →
      </Link>
    </nav>
  );
}
