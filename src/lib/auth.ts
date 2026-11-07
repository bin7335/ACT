import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db, schema } from "./db";
import { hashToken } from "./security";
import { safeReturnPath } from "./auth-credentials";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-act_session" : "act_session";
export const OAUTH_COOKIE = process.env.NODE_ENV === "production" ? "__Host-act_oauth" : "act_oauth";
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
const MAX_AGE = 60 * 60 * 24 * 30;

export async function sessionHash() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? hashToken(token) : null;
}

export async function currentMember() {
  await connection();
  const hash = await sessionHash();
  if (!hash) return null;
  return db.select({ id: schema.member.id, name: schema.member.name, username: schema.member.username, isAdmin: schema.member.isAdmin })
    .from(schema.memberSession).innerJoin(schema.member, eq(schema.memberSession.memberId, schema.member.id))
    .where(and(eq(schema.memberSession.tokenHash, hash), gt(schema.memberSession.expiresAt, new Date()))).get() ?? null;
}

export async function requireMember(next = "/account") {
  const member = await currentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(safeReturnPath(next))}`);
  return member;
}

export async function endMemberSession() {
  const hash = await sessionHash();
  if (hash) db.delete(schema.memberSession).where(eq(schema.memberSession.tokenHash, hash)).run();
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(OAUTH_COOKIE);
}

export async function startMemberSession(memberId: string) {
  await endMemberSession();
  const token = randomBytes(32).toString("base64url");
  db.delete(schema.memberSession).where(lt(schema.memberSession.expiresAt, new Date())).run();
  db.insert(schema.memberSession).values({ tokenHash: hashToken(token), memberId, expiresAt: new Date(Date.now() + MAX_AGE * 1000) }).run();
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: MAX_AGE });
}

export function googleConfigured() {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.SITE_URL;
}
