import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashToken } from "@/lib/security";

// 회원별 API 토큰. 원문은 발급 응답에서 한 번만 보여 주고, 저장소에는 해시만 둔다.
const PREFIX = "act_";

export type IssuedToken = { id: string; name: string; token: string };

export function isTokenShape(value: string | null | undefined): value is string {
  return !!value && /^act_[A-Za-z0-9_-]{43}$/.test(value);
}

export function createApiToken(memberId: string, name: string): IssuedToken {
  const clean = name.trim().slice(0, 40) || "API 토큰";
  const token = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  const id = randomBytes(8).toString("hex");
  db.insert(schema.apiToken).values({ id, memberId, name: clean, tokenHash: hashToken(token) }).run();
  return { id, name: clean, token };
}

export function listApiTokens(memberId: string) {
  return db
    .select({ id: schema.apiToken.id, name: schema.apiToken.name, createdAt: schema.apiToken.createdAt, lastUsedAt: schema.apiToken.lastUsedAt })
    .from(schema.apiToken)
    .where(eq(schema.apiToken.memberId, memberId))
    .orderBy(desc(schema.apiToken.createdAt))
    .all();
}

/** 본인 토큰만 폐기할 수 있다. */
export function revokeApiToken(memberId: string, id: string) {
  return db.delete(schema.apiToken).where(and(eq(schema.apiToken.id, id), eq(schema.apiToken.memberId, memberId))).run().changes > 0;
}

/** Authorization 헤더 값을 회원으로 바꾼다. 사용 시각을 남긴다. */
export function memberForToken(raw: string | null | undefined) {
  if (!isTokenShape(raw)) return null;
  const hash = hashToken(raw);
  const row = db
    .select({ memberId: schema.member.id, name: schema.member.name, isAdmin: schema.member.isAdmin })
    .from(schema.apiToken)
    .innerJoin(schema.member, eq(schema.member.id, schema.apiToken.memberId))
    .where(eq(schema.apiToken.tokenHash, hash))
    .get();
  if (!row) return null;
  db.update(schema.apiToken).set({ lastUsedAt: new Date() }).where(eq(schema.apiToken.tokenHash, hash)).run();
  return row;
}
