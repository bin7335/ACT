"use server";

import { eq, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import * as oauth from "oauth4webapi";
import { db, schema } from "@/lib/db";
import { currentMember, requireMember, startMemberSession, endMemberSession, sessionHash, OAUTH_COOKIE, cookieOptions } from "@/lib/auth";
import { hashPassword, normalizeUsername, safeReturnPath, validPassword, validUsername, verifyPassword } from "@/lib/auth-credentials";
import { clientIp, hashToken, rateLimit } from "@/lib/security";
import { google, googleClient } from "@/lib/google-auth";

export type AuthState = { error?: string };

export async function credentialsAction(mode: "login" | "signup", _prev: AuthState, fd: FormData): Promise<AuthState> {
  const username = normalizeUsername(String(fd.get("username") ?? ""));
  const password = String(fd.get("password") ?? "");
  const ip = await clientIp();
  if (!rateLimit(`auth-ip:${ip}`, 15, 15 * 60 * 1000) || !rateLimit(`auth-user:${username.slice(0, 24)}`, 10, 15 * 60 * 1000)) {
    return { error: "시도가 너무 많아요. 15분 뒤 다시 시도해 주세요." };
  }
  if (!validUsername(username) || !validPassword(password)) return { error: "아이디는 영문·숫자·밑줄 4~24자, 비밀번호는 12~128자로 입력해 주세요." };
  let memberId: string;
  if (mode === "signup") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name || name.length > 40) return { error: "표시 이름은 1~40자로 입력해 주세요." };
    if (password !== fd.get("confirm")) return { error: "비밀번호 확인이 일치하지 않아요." };
    if (fd.get("consent") !== "on") return { error: "계정 정보 저장 안내를 확인해 주세요." };
    const passwordHash = await hashPassword(password);
    memberId = crypto.randomUUID();
    const inserted = db.insert(schema.member).values({ id: memberId, username, name, passwordHash }).onConflictDoNothing().returning({ id: schema.member.id }).get();
    if (!inserted) return { error: "사용할 수 없는 아이디예요. 다른 아이디를 입력해 주세요." };
  } else {
    const member = db.select().from(schema.member).where(eq(schema.member.username, username)).get();
    if (!(await verifyPassword(password, member?.passwordHash ?? null)) || !member) return { error: "아이디 또는 비밀번호가 맞지 않아요." };
    memberId = member.id;
  }
  await startMemberSession(memberId);
  redirect(safeReturnPath(String(fd.get("next") ?? "")));
}

export async function updateNameAction(_prev: AuthState & { saved?: boolean }, fd: FormData): Promise<AuthState & { saved?: boolean }> {
  const member = await requireMember("/account/settings");
  const name = String(fd.get("name") ?? "").trim();
  if (!name || name.length > 40) return { error: "표시 이름은 1~40자로 입력해 주세요." };
  db.update(schema.member).set({ name }).where(eq(schema.member.id, member.id)).run();
  refresh();
  return { saved: true };
}

export async function logoutAction() {
  await endMemberSession();
  redirect("/");
}

export async function beginGoogleAction(link: boolean, _prev: AuthState, fd: FormData): Promise<AuthState> {
  if (!rateLimit(`google:${await clientIp()}`, 20, 15 * 60 * 1000)) return { error: "잠시 뒤 다시 시도해 주세요." };
  let config: ReturnType<typeof googleClient>;
  try { config = googleClient(); } catch { return { error: "Google 로그인이 아직 설정되지 않았어요." }; }
  // 쿠키는 호스트 전용이다. 다른 도메인에서 시작한 로그인을 섞지 않는다.
  if ((await headers()).get("origin") !== new URL(config.callback).origin) {
    return { error: "Google 로그인은 사이트의 대표 주소에서 이용해 주세요." };
  }
  let linkSessionHash: string | null = null;
  if (link) {
    const member = await requireMember();
    const record = db.select().from(schema.member).where(eq(schema.member.id, member.id)).get();
    const password = String(fd.get("password") ?? "");
    if (!record?.passwordHash || !validPassword(password) || !(await verifyPassword(password, record.passwordHash))) return { error: "계정 연결을 위해 현재 비밀번호를 확인해 주세요." };
    if (db.select().from(schema.googleIdentity).where(eq(schema.googleIdentity.memberId, member.id)).get()) return { error: "이미 Google 계정이 연결되어 있어요." };
    linkSessionHash = await sessionHash();
    if (!linkSessionHash) return { error: "다시 로그인해 주세요." };
  } else if (await currentMember()) {
    return { error: "이미 로그인되어 있어요. 계정 연결은 마이페이지에서 진행해 주세요." };
  }
  const state = oauth.generateRandomState();
  const nonce = oauth.generateRandomNonce();
  const verifier = oauth.generateRandomCodeVerifier();
  const jar = await cookies();
  const oldState = jar.get(OAUTH_COOKIE)?.value;
  if (oldState) db.delete(schema.oauthAttempt).where(eq(schema.oauthAttempt.stateHash, hashToken(oldState))).run();
  db.delete(schema.oauthAttempt).where(lt(schema.oauthAttempt.expiresAt, new Date())).run();
  db.insert(schema.oauthAttempt).values({ stateHash: hashToken(state), nonce, verifier, linkSessionHash, next: link ? "/account/settings?linked=1" : safeReturnPath(String(fd.get("next") ?? "")), expiresAt: new Date(Date.now() + 600000) }).run();
  jar.set(OAUTH_COOKIE, state, { ...cookieOptions, maxAge: 600 });
  const url = new URL(google.authorization_endpoint!);
  url.search = new URLSearchParams({ client_id: config.client.client_id, redirect_uri: config.callback, response_type: "code", scope: "openid profile email", state, nonce, code_challenge: await oauth.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256", prompt: "select_account" }).toString();
  redirect(url.href);
}

