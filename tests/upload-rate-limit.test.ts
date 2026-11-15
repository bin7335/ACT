import assert from "node:assert/strict";
import test from "node:test";
import { uploadRateLimit } from "../src/lib/security";

const member = (id: string, isAdmin = false, isResearch = false) => ({ id, isAdmin, isResearch });

test("일반회원은 종류별 시간당 30회, 회원별 독립 한도를 사용한다", () => {
  const a = member("upload-ordinary-a");
  const b = member("upload-ordinary-b");
  for (let i = 0; i < 30; i++) assert.equal(uploadRateLimit("submit", a), true);
  assert.equal(uploadRateLimit("submit", a), false);
  assert.equal(uploadRateLimit("submit", b), true);
  for (let i = 0; i < 30; i++) assert.equal(uploadRateLimit("video", a), true);
  assert.equal(uploadRateLimit("video", a), false);
});

test("관리자와 연구회회원은 두 종류 모두 횟수 제한이 없다", () => {
  for (const m of [member("upload-admin", true), member("upload-research", false, true)]) {
    for (let i = 0; i < 100; i++) {
      assert.equal(uploadRateLimit("submit", m), true);
      assert.equal(uploadRateLimit("video", m), true);
    }
  }
});

test("권한을 얻으면 기존 제한을 우회하고 해제되면 일반회원 한도가 적용된다", () => {
  const m = member("upload-role-change");
  for (let i = 0; i < 30; i++) assert.equal(uploadRateLimit("submit", m), true);
  assert.equal(uploadRateLimit("submit", m), false);
  assert.equal(uploadRateLimit("submit", { ...m, isResearch: true }), true);
  assert.equal(uploadRateLimit("submit", { ...m, isAdmin: true }), true);
  assert.equal(uploadRateLimit("submit", m), false);
});

test("한 시간이 지난 요청은 한도에서 제외한다", (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const m = member("upload-window");
  for (let i = 0; i < 30; i++) assert.equal(uploadRateLimit("video", m), true);
  now += 60 * 60 * 1000 - 1;
  assert.equal(uploadRateLimit("video", m), false);
  now += 1;
  assert.equal(uploadRateLimit("video", m), true);
});
