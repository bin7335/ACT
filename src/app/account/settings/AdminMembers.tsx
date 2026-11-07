import Link from "next/link";
import { setMemberAdminAction } from "@/app/actions";
import { searchMembers } from "@/lib/members";
import { Button, Notice } from "@/components/ui";
import f from "@/components/form.module.css";
import p from "@/components/page.module.css";

const RESULT: Record<string, { tone?: "danger" | "success"; text: string }> = {
  granted: { tone: "success", text: "운영진 권한을 부여했어요." },
  revoked: { tone: "success", text: "운영진 권한을 해제했어요." },
  self: { tone: "danger", text: "내 운영진 권한은 직접 해제할 수 없어요. 다른 운영진에게 요청해 주세요." },
  missing: { tone: "danger", text: "회원을 찾지 못했어요." },
  denied: { tone: "danger", text: "운영진만 권한을 바꿀 수 있어요." },
};

export function AdminMembers({ selfId, query, result }: { selfId: string; query: string; result?: string }) {
  const members = searchMembers(query);
  const notice = result ? RESULT[result] : undefined;
  return <section id="admins" className={p.prose} aria-labelledby="admins-heading">
    <h2 id="admins-heading" className="t-h2">운영진 권한</h2>
    <p>가입한 회원을 이름·아이디·Google 이메일로 찾아 운영진 권한을 부여하거나 해제합니다. 운영진은 <Link href="/admin">운영진 화면</Link>에서 검수와 관리를 할 수 있어요.</p>
    {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    <form action="/account/settings#admins" className={p.row} role="search">
      <label htmlFor="member-q" className="visually-hidden">회원 검색</label>
      <input id="member-q" name="q" type="search" defaultValue={query} placeholder="이름, 아이디, 이메일" className={f.input} maxLength={60} />
      <Button type="submit" size="sm">검색</Button>
    </form>
    <p>{query ? `“${query}” 검색 결과 ${members.length}명` : `현재 운영진 ${members.length}명`}</p>
    {members.length > 0 && <ul>{members.map(m => <li key={m.id} className={p.row}>
      <span><strong>{m.name}</strong> {[m.username && `@${m.username}`, m.email].filter(Boolean).join(" · ") || "Google 계정"}{m.isAdmin && " · 운영진"}{m.id === selfId && " (나)"}</span>
      {m.id !== selfId && <form action={setMemberAdminAction}>
        <input type="hidden" name="member" value={m.id} />
        <input type="hidden" name="q" value={query} />
        <input type="hidden" name="grant" value={m.isAdmin ? "0" : "1"} />
        <Button type="submit" size="sm" variant={m.isAdmin ? "ghost" : "primary"}>{m.isAdmin ? "권한 해제" : "운영진으로 지정"}</Button>
      </form>}
    </li>)}</ul>}
  </section>;
}
