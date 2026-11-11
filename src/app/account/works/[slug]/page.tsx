import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ownWork } from "@/lib/member-works";
import { listProjectOptions } from "@/lib/content/queries";
import { valuesFromWork } from "@/lib/content/form";
import { memberEditWorkAction } from "@/app/actions";
import { SectionHeader } from "@/components/SectionHeader";
import { WorkForm } from "@/components/WorkForm";
import { Toast } from "@/components/Toast";
import { ButtonLink, Notice, StatusLabel } from "@/components/ui";
import p from "@/components/page.module.css";
import s from "../../account.module.css";

export const metadata: Metadata = { title: "내 작품 수정", robots: { index: false, follow: false } };
export default function OwnWorkPage(props: PageProps<"/account/works/[slug]">) {
  return <div className={`container ${p.narrow} ${p.page}`}><Suspense fallback={<p>작품을 확인하는 중…</p>}><Content {...props} /></Suspense></div>;
}
async function Content(props: PageProps<"/account/works/[slug]">) {
  const { slug } = await props.params;
  const work = await ownWork(slug);
  if (!work) notFound();
  const projects = await listProjectOptions();
  const sp = await props.searchParams;
  return <>
    <Link href="/account" className={s.back}>← 내 작품</Link>
    {sp.new === "1" && <Toast clearParam="new">{work.status === "published" ? "작품을 바로 공개했어요. 작품 목록에서 확인할 수 있습니다." : "제출했어요. 계정에 저장되었으며 운영진이 확인한 뒤 공개됩니다."}</Toast>}
    <SectionHeader title={work.title} description={<StatusLabel status={work.status} />} action={work.status === "published" ? <ButtonLink href={`/works/${work.slug}`} size="sm" variant="ghost">공개 페이지 보기</ButtonLink> : undefined} />
    {work.reviewNote && <Notice>운영진 메모: {work.reviewNote}</Notice>}
    <WorkForm action={memberEditWorkAction.bind(null, slug)} initial={valuesFromWork(work)} mode="edit" simple projects={projects} currentThumbnail={work.thumbnail} submitLabel="변경 내용 저장" />
  </>;
}
