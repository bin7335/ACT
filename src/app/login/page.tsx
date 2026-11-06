import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm, GoogleForm } from "@/components/AuthForm";
import { SectionHeader } from "@/components/SectionHeader";
import { Notice } from "@/components/ui";
import { currentMember, googleConfigured } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth-credentials";
import p from "@/components/page.module.css";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function LoginPage(props: PageProps<"/login">) {
  return <div className={`container ${p.narrow} ${p.page}`}><SectionHeader eyebrow="ACCOUNT" title="로그인" description="계정에 연결된 작품을 한곳에서 관리하세요. 둘러보기와 비회원 제출은 그대로 이용할 수 있어요." /><Suspense fallback={<p>불러오는 중…</p>}><Content {...props} /></Suspense></div>;
}

async function Content(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeReturnPath(typeof sp.next === "string" ? sp.next : null);
  if (await currentMember()) redirect(next);
  return <>
    {sp.error && <Notice tone="danger">Google 로그인을 완료하지 못했어요. 취소했거나 요청이 만료되었다면 다시 시도해 주세요.</Notice>}
    <AuthForm mode="login" next={next} />
    <p><Link href={`/signup?next=${encodeURIComponent(next)}`}>처음 오셨나요? 아이디 회원가입 →</Link></p>
    <GoogleForm next={next} enabled={googleConfigured()} />
    <p>Google로 처음 로그인하면 계정이 만들어집니다. 기존 아이디가 있다면 먼저 아이디로 로그인한 뒤 마이페이지에서 연결해 주세요.</p>
  </>;
}
