import { getWorksBySlugs } from "@/lib/content/queries";

// 즐겨찾기 목록용: 공개 작품만 반환한다.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("slugs") ?? "";
  const slugs = raw.split(",").map((s) => s.trim()).filter((s) => /^[\w-]{1,80}$/.test(s)).slice(0, 200);
  const works = await getWorksBySlugs(slugs);
  return Response.json({ works }, { headers: { "Cache-Control": "no-store" } });
}
