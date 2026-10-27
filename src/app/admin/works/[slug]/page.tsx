import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminEditWorkAction, deleteWorkAction, setStatusAction } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Prose } from "@/components/Prose";
import { SectionHeader } from "@/components/SectionHeader";
import { Thumbnail } from "@/components/Thumbnail";
import { Button, Notice, StatusLabel } from "@/components/ui";
import { WorkForm } from "@/components/WorkForm";
import f from "@/components/form.module.css";
import p from "@/components/page.module.css";
import { requireAdmin } from "@/lib/admin";
import { valuesFromWork } from "@/lib/content/form";
import { getAnyWork, listProjectOptions } from "@/lib/content/queries";
import { LINK_LABEL } from "@/lib/content/types";
import { formatDate } from "@/lib/format";
import s from "../../admin.module.css";

export const metadata: Metadata = { title: "작품 검수", robots: { index: false, follow: false } };

export default async function AdminWorkPage(props: PageProps<"/admin/works/[slug]">) {
  await requireAdmin();
  const { slug } = await props.params;
  const work = await getAnyWork(slug);
  if (!work) notFound();
  const projects = await listProjectOptions();

  return (
    <div className={`container ${p.page}`}>
      <Link href="/admin" className={s.headLink}>
        ← 목록으로
      </Link>
      <SectionHeader eyebrow={`REVIEW / ${work.slug}`} title={work.title} description={work.summary} />

      <div className={s.reviewGrid}>
        <div className={s.reviewMain}>
          <div className={s.preview}>
            <Thumbnail src={work.thumbnail} alt={work.thumbnailAlt} title={work.title} type={work.type} sizes="640px" />
          </div>
          <ul className={s.links}>
            {work.links.map((l) => (
              <li key={l.url}>
                <span className={s.sub}>{LINK_LABEL[l.kind]}</span>{" "}
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                  {l.url} ↗
                </a>
              </li>
            ))}
          </ul>
          <Prose text={work.body || "(설명 없음)"} />
        </div>

        <aside className={s.reviewAside}>
          <div className={s.statusRow}>
            <StatusLabel status={work.status} />
            {work.status === "published" && <Link href={`/works/${work.slug}`}>공개 페이지 →</Link>}
          </div>
          <dl className={s.facts}>
            <dt>만든 사람</dt>
            <dd>{work.makers.map((m) => m.name).join(", ")}</dd>
            <dt>대상</dt>
            <dd>{work.audience.join(", ")}</dd>
            <dt>연락처</dt>
            <dd>{work.contactEmail ? <a href={`mailto:${work.contactEmail}`}>{work.contactEmail}</a> : "없음"}</dd>
            <dt>제출일</dt>
            <dd className="t-mono">{formatDate(work.createdAt)}</dd>
          </dl>
          <Notice>학생 이름·얼굴·학교 등 식별 정보가 썸네일, 영상, 설명에 없는지 꼭 확인해 주세요.</Notice>

          <form action={setStatusAction} className={f.form} style={{ gap: 12 }}>
            <input type="hidden" name="slug" value={work.slug} />
            <input type="hidden" name="back" value={`/admin/works/${work.slug}`} />
            <label className={f.label} htmlFor="note">
              운영진 메모 (반려 사유는 제출자의 수정 화면에 보여요)
            </label>
            <textarea id="note" name="note" className={f.textarea} rows={3} defaultValue={work.reviewNote ?? ""} maxLength={500} />
            <div className={s.statusBtns}>
              {work.status !== "published" && (
                <Button type="submit" name="status" value="published" variant="primary">
                  공개하기
                </Button>
              )}
              {work.status !== "hidden" && (
                <Button type="submit" name="status" value="hidden">
                  {work.status === "published" ? "숨기기" : "반려(숨김)"}
                </Button>
              )}
              {work.status !== "review" && (
                <Button type="submit" name="status" value="review" variant="ghost">
                  검수 대기로
                </Button>
              )}
            </div>
          </form>

          <form action={deleteWorkAction}>
            <input type="hidden" name="slug" value={work.slug} />
            <ConfirmButton message={`「${work.title}」을(를) 완전히 삭제할까요? 되돌릴 수 없습니다.`}>영구 삭제</ConfirmButton>
          </form>
        </aside>
      </div>

      <details className={s.editBox}>
        <summary>내용 직접 고치기</summary>
        <WorkForm
          action={adminEditWorkAction.bind(null, work.slug)}
          initial={valuesFromWork(work)}
          mode="edit"
          projects={projects}
          currentThumbnail={work.thumbnail}
          submitLabel="저장"
        />
      </details>
    </div>
  );
}
