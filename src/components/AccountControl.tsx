"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "@/app/auth-actions";
import { buttonClass } from "./ui";
import s from "./AccountControl.module.css";

export function AccountControl({ member }: { member: { name: string; username: string | null; isAdmin: boolean } | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); }

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!member) return <Link href={`/login?next=${encodeURIComponent(pathname === "/login" || pathname === "/signup" ? "/" : pathname)}`} scroll={false} className={buttonClass("secondary", "sm")}>로그인</Link>;
  return <div ref={root} className={s.root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} className={s.trigger} type="button" aria-label={`${member.name} 계정 메뉴`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span className={s.avatar} aria-hidden>{Array.from(member.name)[0]}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    </button>
    {open && <div id={id} className={s.panel}>
      <div className={s.identity}><strong>{member.name}</strong><span>{member.username ? `@${member.username}` : "Google 계정"}</span></div>
      <nav aria-label="계정"><Link href="/account" onClick={() => setOpen(false)}>마이페이지</Link><Link href="/account/settings" onClick={() => setOpen(false)}>계정 설정</Link>{member.isAdmin && <Link href="/admin" onClick={() => setOpen(false)}>운영진 화면</Link>}</nav>
      <form action={logoutAction}><button type="submit">로그아웃</button></form>
    </div>}
  </div>;
}
