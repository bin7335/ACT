import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// next/headers는 요청 문맥에서만 쓸 수 있어 필요한 함수 안에서 가져온다(단위 테스트에서도 이 파일을 읽을 수 있게).

// 작품 반응 지표 — 조회수와 좋아요. 좋아요는 로그인 없이 쓰고, 브라우저마다 한 번만 센다.
const VISITOR_COOKIE = "act_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;

function isValidVisitor(value: string | undefined): value is string {
  return !!value && /^[A-Za-z0-9_-]{20,64}$/.test(value);
}

/** 공개 작품 조회수를 1 올린다. */
export function incrementView(slug: string) {
  db.update(schema.work)
    .set({ viewCount: sql`${schema.work.viewCount} + 1` })
    .where(and(eq(schema.work.slug, slug), eq(schema.work.status, "published")))
    .run();
}

/** 페이지를 실제로 연 요청만 센다. 링크 미리 불러오기(프리페치)는 제외한다. */
export async function recordView(slug: string) {
  const { headers } = await import("next/headers");
  const h = await headers();
  if (h.get("next-router-prefetch") || h.get("purpose") === "prefetch") return;
  // 서버 액션의 응답은 화면 갱신일 뿐 새 방문이 아니다(좋아요를 누를 때마다 조회수가 오르지 않게).
  if (h.get("next-action")) return;
  incrementView(slug);
}

export function likeCount(slug: string) {
  return db.select({ n: sql<number>`count(*)` }).from(schema.workLike).where(eq(schema.workLike.workSlug, slug)).get()?.n ?? 0;
}

export function isLiked(slug: string, clientId: string) {
  return !!db.select({ c: schema.workLike.clientId }).from(schema.workLike)
    .where(and(eq(schema.workLike.workSlug, slug), eq(schema.workLike.clientId, clientId))).get();
}

/** 작품별 좋아요 수. 목록 화면에서 한 번에 읽는다. */
export function likeCounts(slugs: string[]): Map<string, number> {
  if (!slugs.length) return new Map();
  const rows = db.select({ slug: schema.workLike.workSlug, n: sql<number>`count(*)` })
    .from(schema.workLike)
    .where(inArray(schema.workLike.workSlug, slugs))
    .groupBy(schema.workLike.workSlug)
    .all();
  return new Map(rows.map((r) => [r.slug, r.n]));
}

export function bookmarkCount(slug: string) {
  return db.select({ n: sql<number>`count(*)` }).from(schema.workBookmark).where(eq(schema.workBookmark.workSlug, slug)).get()?.n ?? 0;
}

export function isBookmarked(slug: string, clientId: string) {
  return !!db.select({ c: schema.workBookmark.clientId }).from(schema.workBookmark)
    .where(and(eq(schema.workBookmark.workSlug, slug), eq(schema.workBookmark.clientId, clientId))).get();
}

/** 작품별 북마크 수. 목록 화면에서 한 번에 읽는다. */
export function bookmarkCounts(slugs: string[]): Map<string, number> {
  if (!slugs.length) return new Map();
  const rows = db.select({ slug: schema.workBookmark.workSlug, n: sql<number>`count(*)` })
    .from(schema.workBookmark)
    .where(inArray(schema.workBookmark.workSlug, slugs))
    .groupBy(schema.workBookmark.workSlug)
    .all();
  return new Map(rows.map((r) => [r.slug, r.n]));
}

/** 북마크를 화면 상태에 맞춘다(이미 그 상태면 그대로). */
export function setBookmarkRow(slug: string, clientId: string, on: boolean) {
  const published = db.select({ s: schema.work.slug }).from(schema.work)
    .where(and(eq(schema.work.slug, slug), eq(schema.work.status, "published"))).get();
  if (!published) throw new Error("Published work not found");
  if (on) {
    db.insert(schema.workBookmark).values({ workSlug: slug, clientId }).onConflictDoNothing().run();
  } else {
    db.delete(schema.workBookmark).where(and(eq(schema.workBookmark.workSlug, slug), eq(schema.workBookmark.clientId, clientId))).run();
  }
  return on;
}

/** 목록에서 이 방문자의 좋아요·북마크 여부를 한 번에 읽는다. */
export async function visitReactions(slugs: string[]) {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const visitor = jar.get(VISITOR_COOKIE)?.value;
  if (!isValidVisitor(visitor) || !slugs.length) return { liked: new Set<string>(), bookmarked: new Set<string>() };
  const liked = db.select({ slug: schema.workLike.workSlug }).from(schema.workLike)
    .where(and(eq(schema.workLike.clientId, visitor), inArray(schema.workLike.workSlug, slugs))).all();
  const bookmarked = db.select({ slug: schema.workBookmark.workSlug }).from(schema.workBookmark)
    .where(and(eq(schema.workBookmark.clientId, visitor), inArray(schema.workBookmark.workSlug, slugs))).all();
  return { liked: new Set(liked.map((r) => r.slug)), bookmarked: new Set(bookmarked.map((r) => r.slug)) };
}

/** 카드 목록에 넘길 좋아요·북마크 표시(직렬화 가능한 배열). */
export async function reactionProps(slugs: string[]) {
  const reactions = await visitReactions(slugs);
  return { liked: [...reactions.liked], bookmarked: [...reactions.bookmarked] };
}

/** 좋아요를 켜고 끈다. 켜졌으면 true. */
export function toggleLikeRow(slug: string, clientId: string) {
  const published = db.select({ s: schema.work.slug }).from(schema.work)
    .where(and(eq(schema.work.slug, slug), eq(schema.work.status, "published"))).get();
  if (!published) throw new Error("Published work not found");
  if (isLiked(slug, clientId)) {
    db.delete(schema.workLike).where(and(eq(schema.workLike.workSlug, slug), eq(schema.workLike.clientId, clientId))).run();
    return false;
  }
  db.insert(schema.workLike).values({ workSlug: slug, clientId }).onConflictDoNothing().run();
  return true;
}

/** 이 브라우저의 방문자 ID. 없으면 발급한다(Server Action에서만 호출). */
export async function visitorId() {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (isValidVisitor(existing)) return existing;
  const id = randomBytes(24).toString("base64url");
  jar.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_MAX_AGE,
  });
  return id;
}

/** 현재 방문자의 좋아요 상태와 전체 개수. */
export async function likeState(slug: string) {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const visitor = jar.get(VISITOR_COOKIE)?.value;
  return { liked: isValidVisitor(visitor) ? isLiked(slug, visitor) : false, count: likeCount(slug) };
}
