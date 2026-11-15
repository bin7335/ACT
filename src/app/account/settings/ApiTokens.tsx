"use client";

import { useActionState, useState } from "react";
import { createApiTokenAction, revokeApiTokenAction } from "@/app/actions";
import { Button, Notice } from "@/components/ui";
import { formatDate } from "@/lib/format";
import f from "@/components/form.module.css";
import s from "../account.module.css";

type Row = { id: string; name: string; createdAt: Date; lastUsedAt: Date | null };

export function ApiTokens({ tokens }: { tokens: Row[] }) {
  const [state, action, pending] = useActionState(createApiTokenAction, {});
  const [copied, setCopied] = useState(false);

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id="api" className={s.setting} aria-labelledby="api-heading">
      <div className={s.settingHead}>
        <h2 id="api-heading">API 토큰</h2>
        <p>에이전트나 스크립트가 내 계정으로 작품을 등록할 때 씁니다. 토큰은 만든 직후 한 번만 보여요.</p>
      </div>
      <div className={s.settingBody}>
        {state.token && (
          <Notice tone="success">
            <strong>이 토큰은 지금만 볼 수 있어요.</strong> 안전한 곳에 복사해 두세요.
            <div className={s.inline} style={{ marginTop: 8 }}>
              <code style={{ wordBreak: "break-all" }}>{state.token}</code>
              <Button type="button" size="sm" onClick={() => copy(state.token!)}>{copied ? "복사됨" : "복사"}</Button>
            </div>
          한 번 닫으면 다시 볼 수 없고, 잃어버리면 새로 만들어야 합니다.
          </Notice>
        )}
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        <form action={action} className={f.field}>
          <label htmlFor="token-name" className={f.label}>토큰 이름</label>
          <div className={s.inline}>
            <input id="token-name" name="name" maxLength={40} placeholder="예: 작품 등록 에이전트" className={f.input} />
            <Button type="submit" disabled={pending}>{pending ? "만드는 중…" : "토큰 만들기"}</Button>
          </div>
        </form>
        <p>운영진 토큰으로 등록한 작품은 검수 없이 바로 공개되고, 일반 회원 토큰은 검수 대기로 들어갑니다.</p>
        {tokens.length > 0 ? (
          <ul className={s.members}>
            {tokens.map((t) => (
              <li key={t.id} className={s.memberRow}>
                <div>
                  <strong>{t.name}</strong>
                  <br />
                  <span>만듦 {formatDate(t.createdAt)} · {t.lastUsedAt ? `최근 사용 ${formatDate(t.lastUsedAt)}` : "사용 기록 없음"}</span>
                </div>
                <form action={revokeApiTokenAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <Button type="submit" size="sm" variant="ghost">폐기</Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p>아직 만든 토큰이 없어요.</p>
        )}
      </div>
    </section>
  );
}
