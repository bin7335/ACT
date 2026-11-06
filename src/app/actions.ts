"use server";

import { refresh } from "next/cache";
import { currentMember, requireMember } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkAdminPassword, endAdminSession, isAdmin, requireAdmin, startAdminSession } from "@/lib/admin";
import { checkLinks } from "@/lib/content/link-check";
import { readWorkForm, readMemberWorkForm, valuesFromWork, validateWork, type WorkFormState } from "@/lib/content/form";
import { createProject, createWork, deleteWork, setWorkStatus, updateMaker, updateWork } from "@/lib/content/mutations";
import { getAnyWork } from "@/lib/content/queries";
import { WORK_STATUS_LABEL, type WorkStatus } from "@/lib/content/types";
import { clientIp, rateLimit } from "@/lib/security";
import { saveThumbnail, UploadError } from "@/lib/uploads";

async function thumbnailFrom(fd: FormData): Promise<{ path?: string | null; error?: string }> {
  if (fd.get("remove_thumbnail") === "on") return { path: null };
  const file = fd.get("thumbnail");
  if (!(file instanceof File) || file.size === 0) return {};
  try {
    return { path: await saveThumbnail(file) };
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "이미지를 저장하지 못했어요." };
  }
}

// ── 공개 제출 ────────────────────────────────────────────────────

export async function submitWorkAction(_prev: WorkFormState, fd: FormData): Promise<WorkFormState> {
  const member = await requireMember("/submit");
  const values = readMemberWorkForm(fd, member.name);
  // 봇이 채우는 숨김 필드
  if (String(fd.get("website") ?? "")) return { values, errors: { form: "제출할 수 없어요." } };
  if (!rateLimit(`submit:${await clientIp()}`, 6, 60 * 60 * 1000)) {
    return { values, errors: { form: "짧은 시간에 너무 많이 제출했어요. 잠시 뒤 다시 시도해 주세요." } };
  }
  const v = validateWork(values);
  if ("errors" in v) return { values, errors: v.errors };

  const thumb = await thumbnailFrom(fd);
  if (thumb.error) return { values, errors: { thumbnail: thumb.error } };

  const slug = await createWork(v.data, { thumbnail: thumb.path ?? null, ownerId: member.id });
  redirect(`/account/works/${slug}?new=1`);
}

export async function memberEditWorkAction(slug: string, prev: WorkFormState, fd: FormData): Promise<WorkFormState> {
  const member = await currentMember();
  const work = member ? await getAnyWork(slug) : null;
  if (!member || !work || work.ownerId !== member.id) return { values: prev.values, errors: { form: "이 작품을 수정할 권한이 없어요. 다시 로그인해 주세요." } };
  const values = readMemberWorkForm(fd, member.name, valuesFromWork(work));
  const v = validateWork(values);
  if ("errors" in v) return { values, errors: v.errors };
  const thumb = await thumbnailFrom(fd);
  if (thumb.error) return { values, errors: { thumbnail: thumb.error } };
  await updateWork(slug, v.data, { thumbnail: thumb.path, ownerId: member.id });
  refresh();
  return { values, saved: true };
}

// ── 운영진 ───────────────────────────────────────────────────────

export async function adminLoginAction(_prev: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  if (!rateLimit(`admin-login:${await clientIp()}`, 8, 15 * 60 * 1000)) return { error: "시도가 너무 많아요. 15분 뒤 다시 시도해 주세요." };
  if (!checkAdminPassword(String(fd.get("password") ?? ""))) return { error: "비밀번호가 맞지 않아요." };
  await startAdminSession();
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function adminLogoutAction() {
  await endAdminSession();
  redirect("/");
}

export async function adminEditWorkAction(slug: string, _prev: WorkFormState, fd: FormData): Promise<WorkFormState> {
  const values = readWorkForm(fd);
  if (!(await isAdmin())) return { values, errors: { form: "운영진 로그인이 필요해요." } };
  const v = validateWork(values);
  if ("errors" in v) return { values, errors: v.errors };
  const thumb = await thumbnailFrom(fd);
  if (thumb.error) return { values, errors: { thumbnail: thumb.error } };
  await updateWork(slug, v.data, { thumbnail: thumb.path });
  refresh();
  return { values, saved: true };
}

const STATUSES = Object.keys(WORK_STATUS_LABEL) as WorkStatus[];

export async function setStatusAction(fd: FormData) {
  await requireAdmin();
  const slug = String(fd.get("slug") ?? "");
  const status = String(fd.get("status") ?? "") as WorkStatus;
  if (!STATUSES.includes(status) || !(await getAnyWork(slug))) return;
  setWorkStatus(slug, status, String(fd.get("note") ?? ""));
  const back = String(fd.get("back") ?? "");
  redirect(back.startsWith("/admin") ? back : "/admin");
}

export async function deleteWorkAction(fd: FormData) {
  await requireAdmin();
  await deleteWork(String(fd.get("slug") ?? ""));
  redirect("/admin?deleted=1");
}

export async function createProjectAction(_prev: { error?: string; ok?: boolean }, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const year = Number(fd.get("year"));
  const term = String(fd.get("term") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  const summary = String(fd.get("summary") ?? "").trim();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: "연도를 확인해 주세요." };
  if (!term || !name || name.length > 40 || summary.length > 300) return { error: "학기, 이름(40자), 설명(300자)을 확인해 주세요." };
  createProject({ year, term, name, summary });
  refresh();
  return { ok: true };
}

export async function updateMakerAction(fd: FormData) {
  await requireAdmin();
  const name = String(fd.get("name") ?? "").trim().slice(0, 30);
  if (!name) return;
  updateMaker(String(fd.get("slug") ?? ""), { name, bio: String(fd.get("bio") ?? "").trim().slice(0, 200), member: fd.get("member") === "on" });
  refresh();
}

export async function checkLinksAction() {
  await requireAdmin();
  await checkLinks();
  redirect("/admin?checked=1");
}
