import "server-only";
import { asc, eq, or, sql } from "drizzle-orm";
import { db, schema } from "./db";

export type MemberRow = { id: string; name: string; username: string | null; email: string | null; isAdmin: boolean };

const columns = { id: schema.member.id, name: schema.member.name, username: schema.member.username, email: schema.googleIdentity.email, isAdmin: schema.member.isAdmin };

// 이름·아이디·Google 이메일 일부로 회원을 찾는다. 검색어가 없으면 현재 운영진을 보여 준다.
export function searchMembers(query: string): MemberRow[] {
  const q = query.trim().toLowerCase().slice(0, 60);
  const base = db.select(columns).from(schema.member).leftJoin(schema.googleIdentity, eq(schema.googleIdentity.memberId, schema.member.id));
  if (!q) return base.where(eq(schema.member.isAdmin, true)).orderBy(asc(schema.member.name)).all();
  const pattern = `%${q.replace(/[!%_]/g, c => `!${c}`)}%`;
  const match = (col: typeof schema.member.name | typeof schema.member.username | typeof schema.googleIdentity.email) => sql`lower(${col}) like ${pattern} escape '!'`;
  return base.where(or(match(schema.member.name), match(schema.member.username), match(schema.googleIdentity.email))).orderBy(asc(schema.member.name)).limit(30).all();
}

export function setMemberAdmin(id: string, isAdmin: boolean) {
  return db.update(schema.member).set({ isAdmin }).where(eq(schema.member.id, id)).returning({ id: schema.member.id }).get();
}
