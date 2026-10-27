import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

// 회원 로그인은 아직 없다(추후 도입). 작품 수정 권한은 제출 시 발급하는 수정 링크 토큰으로 확인하고,
// 로그인을 붙이면 owner_id에 회원 ID를 채워 같은 행을 그대로 쓴다.

export const maker = sqliteTable("maker", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  member: integer("member", { mode: "boolean" }).notNull().default(true),
  links: text("links", { mode: "json" }).$type<{ label: string; url: string }[]>().notNull().default([]),
  createdAt: ts("created_at").notNull().default(now),
});

export const project = sqliteTable("project", {
  slug: text("slug").primaryKey(),
  year: integer("year").notNull(),
  term: text("term").notNull(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
});

export const work = sqliteTable(
  "work",
  {
    slug: text("slug").primaryKey(),
    type: text("type", { enum: ["web-tool", "web-app", "mobile-app", "video", "material"] }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull().default(""),
    thumbnail: text("thumbnail"),
    thumbnailAlt: text("thumbnail_alt"),
    links: text("links", { mode: "json" }).$type<{ kind: string; url: string }[]>().notNull().default([]),
    audience: text("audience", { mode: "json" }).$type<string[]>().notNull().default([]),
    subjects: text("subjects", { mode: "json" }).$type<string[]>().notNull().default([]),
    projectSlug: text("project_slug").references(() => project.slug, { onDelete: "set null" }),
    status: text("status", { enum: ["draft", "review", "published", "hidden"] }).notNull().default("review"),
    reviewNote: text("review_note"),
    /** 제출자 연락처(비공개, 검수 안내용) */
    contactEmail: text("contact_email"),
    /** 수정 링크 토큰의 SHA-256 해시. 원문은 저장하지 않는다. */
    editTokenHash: text("edit_token_hash"),
    /** 로그인 도입 후 회원 ID */
    ownerId: text("owner_id"),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
    publishedAt: ts("published_at"),
    linkCheckedAt: ts("link_checked_at"),
    linkBroken: integer("link_broken", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("work_status_idx").on(t.status, t.publishedAt), index("work_edit_token_idx").on(t.editTokenHash)],
);

export const workMaker = sqliteTable(
  "work_maker",
  {
    workSlug: text("work_slug")
      .notNull()
      .references(() => work.slug, { onDelete: "cascade", onUpdate: "cascade" }),
    makerSlug: text("maker_slug")
      .notNull()
      .references(() => maker.slug, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workSlug, t.makerSlug] }), index("work_maker_maker_idx").on(t.makerSlug)],
);
