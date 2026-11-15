"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthForm, GoogleForm } from "./AuthForm";
import s from "./AuthModal.module.css";

export function AuthModal({ initialMode, next, googleEnabled }: { initialMode: "login" | "signup"; next: string; googleEnabled: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const router = useRouter();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={dialog} className={s.dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); router.back(); }} onClick={event => {
    if (event.target === event.currentTarget) {
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) router.back();
    }
  }}>
    <button type="button" className={s.close} aria-label="로그인 창 닫기" onClick={() => router.back()}>×</button>
    <div className={s.heading}><span className={s.brand}>ACT</span><h2 id={titleId} ref={heading} tabIndex={-1}>{mode === "login" ? "로그인" : "회원가입"}</h2><p>교실을 위한 아이디어를 나누세요.</p></div>
    <GoogleForm next={next} enabled={googleEnabled} />
    <div className={s.divider}><span>또는 아이디로 {mode === "login" ? "로그인" : "가입"}</span></div>
    <AuthForm key={mode} mode={mode} next={next} />
    <p className={s.switch}>{mode === "login" ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?"} <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); dialog.current?.scrollTo(0, 0); heading.current?.focus(); }}>{mode === "login" ? "회원가입" : "로그인"}</button></p>
  </dialog>;
}
