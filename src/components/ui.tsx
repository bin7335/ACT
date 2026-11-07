import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { WORK_PURPOSE_LABEL, WORK_STATUS_LABEL, WORK_TYPE_LABEL, type WorkPurpose, type WorkStatus, type WorkType } from "@/lib/content/types";
import s from "./ui.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function buttonClass(variant: Variant = "secondary", size: Size = "md", block = false) {
  return cx(s.button, variant !== "secondary" && s[variant], size === "sm" && s.sm, block && s.block);
}

export function Button({ variant, size, block, className, ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <button className={cx(buttonClass(variant, size, block), className)} {...rest} />;
}

export function ButtonLink({ variant, size, block, className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <Link className={cx(buttonClass(variant, size, block), className)} {...rest} />;
}

export function ExternalButton({ variant, size, block, className, children, ...rest }: ComponentProps<"a"> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <a className={cx(buttonClass(variant, size, block), className)} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
      <span aria-hidden>↗</span>
      <span className="visually-hidden">(새 창)</span>
    </a>
  );
}

export function Chip({ href, label, count, selected }: { href: string; label: string; count?: number; selected?: boolean }) {
  return (
    <Link href={href} className={s.chip} aria-current={selected ? "true" : undefined} data-empty={count === 0 && !selected ? "true" : undefined} scroll={false}>
      {label}
      {count !== undefined && <span className={s.chipCount}>{count}</span>}
    </Link>
  );
}

export function TypeBadge({ purpose, type }: { purpose: WorkPurpose; type: WorkType }) {
  return (
    <span className={s.badge} data-purpose={purpose}>
      {WORK_PURPOSE_LABEL[purpose]} · {WORK_TYPE_LABEL[type]}
    </span>
  );
}

export function StatusLabel({ status }: { status: WorkStatus }) {
  return (
    <span className={s.status} data-status={status}>
      {WORK_STATUS_LABEL[status]}
    </span>
  );
}

export function Notice({ tone, children }: { tone?: "danger" | "success"; children: ReactNode }) {
  return (
    <div className={s.notice} data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <div>{children}</div>
    </div>
  );
}
