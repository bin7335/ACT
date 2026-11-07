"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/app/actions";
import { Button, Notice } from "@/components/ui";
import f from "@/components/form.module.css";

export function LoginForm() {
  const [state, action, pending] = useActionState(adminLoginAction, {});
  return (
    <form action={action} className={f.form}>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className={f.field}>
        <label htmlFor="password" className={f.label}>
          비밀번호
        </label>
        <input id="password" name="password" type="password" className={f.input} required autoComplete="current-password" autoFocus />
      </div>
      <Button type="submit" variant="primary" block disabled={pending}>
        {pending ? "확인하는 중…" : "들어가기"}
      </Button>
    </form>
  );
}
