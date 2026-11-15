import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { setupBindings, teardownBindings } from "./helpers/bindings";
import { eq } from "drizzle-orm";

before(setupBindings);
after(teardownBindings);

const input = {
  purpose: "class" as const, type: "web-app" as const,
  title: "권한별 등록 테스트", summary: "회원 권한에 따른 공개 상태를 확인합니다.",
  body: "", links: [{ kind: "open" as const, url: "https://example.test/" }],
  makers: ["테스트 제작자"], audience: [], subjects: [], project: "", thumbnailAlt: "", contactEmail: "",
};

test("운영진 제출만 즉시 공개하며 일반 회원·권한 해제 회원은 검수 대기", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { createMemberWork } = await import("../src/lib/content/submission");
  const { setMemberAdmin } = await import("../src/lib/members");
  await db.insert(schema.member).values([
    { id: "admin", name: "운영진", isAdmin: true },
    { id: "ordinary", name: "일반 회원", isAdmin: false },
  ]).run();
  const submit = (ownerId: string) => createMemberWork(input, { ownerId, thumbnail: null });
  const get = async (slug: string) => (await db.select().from(schema.work).where(eq(schema.work.slug, slug)).get())!;
  const published = await get(await submit("admin"));
  assert.equal(published.status, "published");
  assert.ok(published.publishedAt instanceof Date);
  assert.equal(published.ownerId, "admin");
  const pending = await get(await submit("ordinary"));
  assert.equal(pending.status, "review");
  assert.equal(pending.publishedAt, null);
  await setMemberAdmin("admin", false);
  assert.equal((await get(await submit("admin"))).status, "review");
  await setMemberAdmin("ordinary", true);
  assert.equal((await get(await submit("ordinary"))).status, "published");
  // 알 수 없는 계정으로 작품을 만들 수 없으며, 폼에 실린 공개 상태도 무시한다.
  await assert.rejects(submit("missing"));
  await setMemberAdmin("ordinary", false);
  const forged = await get(await createMemberWork({ ...input, status: "published" } as typeof input, { ownerId: "ordinary", thumbnail: null }));
  assert.equal(forged.status, "review");
});

test("가입자 목록은 10명씩 페이지로 나뉘고 범위를 벗어난 페이지는 마지막으로 맞춘다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { listMembers } = await import("../src/lib/members");
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: `paged-${i}`, name: `회원 ${String(i).padStart(2, "0")}` }));
  await db.insert(schema.member).values(rows).run();
  const first = await listMembers(1);
  assert.equal(first.items.length, 10);
  assert.equal(first.total >= 23, true);
  assert.equal(first.pageCount, Math.ceil(first.total / 10));
  assert.equal((await listMembers(99)).page, first.pageCount);
  assert.equal((await listMembers(99)).items.length, first.total - (first.pageCount - 1) * 10);
  assert.equal((await listMembers(Number.NaN)).page, 1);
});

test("관리자 회원 목록은 일반 회원도 표시하고 이름·아이디·이메일로 검색", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { searchMembers } = await import("../src/lib/members");
  await db.insert(schema.member).values({ id: "searchable", name: "검색할 회원_%", username: "search_member" }).run();
  await db.insert(schema.googleIdentity).values({ subject: "search-google", memberId: "searchable", email: "search@example.test" }).run();
  assert.ok((await searchMembers("", "all")).some(m => m.id === "searchable" && !m.isAdmin));
  assert.ok(!(await searchMembers("")).some(m => m.id === "searchable"));
  for (const q of ["검색할", "search_member", "SEARCH@example", "_%"]) {
    assert.ok((await searchMembers(q, "all")).some(m => m.id === "searchable"));
  }
});
