"use client";

import { useActionState } from "react";
import { updateNameAction } from "@/app/auth-actions";
import { Button, Notice } from "@/components/ui";
import f from "@/components/form.module.css";
import s from "../account.module.css";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateNameAction, {});
  return <form action={action} className={f.field}>
    <label htmlFor="display-name" className={f.label}>표시 이름</label>
    <div className={s.inline}>
      <input id="display-name" name="name" className={f.input} defaultValue={name} required maxLength={40} autoComplete="nickname" aria-describedby="display-name-hint" />
      <Button type="submit" disabled={pending}>{pending ? "저장하는 중…" : "저장"}</Button>
    </div>
    <p id="display-name-hint" className={f.hint}>새로 올리는 작품의 제작자 이름으로 쓰여요. 이미 올린 작품의 제작자 표시는 바뀌지 않아요.</p>
    {state.error && <Notice tone="danger">{state.error}</Notice>}
    {state.saved && <Notice tone="success">표시 이름을 저장했어요.</Notice>}
  </form>;
}
