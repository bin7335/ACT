import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { setupBindings, teardownBindings } from "./helpers/bindings";
import { eq } from "drizzle-orm";
import { generateKeyPairSync, sign } from "node:crypto";
import { hashPassword, normalizeUsername, safeReturnPath, validPassword, validUsername, verifyPassword } from "../src/lib/auth-credentials";

before(setupBindings);
after(teardownBindings);

test("username and password validation", () => {
  assert.equal(normalizeUsername(" Teacher_1 "), "teacher_1");
  for (const name of ["abc", "a b c", "teacher@school", "a".repeat(25)]) assert.equal(validUsername(name), false);
  assert.equal(validUsername("teacher_1"), true);
  assert.equal(validPassword("short"), false);
  assert.equal(validPassword("x".repeat(129)), false);
  assert.equal(validPassword("a long passphrase"), true);
});

test("salted scrypt verifies only the right password", async () => {
  const password = "test-only passphrase";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("incorrect password", first), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(await verifyPassword(password, "invalid"), false);
});

test("return paths cannot redirect off site or into API routes", () => {
  for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", "/\nevil.test", "/api/auth/callback/google", ""]) assert.equal(safeReturnPath(path), "/account");
  assert.equal(safeReturnPath("/submit"), "/submit");
  assert.equal(safeReturnPath("/edit/test-token?new=1"), "/edit/test-token?new=1");
});

test("OIDC rejects wrong state, nonce, audience and forged signature", async () => {
  const { exchangeGoogleCode } = await import("../src/lib/google-auth");
  const originalFetch = globalThis.fetch;
  const originalEnv = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, site: process.env.SITE_URL };
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.SITE_URL = "http://localhost:3000";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test", use: "sig", alg: "RS256" };
  let overrides: Record<string, unknown> = {};
  let forged = false;
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [jwk] });
    assert.equal(String(input), "https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("code_verifier"), "test-verifier");
    assert.equal(body.get("redirect_uri"), "http://localhost:3000/api/auth/callback/google");
    const now = Math.floor(Date.now() / 1000);
    const head = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", aud: "test-client", sub: "google-test", nonce: "test-nonce", iat: now, exp: now + 600, ...overrides })).toString("base64url");
    const content = `${head}.${payload}`;
    return Response.json({ access_token: "test-token", token_type: "Bearer", id_token: `${content}.${sign("RSA-SHA256", Buffer.from(content), forged ? other.privateKey : privateKey).toString("base64url")}` });
  };
  const callback = new URL("http://localhost:3000/api/auth/callback/google?state=test-state&code=test-code");
  const exchange = () => exchangeGoogleCode(callback, "test-state", "test-verifier", "test-nonce");
  try {
    assert.equal((await exchange()).subject, "google-test");
    await assert.rejects(exchangeGoogleCode(callback, "wrong-state", "test-verifier", "test-nonce"));
    for (const invalid of [{ nonce: "wrong" }, { aud: "other" }, { iss: "https://evil.test" }, { exp: 1 }]) {
      overrides = invalid;
      await assert.rejects(exchange());
    }
    overrides = {}; forged = true;
    await assert.rejects(exchange());
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({ GOOGLE_CLIENT_ID: originalEnv.id, GOOGLE_CLIENT_SECRET: originalEnv.secret, SITE_URL: originalEnv.site })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("only the owner can edit a member work", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { updateWork } = await import("../src/lib/content/mutations");
  await db.insert(schema.member).values({ id: "owner", name: "Owner" }).run();
  await db.insert(schema.work).values({ slug: "member-work", type: "web-app", title: "Original", summary: "A member work", ownerId: "owner" }).run();
  const input = { purpose: "class" as const, type: "web-app" as const, title: "Changed", summary: "Changed summary", body: "", makers: [], links: [], audience: [], subjects: [], project: "", thumbnailAlt: "", contactEmail: "" };
  await assert.rejects(updateWork("member-work", input, { ownerId: "other" }));
  await updateWork("member-work", input, { ownerId: "owner" });
  assert.equal((await db.select().from(schema.work).where(eq(schema.work.slug, "member-work")).get())?.title, "Changed");
});

test("minimal member submission derives author and link kind, preserving existing metadata", async () => {
  const { readMemberWorkForm, validateWork, emptyValues } = await import("../src/lib/content/form");
  const fd = new FormData();
  for (const [key, value] of Object.entries({ purpose: "class", type: "video", title: "Test video", summary: "A useful classroom video", link_url: "https://youtu.be/abc", makers: "Forged author", project: "forged" })) fd.set(key, value);
  const values = readMemberWorkForm(fd, "Teacher");
  assert.equal(values.makers, "Teacher");
  assert.equal(values.links[0].kind, "youtube");
  assert.equal(values.project, "");
  assert.ok(validateWork(values).data);
  const edited = readMemberWorkForm(fd, "Teacher", { ...emptyValues, makers: "Original author", subjects: "수학", project: "existing", contactEmail: "owner@example.test", links: [{ kind: "open", url: "https://example.test" }, { kind: "source", url: "https://github.com/example/repo" }] });
  assert.equal(edited.makers, "Original author");
  assert.equal(edited.subjects, "수학");
  assert.equal(edited.project, "existing");
  assert.equal(edited.links.length, 2);
});

test("Google identity linking never merges or transfers accounts", async () => {
  const { resolveGoogleMember } = await import("../src/lib/google-auth");
  const { db, schema } = await import("../src/lib/db");
  await db.insert(schema.member).values([{ id: "local-a", name: "Same Name", username: "local_a" }, { id: "local-b", name: "Same Name", username: "local_b" }]).run();
  const googleId = await resolveGoogleMember("google-a", "Same Name", null);
  assert.notEqual(googleId, "local-a");
  assert.equal(await resolveGoogleMember("google-a", "Updated Name", null), googleId);
  await assert.rejects(resolveGoogleMember("google-a", "Same Name", "local-a"));
  assert.equal(await resolveGoogleMember("google-b", "Same Name", "local-a"), "local-a");
  assert.equal(await resolveGoogleMember("google-b", "Same Name", null), "local-a");
  await assert.rejects(resolveGoogleMember("google-b", "Same Name", "local-b"));
  await assert.rejects(resolveGoogleMember("google-c", "Same Name", "local-a"));
  assert.equal((await db.select().from(schema.googleIdentity).where(eq(schema.googleIdentity.memberId, "local-a")).get())?.subject, "google-b");
});

test("Google email is stored for admin member search", async () => {
  const { resolveGoogleMember } = await import("../src/lib/google-auth");
  const { searchMembers, setMemberAdmin } = await import("../src/lib/members");
  const { db, schema } = await import("../src/lib/db");
  const owner = await resolveGoogleMember("google-owner", "Owner", null, "owner@example.test");
  const other = await resolveGoogleMember("google-other", "Other_%", null, "other@example.test");
  const isAdmin = async (id: string) => (await db.select().from(schema.member).where(eq(schema.member.id, id)).get())?.isAdmin;
  assert.equal(await isAdmin(owner), false);
  assert.deepEqual((await searchMembers("OTHER@example")).map(m => m.id), [other]);
  assert.deepEqual((await searchMembers("_%")).map(m => m.id), [other]);
  assert.deepEqual((await searchMembers("")).map(m => m.id), []);
  await setMemberAdmin(owner, true);
  assert.equal(await isAdmin(owner), true);
  assert.deepEqual((await searchMembers("")).map(m => m.id), [owner]);
});

test("link images: og:image parsing and internal address blocking", async () => {
  const { findImageUrl, isBlockedAddress, fetchLinkImage, youtubeId } = await import("../src/lib/remote-image");
  const base = new URL("https://teacher.example/tools/pizza/");
  assert.equal(findImageUrl(`<meta name="twitter:image" content="/tw.png"><meta content='og.png?a=1&amp;b=2' property="og:image">`, base)?.href, "https://teacher.example/tools/pizza/og.png?a=1&b=2");
  assert.equal(findImageUrl(`<meta property=og:image content=//cdn.example/x.jpg>`, base)?.href, "https://cdn.example/x.jpg");
  assert.equal(findImageUrl(`<meta property="og:image" content="javascript:alert(1)">`, base), null);
  assert.equal(findImageUrl(`<title>none</title>`, base), null);
  for (const [address, family] of [["127.0.0.1", 4], ["10.1.2.3", 4], ["100.120.114.62", 4], ["169.254.169.254", 4], ["192.168.0.10", 4], ["::1", 6], ["::ffff:127.0.0.1", 6], ["fd00::1", 6], ["fe80::1", 6]] as const) {
    assert.equal(isBlockedAddress(address, family), true, address);
  }
  assert.equal(isBlockedAddress("8.8.8.8", 4), false);
  assert.equal(isBlockedAddress("2606:4700::1111", 6), false);
  for (const url of ["http://127.0.0.1/", "http://localhost/", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "ftp://example.com/", "http://example.com:8080/"]) {
    await assert.rejects(fetchLinkImage(url), url);
  }
  assert.equal(youtubeId("https://youtu.be/abc123XYZ_-"), "abc123XYZ_-");
  assert.equal(youtubeId("https://www.youtube.com/shorts/abc123"), "abc123");
});
