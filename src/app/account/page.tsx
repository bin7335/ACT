import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { ownWorks } from "@/lib/member-works";
import { formatDate } from "@/lib/format";
import { WORK_STATUS_LABEL } from "@/lib/content/types";
import { SectionHeader } from "@/components/SectionHeader";
import { ButtonLink, Notice, StatusLabel, TypeBadge } from "@/components/ui";
import p from "@/components/page.module.css";
import { AccountNav } from "./AccountNav";
import s from "./account.module.css";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false, follow: false } };
export default function AccountPage(props: PageProps<"/account">) {
  return <div className={`container ${p.narrow} ${p.page}`}><Suspense fallback={<p>계정을 확인하는 중…</p>}><Content {...props} /></Suspense></div>;
}
async function Content(props: PageProps<"/account">) {
  const member = await requireMember();
  const sp = await props.searchParams;
  const works = await ownWorks();
  const count = (status: string) => works.filter(w => w.status === status).length;
  return <>
    <SectionHeader eyebrow="MY PAGE" title={member.name} description={member.username ? `@${member.username}` : "Google 계정으로 로그인했어요."} action={<ButtonLink href="/submit" variant="primary">작품 올리기</ButtonLink>} />
    <AccountNav current="works" isAdmin={member.isAdmin} />
    {sp.linked && <Notice tone="success">Google 계정을 연결했어요. 이제 같은 계정으로 로그인할 수 있습니다.</Notice>}
    {sp.error && <Notice tone="danger">Google 계정을 연결하지 못했어요. 요청이 만료되었거나 이미 다른 회원에 연결된 Google 계정일 수 있습니다. 현재 계정은 변경하지 않았어요.</Notice>}
    <dl className={s.stats}>
      <div className={s.stat}><dt>전체</dt><dd>{works.length}</dd></div>
      {(["review", "published", "hidden"] as const).map(status => <div key={status} className={s.stat}><dt>{WORK_STATUS_LABEL[status]}</dt><dd>{count(status)}</dd></div>)}
    </dl>
    <section aria-labelledby="works-heading">
      <div className={s.listHead}><h2 id="works-heading">올린 작품</h2><span className={s.workMeta}>최근 수정순</span></div>
      {works.length ? <ul className={s.works}>{works.map(work => <li key={work.slug} className={s.work}>
        <div className={s.workMain}>
          <Link href={`/account/works/${work.slug}`} className={s.workTitle}>{work.title}</Link>
          <p className={s.workSummary}>{work.summary}</p>
          <div className={s.workMeta}>
            <TypeBadge type={work.type} />
            <StatusLabel status={work.status} />
            <span>{formatDate(work.updatedAt)} 수정</span>
            {work.reviewNote && <span className={s.note}>운영진 메모 있음</span>}
          </div>
        </div>
        <div className={s.workActions}>
          {work.status === "published" && <ButtonLink href={`/works/${work.slug}`} size="sm" variant="ghost">공개 페이지</ButtonLink>}
          <ButtonLink href={`/account/works/${work.slug}`} size="sm">수정</ButtonLink>
        </div>
      </li>)}</ul> : <div className={s.empty}>
        <strong>아직 올린 작품이 없어요.</strong>
        <p>수업에서 쓰는 도구나 자료를 올려 보세요. 운영진이 확인한 뒤 아카이브에 공개됩니다.</p>
        <ButtonLink href="/submit" variant="primary">첫 작품 올리기</ButtonLink>
      </div>}
    </section>
  </>;
}
