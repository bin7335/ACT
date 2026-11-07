import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import p from "@/components/page.module.css";
import { listMakers } from "@/lib/content/queries";

export const metadata: Metadata = { title: "제작자", description: "작품을 만든 선생님들", alternates: { canonical: "/makers" } };

export default function MakersPage() {
  return (
    <div className={`container ${p.page}`}>
      <Suspense fallback={<SectionHeader eyebrow="제작자" title="만든 선생님들" />}>
        <Makers />
      </Suspense>
    </div>
  );
}

async function Makers() {
  const makers = await listMakers();
  return (
    <>
      <SectionHeader eyebrow={`제작자 / ${makers.length}명`} title="만든 선생님들" description="이름을 누르면 그 선생님이 만든 작품을 모아 볼 수 있어요." />
      <ul className={p.list}>
        {makers.map((m) => (
          <li key={m.slug}>
            <Link href={`/makers/${m.slug}`} className={p.listItem}>
              <h2>{m.name}</h2>
              {m.bio && <p>{m.bio}</p>}
              <span className={p.listMeta}>
                작품 {m.workCount}개{m.member ? " · 연구회" : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
