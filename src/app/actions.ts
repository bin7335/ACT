"use server";

import { refresh, revalidatePath } from "next/cache";
import { currentMember, requireMember } from "@/lib/auth";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { fillMissingThumbnail } from "@/lib/content/auto-thumbnail";
import { checkAdminPassword, endAdminSession, isAdmin, projectAccess, requireAdmin, startAdminSession } from "@/lib/admin";
import { checkLinks } from "@/lib/content/link-check";
import { readWorkForm, readMemberWorkForm, valuesFromWork, validateWork, type WorkFormState } from "@/lib/content/form";
import { createProject, deleteWork, setWorkStatus, updateMaker, updateWork } from "@/lib/content/mutations";
import { createMemberWork } from "@/lib/content/submission";
import { getAnyWork } from "@/lib/content/queries";
import { bookmarkCount, likeCount, setBookmarkRow, toggleLikeRow, visitorId } from "@/lib/content/stats";
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/api-tokens";
import { setMemberAdmin, setMemberRole } from "@/lib/members";
import { isRole } from "@/lib/roles";
import { createProjectPost, deleteProjectPost } from "@/lib/content/posts";
import { WORK_STATUS_LABEL, type WorkStatus } from "@/lib/content/types";
import { clientIp, rateLimit, uploadRateLimit } from "@/lib/security";
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

// 이미지를 올리지 않았으면 응답을 보낸 뒤 링크의 대표 이미지를 가져온다. 방금 지운 경우는 건드리지 않는다.
function fillThumbnailLater(slug: string) {
  after(() => fillMissingThumbnail(slug));
}

// ── 공개 제출 ────────────────────────────────────────────────────

export async function submitWorkAction(_prev: WorkFormState, fd: FormData): Promise<WorkFormState> {
  const member = await requireMember("/submit");
  const values = readMemberWorkForm(fd, member.name);
  // 봇이 채우는 숨김 필드
  if (String(fd.get("website") ?? "")) return { values, errors: { form: "제출할 수 없어요." } };
  if (!uploadRateLimit("submit", member)) {
    return { values, errors: { form: "짧은 시간에 너무 많이 제출했어요. 잠시 뒤 다시 시도해 주세요." } };
  }
  const v = validateWork(values);
  if ("errors" in v) return { values, errors: v.errors };

  const thumb = await thumbnailFrom(fd);
  if (thumb.error) return { values, errors: { thumbnail: thumb.error } };

  const slug = await createMemberWork(v.data, { thumbnail: thumb.path ?? null, ownerId: member.id });
  revalidatePath("/");
  revalidatePath("/works");
  revalidatePath("/admin");
  if (!thumb.path) fillThumbnailLater(slug);
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
  if (thumb.path === undefined) fillThumbnailLater(slug);
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
  if (thumb.path === undefined) fillThumbnailLater(slug);
  refresh();
  return { values, saved: true };
}

const STATUSES = Object.keys(WORK_STATUS_LABEL) as WorkStatus[];

export async function setStatusAction(fd: FormData) {
  await requireAdmin();
  const slug = String(fd.get("slug") ?? "");
  const status = String(fd.get("status") ?? "") as WorkStatus;
  if (!STATUSES.includes(status) || !(await getAnyWork(slug))) return;
  await setWorkStatus(slug, status, String(fd.get("note") ?? ""));
  // 공개 목록·홈·상세가 다음 방문에서 곧바로 새 상태를 보도록 캐시를 비운다.
  revalidatePath("/");
  revalidatePath("/works");
  revalidatePath(`/works/${slug}`);
  revalidatePath("/admin");
  const back = String(fd.get("back") ?? "");
  if (!back.startsWith("/admin")) redirect("/admin");
  const url = new URL(back, "http://admin.local");
  url.searchParams.set("saved", status);
  redirect(`${url.pathname}${url.search}`);
}

export async function deleteWorkAction(fd: FormData) {
  await requireAdmin();
  await deleteWork(String(fd.get("slug") ?? ""));
  redirect("/admin?deleted=1");
}

// 연구회 프로젝트는 관리자와 연구회회원이 만든다.
export async function createProjectAction(_prev: { error?: string; ok?: boolean }, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  if (!(await projectAccess()).allowed) return { error: "연구회회원만 프로젝트를 만들 수 있어요." };
  const year = Number(fd.get("year"));
  const term = String(fd.get("term") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  const summary = String(fd.get("summary") ?? "").trim();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: "연도를 확인해 주세요." };
  if (!term || !name || name.length > 40 || summary.length > 300) return { error: "학기, 이름(40자), 설명(300자)을 확인해 주세요." };
  await createProject({ year, term, name, summary });
  refresh();
  return { ok: true };
}

// ── 연구회 프로젝트 게시글 ───────────────────────────────────────

export async function createProjectPostAction(_prev: { error?: string; ok?: boolean }, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const access = await projectAccess();
  if (!access.allowed) return { error: "연구회회원만 글을 쓸 수 있어요." };
  if (!rateLimit(`post:${access.member?.id ?? (await clientIp())}`, 20, 60 * 60 * 1000)) {
    return { error: "짧은 시간에 너무 많이 썼어요. 잠시 뒤 다시 시도해 주세요." };
  }
  const result = await createProjectPost({
    projectSlug: String(fd.get("project") ?? ""),
    authorId: access.member?.id ?? null,
    authorName: access.member?.name ?? "운영진",
    title: String(fd.get("title") ?? ""),
    body: String(fd.get("body") ?? ""),
  });
  if ("error" in result) return { error: result.error };
  refresh();
  return { ok: true };
}

// 글쓴이 본인이나 관리자만 지운다.
export async function deleteProjectPostAction(fd: FormData) {
  const access = await projectAccess();
  if (!access.allowed) return;
  await deleteProjectPost(String(fd.get("id") ?? ""), { memberId: access.member?.id ?? null, admin: access.admin });
  refresh();
}

export async function updateMakerAction(fd: FormData) {
  await requireAdmin();
  const name = String(fd.get("name") ?? "").trim().slice(0, 30);
  if (!name) return;
  await updateMaker(String(fd.get("slug") ?? ""), { name, bio: String(fd.get("bio") ?? "").trim().slice(0, 200), member: fd.get("member") === "on" });
  refresh();
}

// 운영진 회원만 다른 회원의 운영진 권한을 바꾼다. 공용 비밀번호 세션으로는 바꾸지 않는다.
export async function setMemberAdminAction(fd: FormData) {
  const inAdmin = fd.get("context") === "admin";
  const member = await requireMember(inAdmin ? "/admin?view=members" : "/account/settings");
  const q = String(fd.get("q") ?? "").slice(0, 60);
  const back = (result: string) => {
    const params = new URLSearchParams({ q, admin: result });
    if (inAdmin) {
      params.set("view", "members");
      const page = Number(fd.get("page"));
      if (Number.isFinite(page) && page > 1) params.set("page", String(Math.floor(page)));
    }
    redirect(`${inAdmin ? "/admin" : "/account/settings"}?${params}#admins`);
  };
  if (!member.isAdmin) back("denied");
  const target = String(fd.get("member") ?? "");
  // 관리자 화면은 역할(일반회원·연구회회원·관리자)을 하나 골라 보낸다.
  const role = fd.get("role");
  if (isRole(role)) {
    if (target === member.id && role !== "admin") back("self");
    const updated = await setMemberRole(target, role);
    if (updated) revalidatePath("/", "layout");
    back(updated ? `role-${role}` : "missing");
  }
  const grant = fd.get("grant") === "1";
  if (target === member.id && !grant) back("self");
  const changed = await setMemberAdmin(target, grant);
  if (changed) revalidatePath("/", "layout");
  back(changed ? (grant ? "granted" : "revoked") : "missing");
}

// 작품 좋아요 — 로그인 없이 브라우저 단위로 한 번만 센다.
// 화면 전체를 다시 그리지 않도록 새 상태만 돌려준다(다시 그리면 조회수가 한 번 더 오른다).
export async function toggleLikeAction(slug: string): Promise<{ liked: boolean; count: number } | null> {
  if (!slug) return null;
  try {
    const liked = await toggleLikeRow(slug, await visitorId());
    return { liked, count: await likeCount(slug) };
  } catch {
    return null;
  }
}

export async function setBookmarkAction(slug: string, on: boolean): Promise<{ bookmarked: boolean; count: number } | null> {
  if (!slug) return null;
  try {
    const bookmarked = await setBookmarkRow(slug, await visitorId(), on);
    return { bookmarked, count: await bookmarkCount(slug) };
  } catch {
    return null;
  }
}

// ── API 토큰 ─────────────────────────────────────────────────────

export async function createApiTokenAction(_prev: { token?: string; error?: string }, fd: FormData): Promise<{ token?: string; error?: string }> {
  const member = await requireMember("/account/settings");
  if ((await listApiTokens(member.id)).length >= 5) return { error: "토큰은 회원당 5개까지 만들 수 있어요. 쓰지 않는 토큰을 폐기해 주세요." };
  return { token: (await createApiToken(member.id, String(fd.get("name") ?? ""))).token };
}

export async function revokeApiTokenAction(fd: FormData) {
  const member = await requireMember("/account/settings");
  await revokeApiToken(member.id, String(fd.get("id") ?? ""));
  refresh();
}

export async function checkLinksAction() {
  await requireAdmin();
  await checkLinks();
  redirect("/admin?checked=1");
}
