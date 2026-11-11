"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { onFirstFavorite, useFavorites } from "./favorites";
import { buttonClass } from "./ui";
import s from "./TopNav.module.css";

const MENU = [
  { href: "/works", label: "작품" },
  { href: "/makers", label: "제작자" },
  { href: "/about", label: "소개" },
];

export function TopNav({ siteName, account, admin, projects }: { siteName: string; account?: ReactNode; admin?: ReactNode; projects?: ReactNode }) {
  return <TopNavView siteName={siteName} pathname={usePathname()} account={account} admin={admin} projects={projects} />;
}

/** 연구회회원과 관리자에게만 보이는 상단 탭. 서버에서 권한을 확인해 show로 넘긴다. */
export function ProjectsTab({ show }: { show: boolean }) {
  const pathname = usePathname();
  if (!show) return null;
  const on = pathname === "/projects" || pathname.startsWith("/projects/");
  return (
    <li>
      <Link href="/projects" aria-current={on ? "page" : undefined}>
        연구회 프로젝트
      </Link>
    </li>
  );
}

/** 운영진에게만 보이는 상단 탭. 서버에서 권한을 확인해 isAdmin으로 넘긴다. */
export function AdminTab({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  if (!isAdmin) return null;
  const on = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <li>
      <Link href="/admin" aria-current={on ? "page" : undefined}>
        관리자페이지
      </Link>
    </li>
  );
}

/** usePathname 없이 그리는 정적 셸(프리렌더용 Suspense fallback) */
export function TopNavView({ siteName, pathname, account, admin, projects }: { siteName: string; pathname: string; account?: ReactNode; admin?: ReactNode; projects?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const favCount = useFavorites().length;
  const [hint, setHint] = useState(false);

  // 페이지가 바뀌면 모바일 메뉴를 닫는다(렌더 중 이전 값과 비교).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setHint(false);
  }
  // 처음 즐겨찾기에 담으면 어디서 모아 보는지 잠깐 알려 준다.
  useEffect(() => onFirstFavorite(() => setHint(true)), []);
  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(false), 8000);
    return () => window.clearTimeout(timer);
  }, [hint]);
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
            {projects}
            {admin}
          </ul>
        </nav>

        <div className={s.actions}>
          <div className={s.favWrap}>
            <Link href="/favorites" className={s.fav} data-hint={hint || undefined} aria-current={active("/favorites") ? "page" : undefined}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="M4 2h8v12l-4-3-4 3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className={s.favLabel}>즐겨찾기</span>
              {favCount > 0 && <span className={s.count}>{favCount}</span>}
            </Link>
            <div role="status">
              {hint && (
                <div className={s.hint}>
                  <p>
                    <strong>즐겨찾기에 담았어요.</strong> 담은 작품은 이 버튼에서 모아 볼 수 있어요. 이 브라우저에만 저장됩니다.
                  </p>
                  <button type="button" className={s.hintClose} aria-label="안내 닫기" onClick={() => setHint(false)}>
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
          <Link href="/submit" className={`${buttonClass("primary", "sm")} ${s.submit}`}>
            작품 올리기
          </Link>
          {account}
          <button type="button" className={s.toggle} aria-expanded={open} aria-label="메뉴" onClick={() => setOpen((v) => !v)}>
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
