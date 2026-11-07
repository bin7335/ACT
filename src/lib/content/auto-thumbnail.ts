import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { fetchLinkImage } from "@/lib/remote-image";
import { deleteThumbnail, saveThumbnailBytes } from "@/lib/uploads";

/**
 * 썸네일이 없는 작품에 대표 링크의 og:image(YouTube는 영상 썸네일)를 채운다.
 * 그사이 사용자가 이미지를 올렸으면 덮어쓰지 않는다. 실패하면 기본 썸네일로 둔다.
 */
export async function fillMissingThumbnail(slug: string): Promise<boolean> {
  const work = db.select({ thumbnail: schema.work.thumbnail, links: schema.work.links }).from(schema.work).where(eq(schema.work.slug, slug)).get();
  const link = work?.links[0]?.url;
  if (!work || work.thumbnail || !link) return false;
  let bytes: Buffer | null;
  try {
    bytes = await fetchLinkImage(link);
  } catch {
    return false;
  }
  if (!bytes) return false;
  let saved: string;
  try {
    saved = await saveThumbnailBytes(bytes);
  } catch {
    return false;
  }
  const updated = db.update(schema.work).set({ thumbnail: saved }).where(and(eq(schema.work.slug, slug), isNull(schema.work.thumbnail))).returning({ slug: schema.work.slug }).get();
  if (!updated) await deleteThumbnail(saved);
  return !!updated;
}
