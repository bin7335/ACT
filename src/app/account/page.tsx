import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { ownWorks } from "@/lib/member-works";
import { SectionHeader } from "@/components/SectionHeader";
import { ButtonLink, Notice, StatusLabel } from "@/components/ui";
import p from "@/components/page.module.css";

export const metadata: Metadata = { title: "마이페이지", robots: { index: false, follow: false } };
export default function AccountPage(props: PageProps<"/account">) {
  return <div className={`container ${p.narrow} ${p.page}`}><Suspense fallback={<p>계정을 확인하는 중…</p>}><Content {...props} /></Suspense></div>;
}
async function Content(props: PageProps<"/account">) {
  const member = await requireMember();
  const sp = await props.searchParams;
  const works = await ownWorks();
  return <>
    <SectionHeader eyebrow="MY ACCOUNT" title={`${member.name}님의 마이페이지`} description={member.username ? `아이디: ${member.username}` : "Google로 가입한 계정입니다."} />
    {sp.linked && <Notice tone="success">Google 계정을 연결했어요. 이제 같은 계정으로 로그인할 수 있습니다.</Notice>}
    {sp.error && <Notice tone="danger">Google 계정을 연결하지 못했어요. 요청이 만료되었거나 이미 다른 회원에 연결된 Google 계정일 수 있습니다. 현재 계정은 변경하지 않았어요.</Notice>}
    <ButtonLink href="/account/settings">계정 설정</ButtonLink>
    <section className={p.prose} aria-labelledby="works-heading">
      <h2 id="works-heading" className="t-h2">내 작품 ({works.length})</h2>
      <p>내가 올린 작품을 확인하고 수정할 수 있어요.</p>
      {works.length ? <ul>{works.map(work => <li key={work.slug}><Link href={`/account/works/${work.slug}`}>{work.title}</Link> · <StatusLabel status={work.status} /></li>)}</ul> : <p>아직 연결된 작품이 없어요.</p>}
      <ButtonLink href="/submit">작품 올리기</ButtonLink>
    </section>
  </>;
}
