import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { setupBindings, teardownBindings } from "./helpers/bindings";
import { textList } from "../src/lib/db/text-list";

before(setupBindings);
after(teardownBindings);

test("D1 문자열 목록은 100개를 넘어도 단일 변수로 바인딩하며 모든 항목을 집계한다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { likeCounts, bookmarkCounts } = await import("../src/lib/content/stats");
  const slugs = Array.from({ length: 205 }, (_, i) => `many-${i}`);
  for (let start = 0; start < slugs.length; start += 5) {
    await db.insert(schema.work).values(slugs.slice(start, start + 5).map(slug => ({
      slug, type: "web-app" as const, title: slug, summary: "많은 작품", status: "published" as const,
    }))).run();
  }
  const marked = [slugs[0], slugs[99], slugs[100], slugs[204]];
  for (const slug of marked) {
    await db.insert(schema.workLike).values({ workSlug: slug, clientId: "visitor" }).run();
    await db.insert(schema.workBookmark).values({ workSlug: slug, clientId: "visitor" }).run();
  }
  const query = db.select({ slug: schema.work.slug }).from(schema.work)
    .where(and(inArray(schema.work.slug, textList(slugs)), eq(schema.work.status, "published")));
  assert.equal(query.toSQL().params.length, 2);
  assert.equal((await query.all()).length, 205);
  const [likes, bookmarks] = await Promise.all([likeCounts(slugs), bookmarkCounts(slugs)]);
  for (const slug of marked) {
    assert.equal(likes.get(slug), 1);
    assert.equal(bookmarks.get(slug), 1);
  }
  assert.equal(likes.get(slugs[1]), undefined);
  assert.deepEqual(await likeCounts([]), new Map());
  // 사용자 문자열을 SQL에 직접 끼우지 않아 따옴표가 포함돼도 조건이 바뀌지 않는다.
  const escaped = await db.select({ slug: schema.work.slug }).from(schema.work)
    .where(inArray(schema.work.slug, textList(["' OR 1=1 --", slugs[204]]))).all();
  assert.deepEqual(escaped.map(row => row.slug), [slugs[204]]);
});
