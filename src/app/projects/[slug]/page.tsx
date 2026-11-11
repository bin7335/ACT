import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/SectionHeader";
import { WorkGrid } from "@/components/WorkCard";
import p from "@/components/page.module.css";
import { getProject } from "@/lib/content/queries";
import { reactionProps } from "@/lib/content/stats";

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const data = await getProject((await props.params).slug);
  if (!data) return { title: "프로젝트를 찾을 수 없어요" };
  return { title: data.project.name, description: data.project.summary, alternates: { canonical: `/projects/${data.project.slug}` } };
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  const data = await getProject((await props.params).slug);
  if (!data) notFound();
  const { project, works, makers } = data;
  return (
    <div className={`container ${p.page}`}>
      <SectionHeader
        title={project.name}
        description={
          <>
            {project.summary}
            {makers.length > 0 && (
              <span style={{ display: "block", marginTop: 8, fontSize: 14, color: "var(--color-text-tertiary)" }}>
                참여:{" "}
                {makers.map((m, i) => (
                  <span key={m.slug}>
                    {i > 0 && ", "}
                    <Link href={`/makers/${m.slug}`} style={{ color: "var(--color-text-primary)" }}>
                      {m.name}
                    </Link>
                  </span>
                ))}
              </span>
            )}
          </>
        }
      />
      {works.length ? <WorkGrid works={works} reactions={await reactionProps(works.map((w) => w.slug))} /> : <p className={p.empty}>아직 공개된 결과물이 없어요.</p>}
    </div>
  );
}
