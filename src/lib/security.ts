import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "unknown";
}

// 실행 인스턴스별 메모리 속도 제한. Workers 인스턴스 간에는 공유되지 않는다.
const buckets = new Map<string, number[]>();

// 일반회원은 작품 제출·영상 업로드를 각각 시간당 30회 허용한다.
// 웹과 API의 작품 제출은 같은 회원별 한도를 공유한다.
export function uploadRateLimit(kind: "submit" | "video", member: { id: string; isAdmin: boolean; isResearch: boolean }) {
  if (member.isAdmin || member.isResearch) return true;
  return rateLimit(`${kind}:${member.id}`, 30, 60 * 60 * 1000);
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return true;
}
