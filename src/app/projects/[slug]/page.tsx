import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProjectPostAction } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Prose } from "@/components/Prose";
import { SectionHeader } from "@/components/SectionHeader";
import { WorkGrid } from "@/components/WorkCard";
import p from "@/components/page.module.css";
import { listProjectPosts, POST_BODY_MAX, POST_TITLE_MAX } from "@/lib/content/posts";
import { getProject } from "@/lib/content/queries";
import { reactionProps } from "@/lib/content/stats";
import { formatDate } from "@/lib/format";
import { projectGate, ProjectsRestricted } from "../access";
import s from "../projects.module.css";
import { PostForm } from "./PostForm";

// 연구회회원 전용이라 프로젝트 이름을 제목·검색 결과에 내보내지 않는다.
export const metadata: Metadata = { title: "연구회 프로젝트", robots: { index: false, follow: false } };

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  const { slug } = await props.params;
  const access = await projectGate(`/projects/${slug}`);
  if (!access) {
    return (
      <div className={`container ${p.page}`}>
        <ProjectsRestricted />
      </div>
    );
  }
  const data = await getProject(slug);
  if (!data) notFound();
  const { project, works, makers } = data;
  const posts = listProjectPosts(project.slug);
  return (
    <div className={`container ${p.page}`}>
      <SectionHeader
        title={project.name}
        description={
          <>
            {project.summary}
            {makers.length > 0 && (
              <span style={{ display: "block", marginTop: 8, fontSize: 14, color: "var(--color-text-tertiary)" }}>
                참여:{" "}
                {makers.map((m, i) => (
                  <span key={m.slug}>
                    {i > 0 && ", "}
                    <Link href={`/makers/${m.slug}`} style={{ color: "var(--color-text-primary)" }}>
                      {m.name}
                    </Link>
                  </span>
                ))}
              </span>
            )}
          </>
        }
      />
      {works.length ? <WorkGrid works={works} reactions={await reactionProps(works.map((w) => w.slug))} /> : <p className={p.empty}>아직 공개된 결과물이 없어요.</p>}

      <section className={p.section} aria-labelledby="posts">
        <div className={p.sectionHead}>
          <h2 id="posts" className="t-h2">
            게시글 {posts.length}
          </h2>
        </div>
        {posts.length ? (
          <ul className={s.posts}>
            {posts.map((post) => (
              <li key={post.id} className={s.post}>
                <div className={s.postHead}>
                  <h3 className="t-h3">{post.title}</h3>
                  <span className={s.postMeta}>
                    {post.authorName} · {formatDate(post.createdAt)}
                  </span>
                  {(access.admin || (!!access.member && post.authorId === access.member.id)) && (
                    <form action={deleteProjectPostAction} className={s.postDelete}>
                      <input type="hidden" name="id" value={post.id} />
                      <ConfirmButton message={`「${post.title}」 글을 지울까요? 되돌릴 수 없어요.`}>삭제</ConfirmButton>
                    </form>
                  )}
                </div>
                <Prose text={post.body} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.postEmpty}>아직 올라온 글이 없어요. 첫 글을 남겨 보세요.</p>
        )}
        <PostForm slug={project.slug} titleMax={POST_TITLE_MAX} bodyMax={POST_BODY_MAX} />
      </section>
    </div>
  );
}
