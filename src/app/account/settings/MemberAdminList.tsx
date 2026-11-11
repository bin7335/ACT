import Link from "next/link";
import { setMemberAdminAction } from "@/app/actions";
import type { MemberRow } from "@/lib/members";
import { Button, Notice } from "@/components/ui";
import f from "@/components/form.module.css";
import p from "@/components/page.module.css";
import s from "../account.module.css";

const RESULT: Record<string, { tone?: "danger" | "success"; text: string }> = {
  granted: { tone: "success", text: "운영진 권한을 부여했어요." },
  revoked: { tone: "success", text: "일반 회원으로 바꿨어요." },
  self: { tone: "danger", text: "내 운영진 권한은 직접 해제할 수 없어요. 다른 운영진에게 요청해 주세요." },
  missing: { tone: "danger", text: "회원을 찾지 못했어요." },
  denied: { tone: "danger", text: "운영진만 권한을 바꿀 수 있어요." },
};

function MemberItem({ member, selfId, page, query }: { member: MemberRow; selfId: string; page: number; query: string }) {
  return (
    <li className={s.memberRow}>
      <div>
        <strong>{member.name}</strong>
        {member.isAdmin && <span className={s.badge}>운영진</span>}
        {member.id === selfId && <span> (나)</span>}
        <br />
        <span>{[member.username && `@${member.username}`, member.email].filter(Boolean).join(" · ") || "Google 계정"}</span>
      </div>
      {member.id === selfId ? null : (
        <form action={setMemberAdminAction} className={s.roleForm}>
          <input type="hidden" name="context" value="admin" />
          <input type="hidden" name="member" value={member.id} />
          <input type="hidden" name="q" value={query} />
          <input type="hidden" name="page" value={page} />
          <label className="visually-hidden" htmlFor={`role-${member.id}`}>{member.name} 권한</label>
          <select id={`role-${member.id}`} name="grant" className={f.select} defaultValue={member.isAdmin ? "1" : "0"}>
            <option value="0">일반 회원</option>
            <option value="1">운영진</option>
          </select>
          <Button type="submit" size="sm">저장</Button>
        </form>
      )}
    </li>
  );
}

export function MemberAdminList({ items, selfId, page, total, pageCount, query, result }: {
  items: MemberRow[]; selfId: string; page: number; total: number; pageCount: number; query: string; result?: string;
}) {
  const notice = result ? RESULT[result] : undefined;
  return (
    <section id="admins" className={s.setting} aria-labelledby="admins-heading">
      <div className={s.settingHead}>
        <h2 id="admins-heading">회원 권한 설정</h2>
        <p>권한을 바꾸고 저장하면 바로 적용돼요. 운영진은 검수 없이 작품을 올릴 수 있습니다.</p>
      </div>
      <div className={s.settingBody}>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <form action="/admin" role="search" className={f.field}>
          <input type="hidden" name="view" value="members" />
          <label htmlFor="member-q" className={f.label}>회원 검색</label>
          <div className={s.inline}>
            <input id="member-q" name="q" type="search" defaultValue={query} placeholder="이름, 아이디, Google 이메일" className={f.input} maxLength={60} />
            <Button type="submit">검색</Button>
          </div>
        </form>

        {query ? (
          <>
            <p>“{query}” 검색 결과 {items.length}명 (최대 30명) · <Link href="/admin?view=members">전체 목록</Link></p>
            {items.length ? (
              <ul className={s.members}>{items.map((m) => <MemberItem key={m.id} member={m} selfId={selfId} page={1} query={query} />)}</ul>
            ) : (
              <p>일치하는 회원이 없어요. 이름, 아이디 또는 Google 이메일로 다시 검색해 주세요.</p>
            )}
          </>
        ) : (
          <>
            <p>가입자 {total}명 · {page}/{pageCount}페이지</p>
            {items.length ? (
              <ul className={s.members}>{items.map((m) => <MemberItem key={m.id} member={m} selfId={selfId} page={page} query="" />)}</ul>
            ) : (
              <p>아직 가입한 회원이 없어요.</p>
            )}
            <Pagination page={page} pageCount={pageCount} />
          </>
        )}
      </div>
    </section>
  );
}

function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <nav aria-label="페이지" className={p.pagination}>
      <Link className={p.pageLink} href={`/admin?view=members&page=${page - 1}`} aria-disabled={page === 1} aria-label="이전 페이지">←</Link>
      {pages.map((n) => (
        <Link key={n} className={p.pageLink} href={`/admin?view=members&page=${n}`} aria-current={n === page ? "page" : undefined}>{n}</Link>
      ))}
      <Link className={p.pageLink} href={`/admin?view=members&page=${page + 1}`} aria-disabled={page === pageCount} aria-label="다음 페이지">→</Link>
    </nav>
  );
}
