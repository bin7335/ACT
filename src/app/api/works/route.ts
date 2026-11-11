import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { memberForToken } from "@/lib/api-tokens";
import { valuesFromApi } from "@/lib/content/api-work";
import { fillMissingThumbnail } from "@/lib/content/auto-thumbnail";
import { validateWork } from "@/lib/content/form";
import { createMemberWork } from "@/lib/content/submission";
import { getWorksBySlugs } from "@/lib/content/queries";
import { rateLimit } from "@/lib/security";

// 즐겨찾기 목록용: 공개 작품만 반환한다.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("slugs") ?? "";
  const slugs = raw.split(",").map((s) => s.trim()).filter((s) => /^[\w-]{1,80}$/.test(s)).slice(0, 200);
  const works = await getWorksBySlugs(slugs);
  return Response.json({ works }, { headers: { "Cache-Control": "no-store" } });
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

function fail(error: string, status: number, fields?: Record<string, string>) {
  return Response.json({ error, ...(fields ? { fields } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

/** 에이전트용 작품 등록 — 회원 API 토큰으로 인증한다. */
export async function POST(request: Request) {
  const member = memberForToken(bearer(request));
  if (!member) return fail("유효하지 않은 API 토큰이에요. Authorization: Bearer <토큰> 헤더를 확인해 주세요.", 401);
  if (!rateLimit(`api-work:${member.memberId}`, 30, 60 * 60 * 1000)) return fail("짧은 시간에 너무 많이 등록했어요. 잠시 뒤 다시 시도해 주세요.", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("JSON 본문을 읽지 못했어요.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("JSON 객체를 보내 주세요.", 400);

  const values = valuesFromApi(member.name, body as Record<string, unknown>);
  // 연구회 프로젝트에는 관리자와 연구회회원만 작품을 연결한다.
  if (!member.isAdmin && !member.isResearch) values.project = "";
  const parsed = validateWork(values);
  if ("errors" in parsed) return fail("입력값을 확인해 주세요.", 400, parsed.errors);

  const slug = await createMemberWork(parsed.data, { thumbnail: null, ownerId: member.memberId });
  after(() => fillMissingThumbnail(slug));
  revalidatePath("/");
  revalidatePath("/works");
  revalidatePath("/admin");
  const status = member.isAdmin ? "published" : "review";
  return Response.json(
    { slug, status, url: `/works/${slug}`, message: status === "published" ? "작품을 바로 공개했어요." : "검수 대기로 등록했어요. 운영진 확인 뒤 공개됩니다." },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
