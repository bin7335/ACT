import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui";
import { WorkGrid, WorkGridSkeleton } from "@/components/WorkCard";
import p from "@/components/page.module.css";
import { projectAccess } from "@/lib/admin";
import { getArchive, getLatestWorks, getStats, listProjects } from "@/lib/content/queries";
import { reactionProps } from "@/lib/content/stats";
import { WORK_PURPOSE_HINT, WORK_PURPOSE_LABEL, WORK_PURPOSES } from "@/lib/content/types";
import s from "./home.module.css";

export default function Home() {
  return (
    <div className="container">
      <section className={s.hero}>
        <h1 className="t-display">
          선생님이 만든 것을
          <br />
          한곳에 쌓는 아카이브
        </h1>
        <p className={`t-body-lg ${s.lead}`}>
          교실에서 직접 만들고 써 본 수업 도구, 업무 도구, 교실 놀이와 그 밖의 작품을 모았습니다. 로그인 없이 바로 열어 보세요.
        </p>
        <div className={s.ctas}>
          <ButtonLink href="/works">작품 둘러보기</ButtonLink>
          <Link href="/submit" className={s.textLink}>
            내 작품 올리기 →
          </Link>
        </div>
        <Suspense fallback={<div className={s.stats} />}>
          <Stats />
        </Suspense>
      </section>

      <Suspense fallback={<WorkGridSkeleton count={4} />}>
        <PurposeIndex />
      </Suspense>

      <section className={p.section} aria-labelledby="latest">
        <div className={p.sectionHead}>
          <h2 id="latest" className="t-h2">
            새로 올라온 작품
          </h2>
          <Link href="/works">전체 보기 →</Link>
        </div>
        <Suspense fallback={<WorkGridSkeleton />}>
          <Latest />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <Projects />
      </Suspense>

      <section className={s.band}>
        <div>
          <h2 className="t-h2">교실을 위해 만든 것이 있나요?</h2>
          <p className={s.bandText}>로그인하고 작품을 공유해 보세요. 올린 작품은 마이페이지에서 관리할 수 있습니다.</p>
        </div>
        <ButtonLink href="/submit" variant="primary">
          작품 올리기
        </ButtonLink>
      </section>
    </div>
  );
}

async function Stats() {
  const st = await getStats();
  return (
    <dl className={s.stats}>
      <div>
        <dt>작품</dt>
        <dd>{st.works}</dd>
      </div>
      <div>
        <dt>만든 선생님</dt>
        <dd>{st.makers}</dd>
      </div>
      <div>
        <dt>연구회 프로젝트</dt>
        <dd>{st.projects}</dd>
      </div>
    </dl>
  );
}

async function PurposeIndex() {
  const { facets } = await getArchive({});
  return (
    <nav aria-label="용도별로 보기" className={s.types}>
      {WORK_PURPOSES.map((u) => (
        <Link key={u} href={`/works?use=${u}`} className={s.type} data-purpose={u}>
          <span className={s.typeHead}>
            <span className={s.typeName}>{WORK_PURPOSE_LABEL[u]}</span>
            <span className={s.typeCount}>{facets.purpose[u] ?? 0}</span>
          </span>
          <span className={s.typeHint}>{WORK_PURPOSE_HINT[u]}</span>
        </Link>
      ))}
    </nav>
  );
}

async function Latest() {
  const works = await getLatestWorks(8);
  if (!works.length) return <p className={s.bandText}>아직 공개된 작품이 없어요. 첫 작품을 올려 주세요.</p>;
  return <WorkGrid works={works} priorityCount={4} reactions={await reactionProps(works.map((w) => w.slug))} />;
}

// 연구회회원과 관리자에게만 보인다.
async function Projects() {
  if (!(await projectAccess()).allowed) return null;
  const projects = (await listProjects()).slice(0, 3);
  if (!projects.length) return null;
  return (
    <section className={p.section} aria-labelledby="projects">
      <div className={p.sectionHead}>
        <h2 id="projects" className="t-h2">
          연구회 프로젝트
        </h2>
        <Link href="/projects">전체 보기 →</Link>
      </div>
      <ul className={p.list}>
        {projects.map((pr) => (
          <li key={pr.slug}>
            <Link href={`/projects/${pr.slug}`} className={p.listItem}>
              <span className="t-eyebrow">
                {pr.year} / {pr.term}
              </span>
              <h3>{pr.name}</h3>
              <p>{pr.summary}</p>
              <span className={p.listMeta}>작품 {pr.works.length}개</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
