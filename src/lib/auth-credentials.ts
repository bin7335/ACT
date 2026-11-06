import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validUsername(value: string) {
  return /^[a-z0-9_]{4,24}$/.test(value);
}

export function validPassword(value: string) {
  return value.length >= 12 && value.length <= 128;
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null) {
  // 없는 아이디도 같은 비용으로 검증한다.
  const [version, salt, hash] = (encoded ?? `scrypt-v1:${"0".repeat(32)}:${"0".repeat(128)}`).split(":");
  if (version !== "scrypt-v1" || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(hash, "hex")) && encoded !== null;
}

export function safeReturnPath(value: string | null | undefined) {
  // 수정 링크를 포함한 같은 사이트 경로만 허용한다.
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f]/.test(value) || value.startsWith("/api/")) return "/account";
  const url = new URL(value, "https://local.invalid");
  return url.origin === "https://local.invalid" ? `${url.pathname}${url.search}` : "/account";
}
