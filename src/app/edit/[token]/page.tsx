import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { SectionHeader } from "@/components/SectionHeader";
import { StatusLabel, Notice } from "@/components/ui";
import { WorkForm } from "@/components/WorkForm";
import p from "@/components/page.module.css";
import { editWorkAction } from "@/app/actions";
import { valuesFromWork } from "@/lib/content/form";
import { getWorkByEditTokenHash, listProjectOptions } from "@/lib/content/queries";
import { hashToken } from "@/lib/security";
import { site } from "@/lib/site";
import s from "./edit.module.css";

export const metadata: Metadata = { title: "작품 수정", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function EditPage(props: PageProps<"/edit/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const work = await getWorkByEditTokenHash(hashToken(token));
  if (!work) notFound();
  const projects = await listProjectOptions();
  const editUrl = `${site.url}/edit/${token}`;
  const isNew = sp.new === "1";

  return (
    <div className={`container ${p.narrow} ${p.page}`}>
      {isNew && (
        <div className={s.done}>
          <p className="t-eyebrow">SUBMITTED</p>
          <h1 className="t-h1">제출했어요. 고마워요!</h1>
          <p>운영진이 확인한 뒤 공개됩니다. 보통 며칠 안에 처리돼요.</p>
        </div>
      )}

      <section className={s.linkBox} aria-labelledby="edit-link">
        <h2 id="edit-link" className="t-h3">
          개인 수정 링크
        </h2>
        <p>
          이 링크가 있으면 누구나 이 작품을 고칠 수 있어요. <strong>북마크하거나 메모해 두고, 다른 사람과 공유하지 마세요.</strong> 잃어버리면 운영진에게 연락해 주세요.
        </p>
        <div className={s.linkRow}>
          <code className={s.url}>{editUrl}</code>
          <CopyLinkButton url={editUrl} />
        </div>
      </section>

      <div className={s.status}>
        <span>지금 상태</span>
        <StatusLabel status={work.status} />
        {work.status === "published" && <Link href={`/works/${work.slug}`}>공개 페이지 보기 →</Link>}
      </div>
      {work.status === "hidden" && work.reviewNote && (
        <Notice tone="danger">
          <strong>운영진 메모:</strong> {work.reviewNote} <br />
          내용을 고쳐서 저장하면 다시 검수 대기로 바뀝니다.
        </Notice>
      )}

      <SectionHeader eyebrow={`EDIT / ${work.slug}`} title={work.title} as="h2" />
      <WorkForm
        action={editWorkAction.bind(null, token)}
        initial={valuesFromWork(work)}
        mode="edit"
        projects={projects}
        currentThumbnail={work.thumbnail}
        submitLabel="변경 내용 저장"
      />
    </div>
  );
}
