import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminLogoutAction, checkLinksAction } from "@/app/actions";
import { SectionHeader } from "@/components/SectionHeader";
import { Button, Notice, StatusLabel, TypeBadge } from "@/components/ui";
import p from "@/components/page.module.css";
import { requireAdmin } from "@/lib/admin";
import { currentMember } from "@/lib/auth";
import { listMembers, searchMembers } from "@/lib/members";
import { MemberAdminList } from "@/app/account/settings/MemberAdminList";
import { countByStatus, listWorksByStatus } from "@/lib/content/queries";
import { WORK_STATUS_LABEL, type WorkStatus } from "@/lib/content/types";
import { formatDate } from "@/lib/format";
import s from "./admin.module.css";

export const metadata: Metadata = { title: "검수와 관리", robots: { index: false, follow: false } };

const TABS: (WorkStatus | "all")[] = ["review", "published", "hidden", "all"];

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <div className={`container ${p.page}`}>
      <Suspense fallback={<SectionHeader title="검수와 관리" />}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const membersView = sp.view === "members";
  const memberQuery = typeof sp.q === "string" ? sp.q : "";
  const requestedPage = Number(sp.page);
  const tab = (TABS as string[]).includes(String(sp.status)) ? (sp.status as WorkStatus | "all") : "review";
  const [counts, works, member] = await Promise.all([countByStatus(), listWorksByStatus(tab), currentMember()]);
  const memberList = membersView && member?.isAdmin
    ? (memberQuery ? { items: searchMembers(memberQuery, "all"), total: 0, page: 1, pageCount: 1 } : listMembers(Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1))
    : null;

  return (
    <>
      <SectionHeader
        title={membersView ? "회원 역할 설정" : "검수와 관리"}
        action={
          <>
            <Link href="/admin/projects" className={s.headLink}>
              프로젝트·제작자
            </Link>
            <form action={checkLinksAction}>
              <Button type="submit" size="sm">
                링크 점검 실행
              </Button>
            </form>
            <form action={adminLogoutAction}>
              <Button type="submit" size="sm" variant="ghost">
                나가기
              </Button>
            </form>
          </>
        }
      />
      <nav aria-label="관리자 메뉴" className={p.row}>
        <Link href="/admin" className={s.tab} aria-current={!membersView ? "page" : undefined}>작품 검수</Link>
        <Link href="/admin?view=members" className={s.tab} aria-current={membersView ? "page" : undefined}>회원 역할 설정</Link>
      </nav>
      {membersView ? (
        member?.isAdmin && memberList ? <MemberAdminList items={memberList.items} selfId={member.id} page={memberList.page} total={memberList.total} pageCount={memberList.pageCount} query={memberQuery} result={typeof sp.admin === "string" ? sp.admin : undefined} />
          : <Notice>회원 권한은 운영진 회원 계정으로 로그인해야 바꿀 수 있어요. <Link href="/login?next=%2Fadmin%3Fview%3Dmembers">회원 계정으로 로그인</Link></Notice>
      ) : <>
      {sp.checked === "1" && <Notice tone="success">공개 작품의 링크 점검을 마쳤어요. 끊긴 링크는 목록에 표시됩니다.</Notice>}
      {sp.deleted === "1" && <Notice tone="success">작품을 삭제했어요.</Notice>}

      <nav aria-label="상태" className={p.row}>
        {TABS.map((t) => (
          <Link key={t} href={`/admin?status=${t}`} className={s.tab} aria-current={tab === t ? "page" : undefined}>
            {t === "all" ? "전체" : WORK_STATUS_LABEL[t]}
            <span className="t-mono">{t === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[t]}</span>
          </Link>
        ))}
      </nav>

      {works.length === 0 ? (
        <div className={p.empty}>
          <p>{tab === "review" ? "검수를 기다리는 작품이 없어요." : "작품이 없어요."}</p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>작품</th>
                <th>만든 사람</th>
                <th>상태</th>
                <th>조회</th>
                <th>좋아요</th>
                <th>수정일</th>
                <th>
                  <span className="visually-hidden">동작</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.slug}>
                  <td>
                    <div className={s.workCell}>
                      <TypeBadge purpose={w.purpose} type={w.type} />
                      <Link href={`/admin/works/${w.slug}`} className={s.title}>
                        {w.title}
                      </Link>
                      {w.linkBroken && <span className={s.broken}>링크 끊김</span>}
                    </div>
                    <p className={s.sub}>{w.summary}</p>
                  </td>
                  <td>{w.makers.map((m) => m.name).join(", ")}</td>
                  <td>
                    <StatusLabel status={w.status} />
                  </td>
                  <td className="t-mono">{w.viewCount.toLocaleString("ko-KR")}</td>
                  <td className="t-mono">{w.likeCount.toLocaleString("ko-KR")}</td>
                  <td className="t-mono">{formatDate(w.updatedAt)}</td>
                  <td>
                    <Link href={`/admin/works/${w.slug}`} className={s.headLink}>
                      검수 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>}
    </>
  );
}
