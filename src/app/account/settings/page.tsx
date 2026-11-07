import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMember, googleConfigured } from "@/lib/auth";
import { logoutAction } from "@/app/auth-actions";
import { GoogleForm } from "@/components/AuthForm";
import { SectionHeader } from "@/components/SectionHeader";
import { Button, Notice, buttonClass } from "@/components/ui";
import p from "@/components/page.module.css";
import { AccountNav } from "../AccountNav";
import s from "../account.module.css";
import { AdminMembers } from "./AdminMembers";
import { NameForm } from "./NameForm";

export const metadata: Metadata = { title: "계정 설정", robots: { index: false, follow: false } };
export default function SettingsPage(props: PageProps<"/account/settings">) {
  return <div className={`container ${p.narrow} ${p.page}`}><Suspense fallback={<p>계정을 확인하는 중…</p>}><Content {...props} /></Suspense></div>;
}
async function Content({ searchParams }: PageProps<"/account/settings">) {
  const member = await requireMember("/account/settings");
  const params = await searchParams;
  const google = db.select().from(schema.googleIdentity).where(eq(schema.googleIdentity.memberId, member.id)).get();
  return <>
    <SectionHeader eyebrow="마이페이지" title={member.name} description={member.username ? `@${member.username}` : "Google 계정으로 로그인했어요."} />
    <AccountNav current="settings" isAdmin={member.isAdmin} />
    {params.linked && <Notice tone="success">Google 계정을 연결했어요. 이제 같은 계정으로 로그인할 수 있습니다.</Notice>}
    {params.error && <Notice tone="danger">Google 계정을 연결하지 못했어요. 요청이 만료되었거나 이미 다른 회원에 연결된 계정일 수 있습니다. 현재 계정은 변경하지 않았어요.</Notice>}
    <div>
      <section className={s.setting} aria-labelledby="profile-heading">
        <div className={s.settingHead}><h2 id="profile-heading">프로필</h2><p>사이트에 보이는 내 이름이에요.</p></div>
        <div className={s.settingBody}><NameForm name={member.name} /></div>
      </section>
      <section className={s.setting} aria-labelledby="login-heading">
        <div className={s.settingHead}><h2 id="login-heading">로그인 방법</h2><p>연결된 방법 중 아무거나로 로그인할 수 있어요.</p></div>
        <div className={s.settingBody}>
          <ul className={s.methods}>
            <li className={s.method}><div><strong>아이디</strong><span>{member.username ? `@${member.username}` : "Google로 가입해 아이디가 없어요."}</span></div>{member.username && <span className={s.on}>사용 중</span>}</li>
            <li className={s.method}><div><strong>Google</strong><span>{google ? google.email ?? "연결된 Google 계정" : "연결되지 않음"}</span></div>{google && <span className={s.on}>연결됨</span>}</li>
          </ul>
          {!google && member.username && <>
            <p>비밀번호를 잊으면 되찾을 방법이 없어요. Google 계정을 연결해 두면 Google로도 로그인할 수 있어요.</p>
            <details className={s.disclosure} open={!!params.error}>
              <summary className={buttonClass("secondary", "md")}>Google 계정 연결하기</summary>
              <GoogleForm link enabled={googleConfigured()} />
            </details>
          </>}
        </div>
      </section>
      {member.isAdmin && <AdminMembers selfId={member.id} query={typeof params.q === "string" ? params.q : ""} result={typeof params.admin === "string" ? params.admin : undefined} />}
      <section className={s.setting} aria-labelledby="session-heading">
        <div className={s.settingHead}><h2 id="session-heading">로그아웃</h2><p>공용 컴퓨터라면 사용 후 꼭 로그아웃해 주세요.</p></div>
        <div className={s.settingBody}><form action={logoutAction}><Button type="submit">로그아웃</Button></form></div>
      </section>
    </div>
  </>;
}
