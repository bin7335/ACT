import "server-only";
import { asc, desc, eq, or, sql } from "drizzle-orm";
import { db, schema } from "./db";
import type { Role } from "./roles";

export type MemberRow = { id: string; name: string; username: string | null; email: string | null; isAdmin: boolean; isResearch: boolean };

const columns = { id: schema.member.id, name: schema.member.name, username: schema.member.username, email: schema.googleIdentity.email, isAdmin: schema.member.isAdmin, isResearch: schema.member.isResearch };

// 계정 설정은 현재 운영진, 관리자 화면은 최근 가입 회원 30명을 기본으로 보여 준다.
export async function searchMembers(query: string, scope: "admins" | "all" = "admins"): Promise<MemberRow[]> {
  const q = query.trim().toLowerCase().slice(0, 60);
  const base = db.select(columns).from(schema.member).leftJoin(schema.googleIdentity, eq(schema.googleIdentity.memberId, schema.member.id));
  if (!q) return scope === "all"
    ? base.orderBy(desc(schema.member.createdAt), asc(schema.member.id)).limit(30).all()
    : base.where(eq(schema.member.isAdmin, true)).orderBy(asc(schema.member.name)).all();
  const pattern = `%${q.replace(/[!%_]/g, c => `!${c}`)}%`;
  const match = (col: typeof schema.member.name | typeof schema.member.username | typeof schema.googleIdentity.email) => sql`lower(${col}) like ${pattern} escape '!'`;
  return base.where(or(match(schema.member.name), match(schema.member.username), match(schema.googleIdentity.email))).orderBy(asc(schema.member.name)).limit(30).all();
}

/** 관리자 화면용: 가입자 전체를 10명씩 보여 준다(최근 가입 먼저). */
export async function listMembers(page: number, perPage = 10) {
  const total = (await db.select({ n: sql<number>`count(*)` }).from(schema.member).get())?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const items = await db.select(columns).from(schema.member).leftJoin(schema.googleIdentity, eq(schema.googleIdentity.memberId, schema.member.id))
    .orderBy(desc(schema.member.createdAt), asc(schema.member.id))
    .limit(perPage).offset((current - 1) * perPage).all();
  return { items, total, page: current, pageCount };
}

/** 운영진 권한만 켜고 끈다(연구회회원 여부는 그대로 둔다). */
export async function setMemberAdmin(id: string, isAdmin: boolean) {
  return db.update(schema.member).set({ isAdmin }).where(eq(schema.member.id, id)).returning({ id: schema.member.id }).get();
}

/** 역할을 하나로 정한다. 관리자는 연구회 프로젝트 권한을 포함하므로 연구회 표시는 지운다. */
export async function setMemberRole(id: string, role: Role) {
  return db.update(schema.member).set({ isAdmin: role === "admin", isResearch: role === "research" })
    .where(eq(schema.member.id, id)).returning({ id: schema.member.id }).get();
}
