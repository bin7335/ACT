import type { Metadata } from "next";
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
        description="로그인 없이 올릴 수 있어요. 운영진이 확인한 뒤 공개되며, 제출 후 받는 수정 링크로 언제든 고칠 수 있습니다."
      />
      <Suspense>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const projects = await listProjectOptions();
  return <WorkForm action={submitWorkAction} initial={emptyValues} mode="create" projects={projects} submitLabel="검수 요청하기" />;
}
