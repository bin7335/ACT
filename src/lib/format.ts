const kst = { timeZone: "Asia/Seoul" } as const;

export function formatMonth(d: Date) {
  const p = new Intl.DateTimeFormat("ko-KR", { ...kst, year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year")?.value}.${p.find((x) => x.type === "month")?.value}`;
}

export function formatDate(d: Date) {
  const p = new Intl.DateTimeFormat("ko-KR", { ...kst, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value;
  return `${v("year")}.${v("month")}.${v("day")}`;
}

/** 쿼리스트링을 바꿔 새 href를 만든다. 값이 undefined면 키를 지운다. page는 필터가 바뀌면 초기화. */
export function withParams(base: string, current: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const next = { ...current, ...patch };
  if (!("page" in patch)) delete next.page;
  const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1])).toString();
  return qs ? `${base}?${qs}` : base;
}
