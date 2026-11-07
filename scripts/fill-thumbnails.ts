// 썸네일이 없는 기존 작품에 작품 링크의 대표 이미지를 채운다. 여러 번 실행해도 안전하다.
// 사용: npm run fill-thumbnails   (DATA_DIR 환경변수로 DB 위치 지정)
import { isNull } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { fillMissingThumbnail } from "../src/lib/content/auto-thumbnail";

async function main() {
  const works = db.select({ slug: schema.work.slug }).from(schema.work).where(isNull(schema.work.thumbnail)).all();
  let filled = 0;
  for (const { slug } of works) {
    const ok = await fillMissingThumbnail(slug);
    if (ok) filled++;
    console.log(`[fill-thumbnails] ${slug}: ${ok ? "filled" : "skipped"}`);
  }
  console.log(`[fill-thumbnails] missing=${works.length} filled=${filled}`);
}

main().then(() => process.exit(0), (e) => {
  console.error("[fill-thumbnails] failed", e);
  process.exit(1);
});
