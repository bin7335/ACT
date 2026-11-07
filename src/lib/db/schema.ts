import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  /** 운영진 권한. 회원가입만으로는 얻지 않으며 기존 운영진이 부여한다. */
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: ts("created_at").notNull().default(now),
});

export const googleIdentity = sqliteTable("google_identity", {
  subject: text("subject").primaryKey(),
  memberId: text("member_id").notNull().unique().references(() => member.id, { onDelete: "cascade" }),
  /** Google이 확인한 이메일(비공개). 운영진의 회원 검색과 초기 운영진 지정에만 쓴다. */
  email: text("email"),
});

export const memberSession = sqliteTable("member_session", {
  tokenHash: text("token_hash").primaryKey(),
  memberId: text("member_id").notNull().references(() => member.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
});

export const oauthAttempt = sqliteTable("oauth_attempt", {
  stateHash: text("state_hash").primaryKey(),
  verifier: text("verifier").notNull(),
  nonce: text("nonce").notNull(),
  next: text("next").notNull(),
  linkSessionHash: text("link_session_hash"),
  expiresAt: ts("expires_at").notNull(),
});

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
    purpose: text("purpose", { enum: ["class", "work", "play"] }).notNull().default("class"),
    type: text("type", { enum: ["web-app", "mobile-app", "video", "material"] }).notNull(),
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
    /** 계정으로 관리하는 작품의 회원 ID (비회원 작품은 null) */
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
