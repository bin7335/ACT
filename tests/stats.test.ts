import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "act-stats-test-"));

test("공개 작품만 조회수가 오르고, 좋아요는 브라우저당 한 번만 센다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { incrementView, isLiked, likeCount, likeCounts, toggleLikeRow } = await import("../src/lib/content/stats");
  db.insert(schema.work).values([
    { slug: "live", type: "web-app", title: "공개 작품", summary: "공개", status: "published" },
    { slug: "waiting", type: "web-app", title: "검수 대기", summary: "대기", status: "review" },
  ]).run();
  const views = (slug: string) => db.select().from(schema.work).where(eq(schema.work.slug, slug)).get()?.viewCount;

  incrementView("live");
  incrementView("live");
  incrementView("waiting");
  assert.equal(views("live"), 2);
  assert.equal(views("waiting"), 0);

  assert.equal(likeCount("live"), 0);
  assert.equal(toggleLikeRow("live", "browser-a"), true);
  assert.equal(isLiked("live", "browser-a"), true);
  assert.equal(likeCount("live"), 1);
  // 같은 브라우저에서 다시 누르면 취소된다.
  assert.equal(toggleLikeRow("live", "browser-a"), false);
  assert.equal(likeCount("live"), 0);
  toggleLikeRow("live", "browser-a");
  toggleLikeRow("live", "browser-b");
  assert.equal(likeCount("live"), 2);
  assert.equal(likeCounts(["live", "waiting"]).get("live"), 2);
  assert.equal(likeCounts(["live", "waiting"]).get("waiting"), undefined);
  // 공개되지 않은 작품에는 좋아요를 남길 수 없다.
  assert.throws(() => toggleLikeRow("waiting", "browser-a"));
  // 작품을 지우면 좋아요도 함께 사라진다.
  db.delete(schema.work).where(eq(schema.work.slug, "live")).run();
  assert.equal(db.select().from(schema.workLike).all().length, 0);
});

test("북마크 수는 브라우저별로 한 번만 세고, 화면 상태에 맞춰 켜고 끈다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { bookmarkCount, bookmarkCounts, isBookmarked, setBookmarkRow } = await import("../src/lib/content/stats");
  db.insert(schema.work).values([
    { slug: "mark-live", type: "web-app", title: "공개 작품", summary: "공개", status: "published" },
    { slug: "mark-waiting", type: "web-app", title: "검수 대기", summary: "대기", status: "review" },
  ]).run();

  assert.equal(bookmarkCount("mark-live"), 0);
  assert.equal(setBookmarkRow("mark-live", "browser-a", true), true);
  // 같은 브라우저가 다시 켜도 중복되지 않는다.
  setBookmarkRow("mark-live", "browser-a", true);
  assert.equal(isBookmarked("mark-live", "browser-a"), true);
  assert.equal(bookmarkCount("mark-live"), 1);
  setBookmarkRow("mark-live", "browser-b", true);
  assert.equal(bookmarkCounts(["mark-live"]).get("mark-live"), 2);
  setBookmarkRow("mark-live", "browser-a", false);
  assert.equal(bookmarkCounts(["mark-live"]).get("mark-live"), 1);
  assert.equal(bookmarkCounts(["mark-waiting"]).get("mark-waiting"), undefined);
  assert.throws(() => setBookmarkRow("mark-waiting", "browser-a", true));
  db.delete(schema.work).where(eq(schema.work.slug, "mark-live")).run();
  assert.equal(db.select().from(schema.workBookmark).all().length, 0);
});
