"use client";

import { useActionState } from "react";
import { createProjectAction } from "@/app/actions";
import { Button, Notice } from "@/components/ui";
import f from "@/components/form.module.css";

export function ProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, {});
  const year = new Date().getFullYear();
  return (
    <form action={action} className={f.form} style={{ gap: 12, maxWidth: 720 }}>
      <h3 className="t-h3">새 프로젝트</h3>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">프로젝트를 만들었어요.</Notice>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="year" type="number" defaultValue={year} min={2000} max={2100} className={f.input} style={{ width: 120 }} aria-label="연도" required />
        <select name="term" className={f.select} aria-label="학기" defaultValue="1학기">
          <option>1학기</option>
          <option>2학기</option>
          <option>여름방학</option>
          <option>겨울방학</option>
          <option>연중</option>
        </select>
        <input name="name" className={f.input} style={{ flex: 1, minWidth: 200 }} placeholder="프로젝트 이름" maxLength={40} aria-label="이름" required />
      </div>
      <textarea name="summary" className={f.textarea} rows={3} maxLength={300} placeholder="무엇을 함께 만들었는지 한두 문장" aria-label="설명" />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "만드는 중…" : "프로젝트 만들기"}
        </Button>
      </div>
    </form>
  );
}
