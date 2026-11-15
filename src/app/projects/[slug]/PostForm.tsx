"use client";

import { useActionState, useEffect, useRef } from "react";
import { createProjectPostAction } from "@/app/actions";
import { Button, Notice } from "@/components/ui";
import f from "@/components/form.module.css";

export function PostForm({ slug, titleMax, bodyMax }: { slug: string; titleMax: number; bodyMax: number }) {
  const [state, action, pending] = useActionState(createProjectPostAction, {});
  const ref = useRef<HTMLFormElement>(null);
  // 올린 뒤에는 입력 칸을 비운다.
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className={f.form} style={{ gap: 12, maxWidth: 720 }}>
      <input type="hidden" name="project" value={slug} />
      <h3 className="t-h3">글쓰기</h3>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">글을 올렸어요.</Notice>}
      <input name="title" className={f.input} placeholder="제목" maxLength={titleMax} aria-label="제목" required />
      <textarea name="body" className={f.textarea} rows={5} maxLength={bodyMax} placeholder="회의 기록, 진행 상황, 공유할 자료 링크 등을 자유롭게 적어 주세요." aria-label="내용" required />
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "올리는 중…" : "글 올리기"}
        </Button>
      </div>
    </form>
  );
}
