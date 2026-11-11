import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { updateMakerAction } from "@/app/actions";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui";
import f from "@/components/form.module.css";
import p from "@/components/page.module.css";
import { requireAdmin } from "@/lib/admin";
import { listAllMakers, listProjects } from "@/lib/content/queries";
import s from "../admin.module.css";
import { ProjectForm } from "./ProjectForm";

export const metadata: Metadata = { title: "프로젝트·제작자 관리", robots: { index: false, follow: false } };

export default function AdminProjectsPage() {
  return (
    <div className={`container ${p.page}`}>
      <Suspense fallback={<SectionHeader title="프로젝트·제작자" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  await requireAdmin();
  const [projects, makers] = await Promise.all([listProjects(), listAllMakers()]);
  return (
    <>
      <Link href="/admin" className={s.headLink}>
        ← 검수 목록
      </Link>
      <SectionHeader title="프로젝트·제작자" />

      <section className={p.section} aria-labelledby="projects">
        <div className={p.sectionHead}>
          <h2 id="projects" className="t-h3">
            연구회 프로젝트 {projects.length}
          </h2>
        </div>
        <ul className={p.list}>
          {projects.map((pr) => (
            <li key={pr.slug}>
              <Link href={`/projects/${pr.slug}`} className={p.listItem}>
                <span className="t-eyebrow">
                  {pr.year} / {pr.term}
                </span>
                <h3>{pr.name}</h3>
                <span className={p.listMeta}>작품 {pr.works.length}개</span>
              </Link>
            </li>
          ))}
        </ul>
        <ProjectForm />
      </section>

      <section className={p.section} aria-labelledby="makers">
        <div className={p.sectionHead}>
          <h2 id="makers" className="t-h3">
            제작자 {makers.length}
          </h2>
        </div>
        <p className={f.hint}>제출할 때 적은 이름으로 자동 등록돼요. 오타가 있거나 소개를 넣을 때 여기서 고치세요.</p>
        <div>
          {makers.map((m) => (
            <form key={m.slug} action={updateMakerAction} className={s.makerRow}>
              <input type="hidden" name="slug" value={m.slug} />
              <input name="name" defaultValue={m.name} className={f.input} aria-label="이름" maxLength={30} required />
              <input name="bio" defaultValue={m.bio} className={f.input} aria-label="소개" maxLength={200} placeholder="한 줄 소개" />
              <label className={f.check}>
                <input type="checkbox" name="member" defaultChecked={m.member} />
                연구회
              </label>
              <Button type="submit" size="sm">
                저장
              </Button>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}
