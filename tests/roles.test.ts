import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "act-roles-test-"));

test("역할은 관리자·연구회회원·일반회원 중 하나로 정해진다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { setMemberAdmin, setMemberRole } = await import("../src/lib/members");
  const { roleOf, isRole } = await import("../src/lib/roles");
  db.insert(schema.member).values({ id: "m1", name: "김교사" }).run();
  const read = () => db.select().from(schema.member).where(eq(schema.member.id, "m1")).get()!;

  assert.equal(roleOf(read()), "member");
  assert.ok(setMemberRole("m1", "research"));
  assert.equal(roleOf(read()), "research");
  assert.ok(setMemberRole("m1", "admin"));
  assert.deepEqual([read().isAdmin, read().isResearch], [true, false]);
  assert.ok(setMemberRole("m1", "member"));
  assert.equal(roleOf(read()), "member");

  // 운영진 권한만 켜고 끄는 예전 경로는 연구회회원 표시를 건드리지 않는다.
  setMemberRole("m1", "research");
  setMemberAdmin("m1", true);
  assert.equal(roleOf(read()), "admin");
  setMemberAdmin("m1", false);
  assert.equal(roleOf(read()), "research");

  assert.equal(setMemberRole("nobody", "admin"), undefined);
  assert.equal(isRole("research"), true);
  assert.equal(isRole("owner"), false);
});

test("프로젝트 게시글은 글쓴이나 관리자만 지운다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { createProjectPost, deleteProjectPost, listProjectPosts } = await import("../src/lib/content/posts");
  db.insert(schema.member).values([{ id: "a", name: "글쓴이" }, { id: "b", name: "다른 회원" }]).run();
  db.insert(schema.project).values({ slug: "p1", year: 2026, term: "2학기", name: "프로젝트", summary: "" }).run();

  assert.ok("error" in createProjectPost({ projectSlug: "p1", authorId: "a", authorName: "글쓴이", title: " ", body: "내용" }));
  assert.ok("error" in createProjectPost({ projectSlug: "p1", authorId: "a", authorName: "글쓴이", title: "제목", body: "" }));
  assert.ok("error" in createProjectPost({ projectSlug: "none", authorId: "a", authorName: "글쓴이", title: "제목", body: "내용" }));

  const first = createProjectPost({ projectSlug: "p1", authorId: "a", authorName: "글쓴이", title: "첫 글", body: "내용" });
  const second = createProjectPost({ projectSlug: "p1", authorId: null, authorName: "", title: "운영진 글", body: "내용" });
  if (!("id" in first) || !("id" in second)) throw new Error("게시글을 만들지 못했다");
  assert.equal(listProjectPosts("p1").length, 2);
  assert.equal(listProjectPosts("p1").find((x) => x.id === second.id)?.authorName, "운영진");

  assert.equal(deleteProjectPost(first.id, { memberId: "b", admin: false }), null);
  assert.equal(deleteProjectPost(second.id, { memberId: null, admin: false }), null);
  assert.equal(listProjectPosts("p1").length, 2);
  assert.equal(deleteProjectPost(first.id, { memberId: "a", admin: false }), "p1");
  assert.equal(deleteProjectPost(second.id, { memberId: "b", admin: true }), "p1");
  assert.equal(listProjectPosts("p1").length, 0);

  // 프로젝트를 지우면 글도 함께 지워진다.
  createProjectPost({ projectSlug: "p1", authorId: "a", authorName: "글쓴이", title: "남은 글", body: "내용" });
  db.delete(schema.project).where(eq(schema.project.slug, "p1")).run();
  assert.equal(listProjectPosts("p1").length, 0);
});
