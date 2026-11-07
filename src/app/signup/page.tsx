import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { SectionHeader } from "@/components/SectionHeader";
import { currentMember } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth-credentials";
import p from "@/components/page.module.css";

export const metadata: Metadata = { title: "회원가입", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function SignupPage(props: PageProps<"/signup">) {
  return <div className={`container ${p.narrow} ${p.page}`}><SectionHeader eyebrow="회원가입" title="아이디 회원가입" description="가입 후 마이페이지에서 Google 로그인도 연결할 수 있어요." /><Suspense fallback={<p>불러오는 중…</p>}><Content {...props} /></Suspense></div>;
}
async function Content(props: PageProps<"/signup">) {
  const sp = await props.searchParams;
  const next = safeReturnPath(typeof sp.next === "string" ? sp.next : null);
  if (await currentMember()) redirect(next);
  return <><AuthForm mode="signup" next={next} /><p><Link href={`/login?next=${encodeURIComponent(next)}`}>이미 계정이 있나요? 로그인 →</Link></p></>;
}
