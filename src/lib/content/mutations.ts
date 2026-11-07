import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { deleteThumbnail } from "@/lib/uploads";
import type { WorkInput } from "./form";
import { findOrCreateMakers } from "./queries";
import type { WorkStatus } from "./types";

function newSlug() {
  for (;;) {
    const slug = randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    if (slug.length < 6) continue;
    if (!db.select({ s: schema.work.slug }).from(schema.work).where(eq(schema.work.slug, slug)).get()) return slug;
  }
}

function projectOrNull(slug: string) {
  if (!slug) return null;
  return db.select({ s: schema.project.slug }).from(schema.project).where(eq(schema.project.slug, slug)).get()?.s ?? null;
}

function setMakers(workSlug: string, makerSlugs: string[]) {
  db.delete(schema.workMaker).where(eq(schema.workMaker.workSlug, workSlug)).run();
  makerSlugs.forEach((m, i) => db.insert(schema.workMaker).values({ workSlug, makerSlug: m, position: i }).run());
}

export async function createWork(input: WorkInput, opts: { thumbnail: string | null; ownerId: string; status?: WorkStatus }) {
  const slug = newSlug();
  const makers = await findOrCreateMakers(input.makers);
  db.transaction(() => {
    db.insert(schema.work)
      .values({
        slug,
        purpose: input.purpose,
        type: input.type,
        title: input.title,
        summary: input.summary,
        body: input.body,
        links: input.links,
        audience: input.audience,
        subjects: input.subjects,
        projectSlug: projectOrNull(input.project),
        thumbnail: opts.thumbnail,
        thumbnailAlt: input.thumbnailAlt || null,
        contactEmail: input.contactEmail || null,
        ownerId: opts.ownerId,
        status: opts.status ?? "review",
        publishedAt: opts.status === "published" ? new Date() : null,
      })
      .run();
    setMakers(slug, makers);
  });
  return slug;
}

export async function updateWork(slug: string, input: WorkInput, opts: { thumbnail?: string | null; ownerId?: string }) {
  const prev = db.select().from(schema.work).where(eq(schema.work.slug, slug)).get();
  if (!prev) throw new Error("not found");
  const makers = await findOrCreateMakers(input.makers);
  const linksChanged = JSON.stringify(prev.links) !== JSON.stringify(input.links);
  db.transaction(() => {
    const current = db.select().from(schema.work).where(eq(schema.work.slug, slug)).get();
    if (!current || (opts.ownerId !== undefined && current.ownerId !== opts.ownerId)) throw new Error("Work permission changed");
    db.update(schema.work)
      .set({
        purpose: input.purpose,
        type: input.type,
        title: input.title,
        summary: input.summary,
        body: input.body,
        links: input.links,
        audience: input.audience,
        subjects: input.subjects,
        projectSlug: projectOrNull(input.project),
        thumbnailAlt: input.thumbnailAlt || null,
        contactEmail: input.contactEmail || null,
        ...(opts.thumbnail !== undefined ? { thumbnail: opts.thumbnail } : {}),
        ...(linksChanged ? { linkBroken: false, linkCheckedAt: null } : {}),
        // 반려(숨김)된 작품을 고치면 다시 검수 대기로 돌린다.
        ...(prev.status === "hidden" || prev.status === "draft" ? { status: "review" as const } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.work.slug, slug))
      .run();
    setMakers(slug, makers);
  });
  if (opts.thumbnail !== undefined && prev.thumbnail && prev.thumbnail !== opts.thumbnail) await deleteThumbnail(prev.thumbnail);
}

export function setWorkStatus(slug: string, status: WorkStatus, note?: string) {
  const prev = db.select().from(schema.work).where(eq(schema.work.slug, slug)).get();
  if (!prev) return;
  db.update(schema.work)
    .set({
      status,
      reviewNote: note?.trim() ? note.trim().slice(0, 500) : status === "published" ? null : prev.reviewNote,
      publishedAt: status === "published" ? (prev.publishedAt ?? new Date()) : prev.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.work.slug, slug))
    .run();
}

export async function deleteWork(slug: string) {
  const prev = db.select().from(schema.work).where(eq(schema.work.slug, slug)).get();
  if (!prev) return;
  db.delete(schema.work).where(eq(schema.work.slug, slug)).run();
  await deleteThumbnail(prev.thumbnail);
}

export function createProject(p: { year: number; term: string; name: string; summary: string }) {
  const base = `${p.year}-${randomBytes(3).toString("hex")}`;
  db.insert(schema.project).values({ slug: base, ...p }).run();
  return base;
}

export function updateMaker(slug: string, data: { name: string; bio: string; member: boolean }) {
  db.update(schema.maker).set(data).where(eq(schema.maker.slug, slug)).run();
}
