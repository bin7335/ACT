import { setMemberAdminAction } from "@/app/actions";
import { searchMembers } from "@/lib/members";
import { Button, Notice } from "@/components/ui";
import f from "@/components/form.module.css";
import s from "../account.module.css";

const RESULT: Record<string, { tone?: "danger" | "success"; text: string }> = {
  granted: { tone: "success", text: "운영진 권한을 부여했어요." },
  revoked: { tone: "success", text: "운영진 권한을 해제했어요." },
  self: { tone: "danger", text: "내 운영진 권한은 직접 해제할 수 없어요. 다른 운영진에게 요청해 주세요." },
  missing: { tone: "danger", text: "회원을 찾지 못했어요." },
  denied: { tone: "danger", text: "운영진만 권한을 바꿀 수 있어요." },
};

export function AdminMembers({ selfId, query, result, context = "settings" }: { selfId: string; query: string; result?: string; context?: "settings" | "admin" }) {
  const members = searchMembers(query, context === "admin" ? "all" : "admins");
  const notice = result ? RESULT[result] : undefined;
  return <section id="admins" className={s.setting} aria-labelledby="admins-heading">
    <div className={s.settingHead}><h2 id="admins-heading">운영진 권한</h2><p>운영진은 작품 검수와 사이트 관리를 할 수 있어요.</p></div>
    <div className={s.settingBody}>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <form action={context === "admin" ? "/admin#admins" : "/account/settings#admins"} role="search" className={f.field}>
        {context === "admin" && <input type="hidden" name="view" value="members" />}
        <label htmlFor="member-q" className={f.label}>회원 찾기</label>
        <div className={s.inline}>
          <input id="member-q" name="q" type="search" defaultValue={query} placeholder="이름, 아이디, Google 이메일" className={f.input} maxLength={60} />
          <Button type="submit">검색</Button>
        </div>
      </form>
      <p>{query ? `“${query}” 검색 결과 ${members.length}명 (최대 30명)` : context === "admin" ? `최근 가입 회원 ${members.length}명 (최대 30명)` : `현재 운영진 ${members.length}명`}</p>
      {!members.length && <p>일치하는 회원이 없어요. 이름, 아이디 또는 Google 이메일로 다시 검색해 주세요.</p>}
      {members.length > 0 && <ul className={s.members}>{members.map(m => <li key={m.id} className={s.memberRow}>
        <div>
          <strong>{m.name}</strong>{m.isAdmin && <span className={s.badge}>운영진</span>}{m.id === selfId && <span> (나)</span>}
          <br /><span>{[m.username && `@${m.username}`, m.email].filter(Boolean).join(" · ") || "Google 계정"}</span>
        </div>
        {m.id !== selfId && <form action={setMemberAdminAction}>
          <input type="hidden" name="context" value={context} />
          <input type="hidden" name="member" value={m.id} />
          <input type="hidden" name="q" value={query} />
          <input type="hidden" name="grant" value={m.isAdmin ? "0" : "1"} />
          <Button type="submit" size="sm" variant={m.isAdmin ? "ghost" : "primary"}>{m.isAdmin ? "권한 해제" : "운영진으로 지정"}</Button>
        </form>}
      </li>)}</ul>}
    </div>
  </section>;
}
