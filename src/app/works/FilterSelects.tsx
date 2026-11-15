"use client";

import { useRouter } from "next/navigation";
import p from "@/components/page.module.css";

type Filter = { name: string; label: string; all: string; value?: string; options: { value: string; label: string; count?: number }[] };

/** 소분류 필터. 고르면 바로 이동하고, JS가 없으면 「적용」 버튼으로 보낸다. */
export function FilterSelects({ filters, keep }: { filters: Filter[]; keep: Record<string, string | undefined> }) {
  const router = useRouter();

  function go(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v) params.set(k, v);
    const qs = params.toString();
    router.push(qs ? `/works?${qs}` : "/works", { scroll: false });
  }

  return (
    <form action="/works" className={p.selects} onChange={(ev) => go(ev.currentTarget)} onSubmit={(ev) => (ev.preventDefault(), go(ev.currentTarget))}>
      {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      {filters.map((f) => (
        <label key={f.name} className={p.selectField}>
          <span className={p.selectLabel}>{f.label}</span>
          <select name={f.name} defaultValue={f.value ?? ""} key={f.value ?? ""} className={p.select} data-active={f.value ? "true" : undefined}>
            <option value="">{f.all}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.count === 0 && o.value !== f.value}>
                {o.label}
                {o.count !== undefined ? ` (${o.count})` : ""}
              </option>
            ))}
          </select>
        </label>
      ))}
      <noscript>
        <button className={p.searchBtn}>적용</button>
      </noscript>
    </form>
  );
}
