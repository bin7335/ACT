import type { Metadata } from "next";
import { SectionHeader } from "@/components/SectionHeader";
import { Notice } from "@/components/ui";
import p from "@/components/page.module.css";
import { adminPasswordConfigured } from "@/lib/admin";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "운영진", robots: { index: false, follow: false } };

export default function AdminLogin() {
  return (
    <div className={`container ${p.page}`} style={{ maxWidth: 480 + 32 }}>
      <SectionHeader eyebrow="ADMIN" title="운영진 화면" description="검수와 관리는 운영진 비밀번호로 들어갑니다." />
      {adminPasswordConfigured() ? (
        <LoginForm />
      ) : (
        <Notice tone="danger">
          <strong>ADMIN_PASSWORD가 설정되지 않았어요.</strong> 서버 환경변수에 운영진 비밀번호를 넣어 주세요.
        </Notice>
      )}
    </div>
  );
}
