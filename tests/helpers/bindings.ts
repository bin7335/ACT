import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "../../src/lib/db/schema";

// 테스트는 wrangler의 로컬 D1·R2(miniflare)를 쓰고, 프로덕션과 같은 마이그레이션을 적용한다.
// 테스트 파일마다 별도 프로세스라 임시 디렉터리에 새로 만든다.
let dispose: (() => Promise<void>) | undefined;

export async function setupBindings() {
  const persist = { path: mkdtempSync(join(tmpdir(), "act-test-")) };
  const proxy = await getPlatformProxy<{ DB: D1Database; UPLOADS: R2Bucket }>({ configPath: join(process.cwd(), "wrangler.jsonc"), persist });
  dispose = proxy.dispose;
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await proxy.env.DB.prepare(statement).run();
    }
  }
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.__actDb = drizzle(proxy.env.DB, { schema });
  globals.__actUploads = proxy.env.UPLOADS;
}

export async function teardownBindings() {
  await dispose?.();
}
