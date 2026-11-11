import "server-only";
import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// 연구회 프로젝트 게시글. 누가 쓰고 볼 수 있는지는 호출하는 쪽(projectAccess)에서 먼저 확인한다.

export const POST_TITLE_MAX = 60;
export const POST_BODY_MAX = 5000;

export type ProjectPost = { id: string; projectSlug: string; authorId: string | null; authorName: string; title: string; body: string; createdAt: Date };

export function listProjectPosts(projectSlug: string): ProjectPost[] {
  return db.select().from(schema.projectPost).where(eq(schema.projectPost.projectSlug, projectSlug))
    .orderBy(desc(schema.projectPost.createdAt)).all();
}

export function createProjectPost(input: { projectSlug: string; authorId: string | null; authorName: string; title: string; body: string }): { error: string } | { id: string } {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > POST_TITLE_MAX) return { error: `제목을 ${POST_TITLE_MAX}자 이내로 써 주세요.` };
  if (!body || body.length > POST_BODY_MAX) return { error: `내용을 ${POST_BODY_MAX}자 이내로 써 주세요.` };
  const project = db.select({ s: schema.project.slug }).from(schema.project).where(eq(schema.project.slug, input.projectSlug)).get();
  if (!project) return { error: "프로젝트를 찾지 못했어요." };
  const id = randomBytes(9).toString("base64url");
  db.insert(schema.projectPost).values({ id, projectSlug: project.s, authorId: input.authorId, authorName: input.authorName.trim().slice(0, 30) || "운영진", title, body }).run();
  return { id };
}

/** 글쓴이 본인이나 관리자만 지운다. 지웠으면 그 글의 프로젝트 slug를 돌려준다. */
export function deleteProjectPost(id: string, by: { memberId: string | null; admin: boolean }) {
  const post = db.select().from(schema.projectPost).where(eq(schema.projectPost.id, id)).get();
  if (!post) return null;
  if (!by.admin && (!by.memberId || post.authorId !== by.memberId)) return null;
  db.delete(schema.projectPost).where(eq(schema.projectPost.id, id)).run();
  return post.projectSlug;
}
