import type { ReactNode } from "react";
import s from "./SectionHeader.module.css";

/** Figma "Section Header" — 모노 라벨 + 제목 + 1px 잉크 하단선 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  as: Tag = "h1",
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <header className={s.header}>
      <div className={s.titles}>
        <p className="t-eyebrow">{eyebrow}</p>
        <Tag className={Tag === "h1" ? "t-h1" : "t-h2"}>{title}</Tag>
        {description && <p className={s.desc}>{description}</p>}
      </div>
      {action && <div className={s.action}>{action}</div>}
    </header>
  );
}
