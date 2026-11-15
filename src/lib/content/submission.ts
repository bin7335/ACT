import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { WorkInput } from "./form";
import { createWork } from "./mutations";

/** 공개 여부는 폼 값이 아니라 서버에 저장된 제출자 권한으로 결정한다. */
export async function createMemberWork(input: WorkInput, opts: { thumbnail: string | null; ownerId: string }) {
  const member = await db.select({ isAdmin: schema.member.isAdmin, isResearch: schema.member.isResearch }).from(schema.member).where(eq(schema.member.id, opts.ownerId)).get();
  if (!member) throw new Error("Member not found");
  return createWork(input, { ...opts, status: member.isAdmin || member.isResearch ? "published" : "review" });
}
