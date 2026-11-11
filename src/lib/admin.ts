import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { currentMember } from "./auth";
import { hmac, safeEqual } from "./security";

// 운영진 화면은 운영진 권한이 있는 회원 계정 또는 공용 비밀번호(ADMIN_PASSWORD)로 들어간다.
const COOKIE = "act_admin";
const MAX_AGE = 60 * 60 * 12;

function secret() {
  const s = process.env.ADMIN_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-admin-secret");
  if (!s) throw new Error("ADMIN_SECRET이 설정되지 않았습니다.");
  return s;
}

export function adminPasswordConfigured() {
  return !!process.env.ADMIN_PASSWORD;
}

export function checkAdminPassword(input: string) {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && safeEqual(input, pw);
}

export async function startAdminSession() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  (await cookies()).set(COOKIE, `${exp}.${hmac(secret(), exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  await connection();
  const v = (await cookies()).get(COOKIE)?.value;
  const [exp, sig] = v?.split(".") ?? [];
  if (exp && sig && Number(exp) > Date.now() && safeEqual(sig, hmac(secret(), exp))) return true;
  return !!(await currentMember())?.isAdmin;
}

/**
 * 연구회 프로젝트 권한. 관리자와 연구회회원만 프로젝트를 보고, 만들고, 글을 쓴다.
 * member는 로그인한 회원(공용 비밀번호로만 들어온 운영진은 null), admin은 관리자 여부.
 */
export async function projectAccess() {
  const [admin, member] = await Promise.all([isAdmin(), currentMember()]);
  return { allowed: admin || !!member?.isResearch, admin, member };
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
