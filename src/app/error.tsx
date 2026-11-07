"use client";

import { Button, ButtonLink } from "@/components/ui";
import p from "@/components/page.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={`container ${p.page}`}>
      <div className={p.empty}>
        <p className="t-eyebrow">오류</p>
        <h1 className="t-h1">잠시 문제가 생겼어요</h1>
        <p>잠시 뒤 다시 시도해 주세요. 계속되면 운영진에게 알려 주세요.</p>
        <div className={p.emptyActions}>
          <Button onClick={reset}>다시 시도</Button>
          <ButtonLink href="/" variant="ghost">
            처음으로
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
