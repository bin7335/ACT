"use client";

import { useActionState } from "react";
import { credentialsAction, beginGoogleAction } from "@/app/auth-actions";
import { Button, Notice } from "./ui";
import f from "./form.module.css";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const [state, action, pending] = useActionState(credentialsAction.bind(null, mode), {});
  return (
    <form action={action} className={f.form}>
      <input type="hidden" name="next" value={next} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className={f.field}>
        <label htmlFor="username" className={f.label}>아이디</label>
        <input id="username" name="username" className={f.input} required minLength={4} maxLength={24} pattern="[a-zA-Z0-9_]{4,24}" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="username-hint" />
        <p id="username-hint" className={f.hint}>영문·숫자·밑줄 4~24자. 대소문자는 구분하지 않아요.</p>
      </div>
      {mode === "signup" && <div className={f.field}><label htmlFor="name" className={f.label}>표시 이름</label><input id="name" name="name" className={f.input} required maxLength={40} autoComplete="nickname" /></div>}
      <div className={f.field}>
        <label htmlFor="password" className={f.label}>비밀번호</label>
        <input id="password" name="password" type="password" className={f.input} required minLength={12} maxLength={128} autoComplete={mode === "signup" ? "new-password" : "current-password"} aria-describedby="password-hint" />
        <p id="password-hint" className={f.hint}>12~128자. 다른 사이트와 다른 비밀번호를 사용해 주세요.</p>
      </div>
      {mode === "signup" && <>
        <div className={f.field}><label htmlFor="confirm" className={f.label}>비밀번호 확인</label><input id="confirm" name="confirm" type="password" className={f.input} required minLength={12} maxLength={128} autoComplete="new-password" /></div>
        <label className={f.check}><input type="checkbox" name="consent" required /><span>로그인과 작품 관리를 위해 아이디, 표시 이름, 비밀번호 해시를 저장하는 데 동의합니다. 비밀번호 재설정은 아직 지원하지 않으므로 가입 후 Google 계정을 연결해 주세요.</span></label>
      </>}
      <Button type="submit" variant="primary" disabled={pending}>{pending ? "처리하는 중…" : mode === "signup" ? "회원가입" : "아이디로 로그인"}</Button>
    </form>
  );
}

export function GoogleForm({ next = "/account", link = false, enabled = true }: { next?: string; link?: boolean; enabled?: boolean }) {
  const [state, action, pending] = useActionState(beginGoogleAction.bind(null, link), {});
  return <form action={action} className={f.form}>
    <input type="hidden" name="next" value={next} />
    {state.error && <Notice tone="danger">{state.error}</Notice>}
    {link && <div className={f.field}><label htmlFor="link-password" className={f.label}>현재 비밀번호 확인</label><input id="link-password" name="password" type="password" className={f.input} autoComplete="current-password" required minLength={12} maxLength={128} /></div>}
    <Button type="submit" disabled={pending || !enabled}>{pending ? "연결하는 중…" : link ? "Google 계정 연결" : "Google로 계속하기"}</Button>
    {!enabled && <p className={f.hint}>Google 로그인 설정을 준비 중입니다. 아이디 로그인은 이용할 수 있어요.</p>}
  </form>;
}
