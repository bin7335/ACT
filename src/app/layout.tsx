import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AdminTab, ProjectsTab, TopNav, TopNavView } from "@/components/TopNav";
import { site } from "@/lib/site";
import { currentMember } from "@/lib/auth";
import { isAdmin, projectAccess } from "@/lib/admin";
import { AccountControl } from "@/components/AccountControl";

async function HeaderAccount() {
  const member = await currentMember();
  return <AccountControl member={member ? { name: member.name, username: member.username, isAdmin: member.isAdmin } : null} />;
}

async function HeaderProjectsTab() {
  return <ProjectsTab show={(await projectAccess()).allowed} />;
}

async function HeaderAdminTab() {
  return <AdminTab isAdmin={await isAdmin()} />;
}
import "./globals.css";
import s from "./layout.module.css";

const sans = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: false,
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · ${site.shortName}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { siteName: site.name, locale: "ko_KR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1d21" },
  ],
};

export default function RootLayout({ children, auth }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${sans.variable} ${mono.variable}`}>
      <body className={s.body}>
        <Suspense fallback={<TopNavView siteName={site.name} pathname="" />}>
          <TopNav
            siteName={site.name}
            projects={<Suspense fallback={null}><HeaderProjectsTab /></Suspense>}
            admin={<Suspense fallback={null}><HeaderAdminTab /></Suspense>}
            account={<Suspense fallback={<span aria-label="계정 확인 중" style={{ width: 56 }} />}><HeaderAccount /></Suspense>}
          />
        </Suspense>
        <main id="main" className={s.main}>
          {children}
        </main>
        {auth}
        <footer className={s.footer}>
          <div className={`container ${s.footerInner}`}>
            <div>
              <p className={s.footerBrand}>
                <span className="t-mono">ACT</span> {site.name}
              </p>
              <p className={s.footerText}>선생님들이 교실을 위해 직접 만든 것을 기록하고 나눕니다.</p>
            </div>
            <nav aria-label="하단 메뉴" className={s.footerNav}>
              <Link href="/works">작품</Link>
              <Link href="/makers">제작자</Link>
              <Link href="/about">소개</Link>
              <Link href="/submit">작품 올리기</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
