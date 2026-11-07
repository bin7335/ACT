import "server-only";
import * as oauth from "oauth4webapi";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

// Google의 고정된 OIDC 엔드포인트만 사용한다. 요청 Host 헤더로 콜백을 만들지 않는다.
export const google: oauth.AuthorizationServer = {
  issuer: "https://accounts.google.com",
  authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  token_endpoint: "https://oauth2.googleapis.com/token",
  jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
};

export function googleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const site = new URL(process.env.SITE_URL ?? "http://localhost:3000");
  if (!clientId || !secret || (site.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && site.hostname === "localhost"))) {
    throw new Error("Google login is not configured");
  }
  return { client: { client_id: clientId } satisfies oauth.Client, secret, callback: `${site.origin}/api/auth/callback/google` };
}

export async function exchangeGoogleCode(url: URL, state: string, verifier: string, nonce: string) {
  const { client, secret, callback } = googleClient();
  const params = oauth.validateAuthResponse(google, client, url, state);
  const response = await oauth.authorizationCodeGrantRequest(google, client, oauth.ClientSecretPost(secret), params, callback, verifier, { signal: AbortSignal.timeout(15000) });
  const result = await oauth.processAuthorizationCodeResponse(google, client, response, { expectedNonce: nonce, requireIdToken: true });
  await oauth.validateApplicationLevelSignature(google, response, { signal: AbortSignal.timeout(15000) });
  const claims = oauth.getValidatedIdTokenClaims(result);
  if (!claims?.sub) throw new Error("Google identity missing");
  const email = claims.email_verified === true && typeof claims.email === "string" ? claims.email.trim().toLowerCase().slice(0, 254) : null;
  return { subject: claims.sub, name: typeof claims.name === "string" ? claims.name.slice(0, 40) : "선생님", email };
}

export function resolveGoogleMember(subject: string, name: string, linkMemberId: string | null, email: string | null = null) {
  const id = findOrLinkGoogleMember(subject, name, linkMemberId);
  if (email) db.update(schema.googleIdentity).set({ email }).where(eq(schema.googleIdentity.subject, subject)).run();
  return id;
}

function findOrLinkGoogleMember(subject: string, name: string, linkMemberId: string | null) {
  return db.transaction(() => {
    const identity = db.select().from(schema.googleIdentity).where(eq(schema.googleIdentity.subject, subject)).get();
    if (linkMemberId) {
      if (identity && identity.memberId !== linkMemberId) throw new Error("Identity already linked");
      const existing = db.select().from(schema.googleIdentity).where(eq(schema.googleIdentity.memberId, linkMemberId)).get();
      if (existing && existing.subject !== subject) throw new Error("Member already linked");
      if (!identity) db.insert(schema.googleIdentity).values({ subject, memberId: linkMemberId }).run();
      return linkMemberId;
    }
    if (identity) return identity.memberId;
    const id = crypto.randomUUID();
    db.insert(schema.member).values({ id, name }).run();
    db.insert(schema.googleIdentity).values({ subject, memberId: id }).run();
    return id;
  });
}
