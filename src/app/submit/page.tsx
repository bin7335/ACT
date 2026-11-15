import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { Notice } from "@/components/ui";
import { Suspense } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { WorkForm } from "@/components/WorkForm";
import p from "@/components/page.module.css";
import { submitWorkAction } from "@/app/actions";
import { emptyValues } from "@/lib/content/form";
import { listProjectOptions } from "@/lib/content/queries";

export const metadata: Metadata = { title: "작품 올리기", description: "로그인하고 교실을 위해 만든 도구, 앱, 영상, 자료를 올려 주세요." };

export default function SubmitPage() {
  return <div className={`container ${p.narrow} ${p.page}`}><Suspense fallback={<p>계정을 확인하는 중…</p>}><Form /></Suspense></div>;
}

async function Form() {
  const member = await requireMember("/submit");
  const projects = await listProjectOptions();
  return <>
    <SectionHeader title="작품 올리기" description={member.isAdmin || member.isResearch ? "운영진·연구회회원 계정으로 올리는 작품은 검수 없이 바로 공개됩니다." : "제출한 작품은 마이페이지에서 관리하며, 운영진이 확인한 뒤 공개됩니다."} />
    <Notice>{member.name}님의 계정에 저장됩니다. 마이페이지에서 수정할 수 있어요.</Notice>
    <WorkForm action={submitWorkAction} initial={emptyValues} mode="create" simple projects={projects} submitLabel={member.isAdmin || member.isResearch ? "바로 공개하기" : "검수 요청하기"} />
  </>;
}
