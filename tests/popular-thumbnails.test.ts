import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { setupBindings, teardownBindings } from "./helpers/bindings";

before(setupBindings);
after(teardownBindings);

test("홈 썸네일은 공개 작품만, 썸네일이 있는 것만, 좋아요 많은 순으로 고른다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { selectPopularThumbnails } = await import("../src/lib/content/queries");

  // 작품이 없으면 빈 목록이다(홈은 추상 격자로 물러난다).
  assert.deepEqual(await selectPopularThumbnails(9), []);

  const day = (n: number) => new Date(Date.UTC(2026, 0, n));
  const work = (slug: string, extra: Partial<typeof schema.work.$inferInsert>) => ({
    slug,
    type: "web-app" as const,
    title: `제목 ${slug}`,
    summary: "요약",
    status: "published" as const,
    thumbnail: `/media/${slug}.webp`,
    publishedAt: day(1),
    ...extra,
  });
  // D1은 한 쿼리에 변수 100개까지만 받으므로 한 건씩 넣는다.
  for (const row of [
    work("old-two", { publishedAt: day(1), thumbnailAlt: "설명" }),
    work("new-two", { publishedAt: day(5) }),
    work("one", { publishedAt: day(3), contactEmail: "private@example.com" }),
    work("zero-new", { publishedAt: day(9) }),
    work("zero-old", { publishedAt: day(2) }),
    // 좋아요가 가장 많아도 썸네일이 없으면 빠진다.
    work("no-thumb", { thumbnail: null }),
    work("empty-thumb", { thumbnail: "" }),
    // 공개되지 않은 작품은 좋아요가 남아 있어도 나오지 않는다.
    work("in-review", { status: "review" }),
    work("hidden", { status: "hidden" }),
    work("draft", { status: "draft" }),
  ]) {
    await db.insert(schema.work).values(row).run();
  }
  const likes = (slug: string, count: number) => Array.from({ length: count }, (_, i) => ({ workSlug: slug, clientId: `${slug}-visitor-${i}` }));
  await db.insert(schema.workLike).values([
    ...likes("old-two", 2),
    ...likes("new-two", 2),
    ...likes("one", 1),
    ...likes("no-thumb", 9),
    ...likes("empty-thumb", 8),
    ...likes("in-review", 7),
    ...likes("hidden", 6),
    ...likes("draft", 5),
  ]).run();

  // 좋아요가 같으면 최신순(/works의 좋아요순과 같은 순서).
  const all = await selectPopularThumbnails(9);
  assert.deepEqual(all.map((w) => w.slug), ["new-two", "old-two", "one", "zero-new", "zero-old"]);
  // 화면에 필요한 네 필드만 내보낸다(연락처·좋아요 수·상태 등은 싣지 않는다).
  assert.deepEqual(all[1], { slug: "old-two", title: "제목 old-two", thumbnail: "/media/old-two.webp", thumbnailAlt: "설명" });
  assert.ok(all.every((w) => Object.keys(w).sort().join() === "slug,thumbnail,thumbnailAlt,title"));

  // 개수 제한은 정렬한 뒤에 건다.
  assert.deepEqual((await selectPopularThumbnails(3)).map((w) => w.slug), ["new-two", "old-two", "one"]);
});

test("공개 작품이 100개를 넘어도 한 번의 조회로 상위 썸네일을 정확히 고른다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { PAGE_SIZE, selectPopularThumbnails } = await import("../src/lib/content/queries");

  // D1의 변수 100개 제한과 목록 한 쪽(PAGE_SIZE)을 모두 넘는 수. 최신순으로는 맨 뒤(오래된 쪽)에 인기작을 둔다.
  const total = 130;
  assert.ok(total > 100 && total > PAGE_SIZE);
  const slug = (i: number) => `bulk-${String(i).padStart(3, "0")}`;
  for (let i = 0; i < total; i++) {
    await db.insert(schema.work).values({
      slug: slug(i),
      type: "web-app",
      title: `대량 ${i}`,
      summary: "요약",
      status: "published",
      // 오래된 쪽 절반은 썸네일이 없다. 인기작(0·1번)만 예외로 둔다.
      thumbnail: i >= 2 && i < 60 ? null : `/media/${slug(i)}.webp`,
      publishedAt: new Date(Date.UTC(2025, 0, 1 + i)),
    }).run();
  }
  const likes = (i: number, count: number) => Array.from({ length: count }, (_, n) => ({ workSlug: slug(i), clientId: `bulk-${i}-visitor-${n}` }));
  // 가장 오래된 두 작품이 가장 인기 있고, 썸네일 없는 작품(30번)이 그 사이에 낀다.
  await db.insert(schema.workLike).values([...likes(0, 12), ...likes(30, 11), ...likes(1, 10)]).run();

  const top = await selectPopularThumbnails(9);
  assert.equal(top.length, 9);
  // 최신순 첫 쪽에는 없던 오래된 인기작이 맨 앞에 오고, 썸네일 없는 30번은 빠진다.
  // 그 뒤는 앞 테스트의 좋아요 2·2·1개 작품, 나머지는 좋아요 0개 중 최신순이다.
  assert.deepEqual(top.map((w) => w.slug), ["bulk-000", "bulk-001", "new-two", "old-two", "one", "zero-new", "zero-old", "bulk-129", "bulk-128"]);
  assert.ok(top.every((w) => w.thumbnail.startsWith("/media/")));
});
