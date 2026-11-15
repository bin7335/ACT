import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { setupBindings, teardownBindings } from "./helpers/bindings";
import { eq } from "drizzle-orm";

before(setupBindings);
after(teardownBindings);

test("역할은 관리자·연구회회원·일반회원 중 하나로 정해진다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { setMemberAdmin, setMemberRole } = await import("../src/lib/members");
  const { roleOf, isRole } = await import("../src/lib/roles");
  await db.insert(schema.member).values({ id: "m1", name: "김교사" }).run();
  const read = async () => (await db.select().from(schema.member).where(eq(schema.member.id, "m1")).get())!;

  assert.equal(roleOf(await read()), "member");
  assert.ok(await setMemberRole("m1", "research"));
  assert.equal(roleOf(await read()), "research");
  assert.ok(await setMemberRole("m1", "admin"));
  const admin = await read();
  assert.deepEqual([admin.isAdmin, admin.isResearch], [true, false]);
  assert.ok(await setMemberRole("m1", "member"));
  assert.equal(roleOf(await read()), "member");

  // 운영진 권한만 켜고 끄는 예전 경로는 연구회회원 표시를 건드리지 않는다.
  await setMemberRole("m1", "research");
  await setMemberAdmin("m1", true);
  assert.equal(roleOf(await read()), "admin");
  await setMemberAdmin("m1", false);
  assert.equal(roleOf(await read()), "research");

  assert.equal(await setMemberRole("nobody", "admin"), undefined);
  assert.equal(isRole("research"), true);
  assert.equal(isRole("owner"), false);
});

test("프로젝트 게시글은 글쓴이나 관리자만 지운다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { createProjectPost, deleteProjectPost, listProjectPosts } = await import("../src/lib/content/posts");
  await db.insert(schema.member).values([{ id: "a", name: "글쓴이" }, { id: "b", name: "다른 회원" }]).run();
  await db.insert(schema.project).values({ slug: "p1", year: 2026, term: "2학기", name: "프로젝트", summary: "" }).run();

  assert.ok("error" in (await createProjectPost({ projectSlug: "p1", authorId: "a", authorName: "글쓴이", title: " ", body: "내용" })));
  assert.ok("error" in (await createProjectPost({ projectSlug: "p1", authorId: "a", authorName: "글쓴이", title: "제목", body: "" })));
  assert.ok("error" in (await createProjectPost({ projectSlug: "none", authorId: "a", authorName: "글쓴이", title: "제목", body: "내용" })));

  const first = await createProjectPost({ projectSlug: "p1", authorId: "a", authorName: "글쓴이", title: "첫 글", body: "내용" });
  const second = await createProjectPost({ projectSlug: "p1", authorId: null, authorName: "", title: "운영진 글", body: "내용" });
  if (!("id" in first) || !("id" in second)) throw new Error("게시글을 만들지 못했다");
  assert.equal((await listProjectPosts("p1")).length, 2);
  assert.equal((await listProjectPosts("p1")).find((x) => x.id === second.id)?.authorName, "운영진");

  assert.equal(await deleteProjectPost(first.id, { memberId: "b", admin: false }), null);
  assert.equal(await deleteProjectPost(second.id, { memberId: null, admin: false }), null);
  assert.equal((await listProjectPosts("p1")).length, 2);
  assert.equal(await deleteProjectPost(first.id, { memberId: "a", admin: false }), "p1");
  assert.equal(await deleteProjectPost(second.id, { memberId: "b", admin: true }), "p1");
  assert.equal((await listProjectPosts("p1")).length, 0);

  // 프로젝트를 지우면 글도 함께 지워진다.
  await createProjectPost({ projectSlug: "p1", authorId: "a", authorName: "글쓴이", title: "남은 글", body: "내용" });
  await db.delete(schema.project).where(eq(schema.project.slug, "p1")).run();
  assert.equal((await listProjectPosts("p1")).length, 0);
});
