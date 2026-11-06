import type { Metadata } from "next";
import Link from "next/link";
import { currentMember } from "@/lib/auth";
import { Notice } from "@/components/ui";
import { Suspense } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { WorkForm } from "@/components/WorkForm";
import p from "@/components/page.module.css";
import { submitWorkAction } from "@/app/actions";
import { emptyValues } from "@/lib/content/form";
import { listProjectOptions } from "@/lib/content/queries";

export const metadata: Metadata = { title: "작품 올리기", description: "교실을 위해 만든 도구, 앱, 영상, 자료를 아카이브에 올려 주세요." };

export default function SubmitPage() {
  return (
    <div className={`container ${p.narrow} ${p.page}`}>
      <SectionHeader
        eyebrow="SUBMIT"
        title="작품 올리기"
        description="운영진이 확인한 뒤 공개됩니다. 로그인하면 마이페이지에서, 비회원으로 제출하면 개인 수정 링크로 관리할 수 있어요."
      />
      <Suspense>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const projects = await listProjectOptions();
  const member = await currentMember();
  return <>
    <Notice>{member ? `${member.name}님의 계정에 저장됩니다. 마이페이지에서 수정할 수 있어요.` : <><Link href="/login?next=%2Fsubmit">로그인</Link>하면 내 작품을 한곳에서 관리할 수 있어요. 비회원 제출도 가능합니다.</>}</Notice>
    <WorkForm action={submitWorkAction} initial={emptyValues} mode="create" projects={projects} submitLabel="검수 요청하기" accountSubmission={!!member} />
  </>;
}
