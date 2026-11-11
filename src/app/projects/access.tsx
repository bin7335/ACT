import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/SectionHeader";
import { ButtonLink } from "@/components/ui";
import p from "@/components/page.module.css";
import { projectAccess } from "@/lib/admin";

/**
 * 연구회 프로젝트는 관리자와 연구회회원만 본다.
 * 로그인하지 않았으면 로그인으로 보내고, 권한이 없는 회원에게는 null을 돌려준다(안내 화면을 그린다).
 */
export async function projectGate(next: string) {
  const access = await projectAccess();
  if (access.allowed) return access;
  if (!access.member) redirect(`/login?next=${encodeURIComponent(next)}`);
  return null;
}

export function ProjectsRestricted() {
  return (
    <>
      <SectionHeader title="연구회 프로젝트" />
      <div className={p.empty}>
        <h2 className="t-h3">연구회회원만 볼 수 있어요</h2>
        <p>연구회 프로젝트는 연구회회원에게만 공개됩니다. 연구회회원이라면 관리자에게 권한을 요청해 주세요.</p>
        <div className={p.emptyActions}>
          <ButtonLink href="/works">작품 보러 가기</ButtonLink>
        </div>
      </div>
    </>
  );
}
