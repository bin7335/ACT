import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

// 데이터 디렉터리: VM에서는 DATA_DIR을 영구 볼륨으로 지정한다.
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "./data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

function open() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const sqlite = new Database(path.join(DATA_DIR, "act.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  const migrationsFolder = path.resolve(/*turbopackIgnore: true*/ process.env.MIGRATIONS_DIR ?? "./drizzle");
  try {
    migrate(db, { migrationsFolder });
  } catch {
    // 빌드 때 여러 워커가 새 DB를 동시에 마이그레이션하면 한쪽이 실패한다. 다른 쪽이 끝난 뒤 다시 확인한다.
    migrate(db, { migrationsFolder });
  }
  return db;
}

const globalForDb = globalThis as unknown as { __actDb?: ReturnType<typeof open> };

export const db = globalForDb.__actDb ?? (globalForDb.__actDb = open());
export { schema };
