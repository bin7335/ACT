import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "act-api-token-test-"));

test("API 토큰은 해시로만 저장하고, 폐기하면 즉시 무효가 된다", async () => {
  const { db, schema } = await import("../src/lib/db");
  const { createApiToken, isTokenShape, listApiTokens, memberForToken, revokeApiToken } = await import("../src/lib/api-tokens");
  db.insert(schema.member).values([{ id: "api-admin", name: "운영진", isAdmin: true }, { id: "api-member", name: "회원" }]).run();

  const issued = createApiToken("api-admin", "에이전트");
  assert.equal(isTokenShape(issued.token), true);
  assert.equal(issued.token.startsWith("act_"), true);
  const row = db.select().from(schema.apiToken).where(eq(schema.apiToken.id, issued.id)).get()!;
  assert.notEqual(row.tokenHash, issued.token, "원문을 저장하지 않는다");
  assert.equal(row.tokenHash.length, 64);

  const found = memberForToken(issued.token);
  assert.equal(found?.memberId, "api-admin");
  assert.equal(found?.isAdmin, true);
  assert.ok(db.select().from(schema.apiToken).where(eq(schema.apiToken.id, issued.id)).get()?.lastUsedAt instanceof Date);
  assert.equal(memberForToken(null), null);
  assert.equal(memberForToken("act_" + "x".repeat(43)), null);
  assert.equal(memberForToken("not-a-token"), null);

  assert.equal(listApiTokens("api-admin").length, 1);
  assert.equal(listApiTokens("api-member").length, 0);
  // 다른 회원의 토큰은 폐기할 수 없다.
  assert.equal(revokeApiToken("api-member", issued.id), false);
  assert.equal(memberForToken(issued.token)?.memberId, "api-admin");
  assert.equal(revokeApiToken("api-admin", issued.id), true);
  assert.equal(memberForToken(issued.token), null);
  assert.equal(listApiTokens("api-admin").length, 0);
});

test("에이전트 JSON은 화면 제출과 같은 검증을 통과한다", async () => {
  const { valuesFromApi } = await import("../src/lib/content/api-work");
  const { validateWork } = await import("../src/lib/content/form");
  const values = valuesFromApi("홍길동", {
    purpose: "class",
    type: "video",
    title: "교실 영상",
    summary: "수업에 쓰는 짧은 영상입니다",
    link: "https://youtu.be/abc123",
    subjects: ["수학", "과학"],
    audience: ["초등 중"],
  });
  assert.equal(values.links[0].kind, "youtube");
  assert.equal(values.makers, "홍길동");
  assert.equal(values.subjects, "수학, 과학");
  const ok = validateWork(values);
  assert.ok(ok.data);
  assert.deepEqual(ok.data.audience, ["초등 중"]);

  const bad = validateWork(valuesFromApi("홍길동", { purpose: "class", type: "video", title: "x", summary: "짧", link: "not-a-url" }));
  assert.ok(bad.errors);
  assert.ok(bad.errors.title && bad.errors.summary && bad.errors.links);
});
