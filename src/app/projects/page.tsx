import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import p from "@/components/page.module.css";
import { listProjects } from "@/lib/content/queries";
import { ProjectForm } from "@/app/admin/projects/ProjectForm";
import { projectGate, ProjectsRestricted } from "./access";
import s from "./projects.module.css";

export const metadata: Metadata = { title: "연구회 프로젝트", robots: { index: false, follow: false } };

export default function ProjectsPage() {
  return (
    <div className={`container ${p.page}`}>
      <Suspense fallback={<SectionHeader title="연구회 프로젝트" />}>
        <Projects />
      </Suspense>
    </div>
  );
}

async function Projects() {
  if (!(await projectGate("/projects"))) return <ProjectsRestricted />;
  const projects = await listProjects();
  const years = [...new Set(projects.map((pr) => pr.year))];
  return (
    <>
      <SectionHeader title="연구회 프로젝트" description="연구회가 학기마다 함께 기획하고 만든 것들을 연도별로 기록합니다." />
      {years.map((y) => (
        <section key={y} className={s.year} aria-labelledby={`y${y}`}>
          <h2 id={`y${y}`} className={s.yearLabel}>
            {y}
          </h2>
          <ul className={s.items}>
            {projects
              .filter((pr) => pr.year === y)
              .map((pr) => (
                <li key={pr.slug}>
                  <Link href={`/projects/${pr.slug}`} className={s.item}>
                    <span className="t-eyebrow">{pr.term}</span>
                    <h3 className="t-h3">{pr.name}</h3>
                    <p>{pr.summary}</p>
                    <span className={s.count}>
                      작품 {pr.works.length}개 · 참여 {new Set(pr.works.flatMap((w) => w.makers.map((m) => m.slug))).size}명
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <section className={p.section} aria-label="새 프로젝트 만들기">
        <ProjectForm />
      </section>
    </>
  );
}
