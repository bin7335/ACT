import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// 공개 작품의 바로가기 링크를 점검한다(원칙 6). 운영진 화면 버튼이나 VM cron(npm run check-links)으로 실행.
// 봇 차단(401/403/429)은 "열리지 않음"으로 보지 않는다. 연결 실패·404·410·5xx만 끊김으로 표시.

const TIMEOUT_MS = 8000;

async function probe(url: string): Promise<boolean> {
  const attempt = async (method: "HEAD" | "GET") => {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "ACT-LinkCheck/1.0 (+teacher archive)" },
    });
    await res.body?.cancel();
    return res.status;
  };
  try {
    let status = await attempt("HEAD");
    if (status === 405 || status === 501) status = await attempt("GET");
    return !(status === 404 || status === 410 || status >= 500);
  } catch {
    return false;
  }
}

export async function checkLinks() {
  const works = db.select({ slug: schema.work.slug, links: schema.work.links }).from(schema.work).where(eq(schema.work.status, "published")).all();
  let broken = 0;
  const queue = [...works];
  const worker = async () => {
    for (let w = queue.shift(); w; w = queue.shift()) {
      const results = await Promise.all(w.links.map((l) => probe(l.url)));
      // 대표 링크(첫 번째)가 열리지 않으면 끊김으로 표시한다.
      const isBroken = results.length > 0 && !results[0];
      if (isBroken) broken++;
      db.update(schema.work).set({ linkBroken: isBroken, linkCheckedAt: new Date() }).where(eq(schema.work.slug, w.slug)).run();
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { checked: works.length, broken };
}
