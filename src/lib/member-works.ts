import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { requireMember } from "./auth";
import { getAnyWork } from "./content/queries";

export async function ownWorks() {
  const member = await requireMember();
  return db.select({ slug: schema.work.slug, title: schema.work.title, summary: schema.work.summary, type: schema.work.type, status: schema.work.status, reviewNote: schema.work.reviewNote, updatedAt: schema.work.updatedAt })
    .from(schema.work).where(eq(schema.work.ownerId, member.id)).orderBy(desc(schema.work.updatedAt)).all();
}

export async function ownWork(slug: string) {
  const member = await requireMember(`/account/works/${slug}`);
  const row = db.select({ slug: schema.work.slug }).from(schema.work)
    .where(and(eq(schema.work.slug, slug), eq(schema.work.ownerId, member.id))).get();
  return row ? getAnyWork(row.slug) : null;
}
