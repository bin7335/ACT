import "server-only";
import type { WorkFormValues } from "./form";
import { LINK_KINDS, type LinkKind } from "./types";

// 에이전트가 보내는 단순한 JSON을 화면 제출과 같은 폼 값으로 바꾼다.
const str = (value: unknown) => (typeof value === "string" ? value : "");
const joinList = (value: unknown) =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === "string").join(", ") : str(value);

export function linkKindFor(url: string): LinkKind {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) return "youtube";
    if (host === "apps.apple.com") return "store-ios";
    if (host === "play.google.com") return "store-android";
  } catch {
    // 주소 형식 오류는 validateWork가 알려 준다.
  }
  return "open";
}

export function valuesFromApi(memberName: string, body: Record<string, unknown>): WorkFormValues {
  const link = str(body.link) || str(body.url);
  const kind = LINK_KINDS.includes(linkKindFor(link)) ? linkKindFor(link) : "open";
  return {
    purpose: str(body.purpose),
    type: str(body.type),
    title: str(body.title),
    summary: str(body.summary),
    body: str(body.body),
    links: [{ kind, url: link }],
    audience: Array.isArray(body.audience) ? body.audience.filter((x): x is string => typeof x === "string") : [],
    subjects: joinList(body.subjects),
    makers: str(body.makers) || memberName,
    project: str(body.project),
    thumbnailAlt: str(body.thumbnailAlt),
    contactEmail: str(body.contactEmail),
  };
}
