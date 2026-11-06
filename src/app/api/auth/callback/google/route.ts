import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { currentMember, sessionHash, startMemberSession, OAUTH_COOKIE } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth-credentials";
import { exchangeGoogleCode, googleClient, resolveGoogleMember } from "@/lib/google-auth";
import { hashToken, safeEqual } from "@/lib/security";

export async function GET(request: Request) {
  let origin: string;
  try { origin = new URL(googleClient().callback).origin; } catch {
    return new Response("Google login is not configured", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const failure = (link: boolean) => NextResponse.redirect(new URL(link ? "/account?error=google" : "/login?error=google", origin), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get(OAUTH_COOKIE)?.value;
  if (!state || !expected || state.length > 256 || !safeEqual(state, expected)) return failure(false);
  jar.delete(OAUTH_COOKIE);
  // DELETE RETURNING으로 재전송·병렬 콜백도 단 한 번만 소비한다.
  const attempt = db.delete(schema.oauthAttempt).where(and(eq(schema.oauthAttempt.stateHash, hashToken(state)), gt(schema.oauthAttempt.expiresAt, new Date()))).returning().get();
  if (!attempt) return failure(false);
  const linking = !!attempt.linkSessionHash;
  try {
    const identity = await exchangeGoogleCode(url, expected, attempt.verifier, attempt.nonce);
    let linkMemberId: string | null = null;
    if (linking) {
      const member = await currentMember();
      if (!member || (await sessionHash()) !== attempt.linkSessionHash) return failure(true);
      linkMemberId = member.id;
    } else if (await currentMember()) {
      return failure(true);
    }
    const id = resolveGoogleMember(identity.subject, identity.name, linkMemberId);
    await startMemberSession(id);
    return NextResponse.redirect(new URL(safeReturnPath(attempt.next), origin), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    // 토큰·인증 코드·공급자 응답을 로그나 URL에 남기지 않는다.
    return failure(linking);
  }
}
