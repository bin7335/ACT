"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useFavorites } from "./favorites";
import { buttonClass } from "./ui";
import s from "./TopNav.module.css";

const MENU = [
  { href: "/works", label: "작품" },
  { href: "/makers", label: "제작자" },
  { href: "/projects", label: "연구회 프로젝트" },
  { href: "/about", label: "소개" },
];

export function TopNav({ siteName }: { siteName: string }) {
  return <TopNavView siteName={siteName} pathname={usePathname()} />;
}

/** usePathname 없이 그리는 정적 셸(프리렌더용 Suspense fallback) */
export function TopNavView({ siteName, pathname }: { siteName: string; pathname: string }) {
  const [open, setOpen] = useState(false);
  const favCount = useFavorites().length;

  // 페이지가 바뀌면 모바일 메뉴를 닫는다(렌더 중 이전 값과 비교).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const active = (href: string) => !!pathname && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className={s.header}>
      <a href="#main" className={s.skip}>
        본문 바로가기
      </a>
      <div className={`container ${s.bar}`}>
        <Link href="/" className={s.brand}>
          <span className={s.mark}>ACT</span>
          <span className={s.brandName}>{siteName}</span>
        </Link>

        <nav aria-label="주요 메뉴" className={s.menu} data-open={open}>
          <ul>
            {MENU.map((m) => (
              <li key={m.href}>
                <Link href={m.href} aria-current={active(m.href) ? "page" : undefined}>
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={s.actions}>
          <Link href="/favorites" className={s.fav} aria-current={active("/favorites") ? "page" : undefined}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M4 2h8v12l-4-3-4 3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className={s.favLabel}>즐겨찾기</span>
            {favCount > 0 && <span className={s.count}>{favCount}</span>}
          </Link>
          <Link href="/submit" className={`${buttonClass("primary", "sm")} ${s.submit}`}>
            작품 올리기
          </Link>
          <button type="button" className={s.toggle} aria-expanded={open} aria-label="메뉴" onClick={() => setOpen((v) => !v)}>
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
