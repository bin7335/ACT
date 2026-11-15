import "server-only";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

// Cloudflare Workers에서는 D1(DB)·R2(UPLOADS) 바인딩을 요청마다 문맥에서 꺼낸다.
// 단위 테스트는 wrangler의 로컬 바인딩을 globalThis에 넣어 같은 코드를 그대로 실행한다.
type Overrides = { __actDb?: Db; __actUploads?: R2Bucket; __actImages?: ImagesBinding };
const overrides = globalThis as unknown as Overrides;

export function getDb(): Db {
  return overrides.__actDb ?? drizzle(getCloudflareContext().env.DB, { schema });
}

export function getUploads(): R2Bucket {
  return overrides.__actUploads ?? getCloudflareContext().env.UPLOADS;
}

export function getImages(): ImagesBinding {
  return overrides.__actImages ?? getCloudflareContext().env.IMAGES!;
}

/** 모듈 어디서든 `db.select()…`처럼 쓰되, 실제 연결은 호출 시점의 요청 문맥에서 가져온다. */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = (real as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
