import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { SectionHeader } from "@/components/SectionHeader";
import { Notice } from "@/components/ui";
import p from "@/components/page.module.css";
import { adminPasswordConfigured } from "@/lib/admin";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "운영진", robots: { index: false, follow: false } };

async function PasswordLogin() {
  // 빌드에는 운영 시크릿이 없다. 실행 시점의 설정으로 폼을 렌더링한다.
  await connection();
  return adminPasswordConfigured() ? <LoginForm /> : (
    <Notice tone="danger">
      <strong>ADMIN_PASSWORD가 설정되지 않았어요.</strong> 서버 환경변수에 운영진 비밀번호를 넣어 주세요.
    </Notice>
  );
}

export default function AdminLogin() {
  return (
    <div className={`container ${p.page}`} style={{ maxWidth: 480 + 32 }}>
      <SectionHeader title="운영진 화면" description="운영진 권한이 있는 계정으로 로그인하거나 운영진 비밀번호로 들어갑니다." />
      <Suspense fallback={<p>로그인을 준비하는 중…</p>}><PasswordLogin /></Suspense>
    </div>
  );
}
