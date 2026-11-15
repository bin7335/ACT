import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/SectionHeader";
import { WorkGrid } from "@/components/WorkCard";
import p from "@/components/page.module.css";
import { getMaker } from "@/lib/content/queries";
import { reactionProps } from "@/lib/content/stats";

export async function generateMetadata(props: PageProps<"/makers/[slug]">): Promise<Metadata> {
  const data = await getMaker((await props.params).slug);
  if (!data) return { title: "제작자를 찾을 수 없어요" };
  return { title: data.maker.name, description: data.maker.bio || `${data.maker.name} 선생님이 만든 작품`, alternates: { canonical: `/makers/${data.maker.slug}` } };
}

export default async function MakerPage(props: PageProps<"/makers/[slug]">) {
  const data = await getMaker((await props.params).slug);
  if (!data) notFound();
  const { maker, works } = data;
  return (
    <div className={`container ${p.page}`}>
      <SectionHeader
        title={maker.name}
        description={
          <>
            {maker.bio}
            {maker.links.length > 0 && (
              <span style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 14 }}>
                {maker.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                    {l.label} ↗
                  </a>
                ))}
              </span>
            )}
          </>
        }
      />
      {works.length ? <WorkGrid works={works} reactions={await reactionProps(works.map((w) => w.slug))} /> : <p className={p.empty}>아직 공개된 작품이 없어요.</p>}
    </div>
  );
}
