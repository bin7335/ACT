import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMember, googleConfigured } from "@/lib/auth";
import { GoogleForm } from "@/components/AuthForm";
import { SectionHeader } from "@/components/SectionHeader";
import { ButtonLink, Notice } from "@/components/ui";
import p from "@/components/page.module.css";
import { AdminMembers } from "./AdminMembers";

export const metadata: Metadata = { title: "계정 설정", robots: { index: false, follow: false } };
export default function SettingsPage(props: PageProps<"/account/settings">) {
  return <div className={`container ${p.narrow} ${p.page}`}><Suspense fallback={<p>계정을 확인하는 중…</p>}><Content {...props} /></Suspense></div>;
}
async function Content({ searchParams }: PageProps<"/account/settings">) {
  const member = await requireMember("/account/settings");
  const params = await searchParams;
  const linked = !!db.select().from(schema.googleIdentity).where(eq(schema.googleIdentity.memberId, member.id)).get();
  return <>
    <SectionHeader eyebrow="ACCOUNT SETTINGS" title="계정 설정" description={`${member.name}님의 로그인 방법을 관리합니다.`} />
    {params.linked && <Notice tone="success">Google 계정을 연결했어요. 이제 같은 계정으로 로그인할 수 있습니다.</Notice>}
    {params.error && <Notice tone="danger">Google 계정을 연결하지 못했어요. 요청이 만료되었거나 이미 다른 회원에 연결된 계정일 수 있습니다. 현재 계정은 변경하지 않았어요.</Notice>}
    <section className={p.prose} aria-labelledby="login-methods"><h2 id="login-methods" className="t-h2">로그인 방법</h2>
      <p>{member.username ? `아이디: ${member.username}` : "Google로 가입한 계정입니다."}</p>
      {linked ? <p>Google 연결됨</p> : <><p>현재 비밀번호를 확인한 뒤 연결할 Google 계정을 선택해 주세요.</p><GoogleForm link enabled={googleConfigured()} /></>}
    </section>
    {member.isAdmin && <AdminMembers selfId={member.id} query={typeof params.q === "string" ? params.q : ""} result={typeof params.admin === "string" ? params.admin : undefined} />}
    <ButtonLink href="/account">마이페이지</ButtonLink>
  </>;
}
