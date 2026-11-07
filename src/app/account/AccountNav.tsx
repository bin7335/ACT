import Link from "next/link";
import s from "./account.module.css";

export function AccountNav({ current, isAdmin }: { current: "works" | "settings"; isAdmin: boolean }) {
  return <nav aria-label="마이페이지" className={s.tabs}>
    <Link href="/account" className={s.tab} aria-current={current === "works" ? "page" : undefined}>내 작품</Link>
    <Link href="/account/settings" className={s.tab} aria-current={current === "settings" ? "page" : undefined}>계정 설정</Link>
    {isAdmin && <Link href="/admin" className={`${s.tab} ${s.tabAside}`}>운영진 화면 →</Link>}
  </nav>;
}
