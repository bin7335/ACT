// 개발용 예시 데이터를 DB에 넣는다. 운영 DB에는 실행하지 않는다.
// 사용: npm run db:seed
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../src/lib/db/schema";
import { makers, projects, works } from "../src/lib/content/seed";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("운영 환경에서는 시드를 넣지 않습니다. 정말 필요하면 --force");
  process.exit(1);
}

const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
const sqlite = new Database(path.join(dataDir, "act.db"));
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.resolve("./drizzle") });

const d = (s: string) => new Date(`${s}T09:00:00+09:00`);

db.transaction((tx) => {
  for (const m of makers) {
    tx.insert(schema.maker).values({ slug: m.slug, name: m.name, bio: m.bio, member: m.member, links: m.links }).onConflictDoNothing().run();
  }
  for (const p of projects) tx.insert(schema.project).values(p).onConflictDoNothing().run();
  for (const w of works) {
    tx.insert(schema.work)
      .values({
        slug: w.slug,
        purpose: w.purpose,
        type: w.type,
        title: w.title,
        summary: w.summary,
        body: w.body.join("\n\n"),
        links: w.links,
        audience: w.audience,
        subjects: w.subjects,
        projectSlug: w.project ?? null,
        status: w.status,
        createdAt: d(w.createdAt),
        updatedAt: d(w.updatedAt),
        publishedAt: w.status === "published" ? d(w.createdAt) : null,
        linkCheckedAt: w.linkCheckedAt ? d(w.linkCheckedAt) : null,
        linkBroken: w.linkBroken ?? false,
      })
      .onConflictDoNothing()
      .run();
    w.makers.forEach((m, i) => tx.insert(schema.workMaker).values({ workSlug: w.slug, makerSlug: m, position: i }).onConflictDoNothing().run());
  }
});

console.log(`seeded: ${makers.length} makers, ${projects.length} projects, ${works.length} works`);
