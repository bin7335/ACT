"use client";

import { useActionState, useEffect, useId, useRef, useState, startTransition, type FormEvent } from "react";
import { AUDIENCES, LINK_KINDS, LINK_LABEL, WORK_PURPOSE_HINT, WORK_PURPOSE_LABEL, WORK_PURPOSES, WORK_TYPE_LABEL, WORK_TYPES } from "@/lib/content/types";
import { MAX_LINKS, type WorkFormState, type WorkFormValues } from "@/lib/content/form";
import { Toast } from "./Toast";
import { Button, Notice } from "./ui";
import { VideoUpload } from "./VideoUpload";
import f from "./form.module.css";

type Props = {
  action: (prev: WorkFormState, fd: FormData) => Promise<WorkFormState>;
  initial: WorkFormValues;
  mode: "create" | "edit";
  projects: { slug: string; name: string; year: number; term: string }[];
  currentThumbnail?: string | null;
  submitLabel: string;
  simple?: boolean;
};

const TYPE_HINT: Record<string, string> = {
  "web-app": "브라우저에서 바로 여는 웹 서비스",
  "mobile-app": "스토어에서 받는 앱",
  video: "YouTube 등에 올린 영상",
  material: "활동지, 슬라이드 등 수업 자료",
  other: "앞의 넷에 해당하지 않는 형태",
};

export function WorkForm({ action, initial, mode, projects, currentThumbnail, submitLabel, simple = false }: Props) {
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState(() => (initial.links.length ? initial.links : [{ kind: "open", url: "" }]).map((l, i) => ({ ...l, id: i })));
  const [linkMode, setLinkMode] = useState<"link" | "file">(initial.links[0]?.kind === "file" ? "file" : "link");
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeThumb, setRemoveThumb] = useState(false);
  const [dirty, setDirty] = useState(false);
  const e = state.errors ?? {};
  const errorCount = Object.keys(e).length;

  useEffect(() => {
    if (errorCount) summaryRef.current?.focus();
  }, [state, errorCount]);

  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.saved) setDirty(false);
  }

  // 저장하지 않은 입력이 있으면 페이지를 떠나기 전에 확인
  useEffect(() => {
    if (!dirty || pending) return;
    const onBeforeUnload = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, pending]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    // action prop 대신 직접 호출해서, 서버 검증에 실패해도 입력(특히 선택한 이미지)이 지워지지 않게 한다.
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    startTransition(() => formAction(fd));
  }

  const err = (k: keyof NonNullable<WorkFormState["errors"]>) =>
    e[k] ? (
      <p className={f.error} id={`${k}-error`}>
        {e[k]}
      </p>
    ) : null;
  const described = (k: string, hint?: boolean) => [hint && `${k}-hint`, e[k as keyof typeof e] && `${k}-error`].filter(Boolean).join(" ") || undefined;
  const thumbShown = preview ?? (removeThumb ? null : currentThumbnail);
  const uid = useId();

  if (simple) return <form action={formAction} onSubmit={onSubmit} onChange={() => setDirty(true)} className={f.form}>
    {errorCount > 0 && <div ref={summaryRef} tabIndex={-1}><Notice tone="danger">{Object.values(e).join(" ")}</Notice></div>}
    {state.saved && <Toast signal={state}>저장했어요.</Toast>}
    <input type="text" name="website" tabIndex={-1} autoComplete="off" className={f.honeypot} aria-hidden />
    <div className={f.field}><label className={f.label} htmlFor={`${uid}-purpose`}>어디에 쓰나요?</label><select id={`${uid}-purpose`} name="purpose" className={f.select} defaultValue={initial.purpose} required><option value="" disabled>선택해 주세요</option>{WORK_PURPOSES.map(u => <option key={u} value={u}>{WORK_PURPOSE_LABEL[u]} — {WORK_PURPOSE_HINT[u]}</option>)}</select></div>
    <div className={f.field}><label className={f.label} htmlFor={`${uid}-type`}>작품 형태</label><select id={`${uid}-type`} name="type" className={f.select} defaultValue={initial.type} required><option value="" disabled>선택해 주세요</option>{WORK_TYPES.map(type => <option key={type} value={type}>{WORK_TYPE_LABEL[type]}</option>)}</select></div>
    <div className={f.field}><label className={f.label} htmlFor={`${uid}-title`}>제목</label><input id={`${uid}-title`} name="title" className={f.input} defaultValue={initial.title} required minLength={2} maxLength={40} /></div>
    <div className={f.field}><label className={f.label} htmlFor={`${uid}-summary`}>한 줄 소개</label><input id={`${uid}-summary`} name="summary" className={f.input} defaultValue={initial.summary} required minLength={5} maxLength={80} /></div>
    <div className={f.field}>
      <span className={f.label}>작품 링크</span>
      <div className={f.checks}>
        <label className={f.check}><input type="radio" name="_link_mode" checked={linkMode === "link"} onChange={() => setLinkMode("link")} />링크로 열기</label>
        <label className={f.check}><input type="radio" name="_link_mode" checked={linkMode === "file"} onChange={() => setLinkMode("file")} />영상 파일로 올리기</label>
      </div>
      {linkMode === "link" ? (
        <input id={`${uid}-url`} name="link_url" type="url" className={f.input} defaultValue={initial.links[0]?.kind === "file" ? "" : initial.links[0]?.url ?? ""} placeholder="https://" required />
      ) : (
        <VideoUpload initialUrl={initial.links[0]?.kind === "file" ? initial.links[0]?.url : ""} />
      )}
    </div>
    <div className={f.field}><label className={f.label} htmlFor={`${uid}-image`}>대표 이미지 <span className={f.hint}>(선택)</span></label><input id={`${uid}-image`} name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className={f.file} onChange={event => { const file = event.target.files?.[0]; setPreview(file ? URL.createObjectURL(file) : null); if (file) setRemoveThumb(false); }} /><p className={f.hint}>5MB 이하. 없으면 작품 링크의 대표 이미지를 가져오고, 그것도 없으면 기본 썸네일로 표시합니다.</p>{thumbShown && <div className={f.thumbPreview}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={thumbShown} alt="대표 이미지 미리보기" /></div>}{currentThumbnail && <label className={f.check}><input type="checkbox" name="remove_thumbnail" checked={removeThumb} onChange={event => setRemoveThumb(event.target.checked)} />기존 이미지 삭제</label>}</div>
    <div className={f.field}><label className={f.label} htmlFor={`${uid}-body`}>상세 설명 <span className={f.hint}>(선택)</span></label><textarea id={`${uid}-body`} name="body" className={f.textarea} rows={4} maxLength={5000} defaultValue={initial.body} placeholder="작품 소개나 사용 방법을 적어 주세요." /></div>
    <Button type="submit" variant="primary" disabled={pending}>{pending ? "저장하는 중…" : submitLabel}</Button>
  </form>;

  return (
    // action은 JS가 아직 로드되지 않았을 때의 POST 대비책. JS가 있으면 onSubmit이 가로챈다(React는 defaultPrevented면 action을 다시 부르지 않는다).
    <form ref={formRef} action={formAction} onSubmit={onSubmit} onChange={() => setDirty(true)} className={f.form}>
      {errorCount > 0 && (
        <div ref={summaryRef} tabIndex={-1} className={f.summaryBox}>
          <Notice tone="danger">
            <strong>{e.form ?? `입력한 내용을 확인해 주세요 (${errorCount}곳).`}</strong>
          </Notice>
        </div>
      )}
      {state.saved && (
        <Toast signal={state}>
          <strong>저장했어요.</strong> {mode === "edit" ? "변경 내용이 반영되었습니다." : ""}
        </Toast>
      )}

      <input type="text" name="website" tabIndex={-1} autoComplete="off" className={f.honeypot} aria-hidden />

      <fieldset className={f.section}>
        <legend className={f.legend}>
          <span className="t-eyebrow">01</span> 어떤 작품인가요?
        </legend>
        <p className={f.label} id="purpose-label">어디에 쓰나요?</p>
        <div className={f.typeGrid} role="radiogroup" aria-labelledby="purpose-label" aria-describedby={described("purpose")}>
          {WORK_PURPOSES.map((u) => (
            <label key={u} className={f.typeOption} data-purpose={u}>
              <input type="radio" name="purpose" value={u} defaultChecked={initial.purpose === u} required />
              <span className={f.typeName}>{WORK_PURPOSE_LABEL[u]}</span>
              <span className={f.typeHint}>{WORK_PURPOSE_HINT[u]}</span>
            </label>
          ))}
        </div>
        {err("purpose")}
        <p className={f.label} id="type-label">어떤 형태인가요?</p>
        <div className={f.typeGrid} role="radiogroup" aria-labelledby="type-label" aria-describedby={described("type")}>
          {WORK_TYPES.map((t) => (
            <label key={t} className={f.typeOption}>
              <input type="radio" name="type" value={t} defaultChecked={initial.type === t} required />
              <span className={f.typeName}>{WORK_TYPE_LABEL[t]}</span>
              <span className={f.typeHint}>{TYPE_HINT[t]}</span>
            </label>
          ))}
        </div>
        {err("type")}
      </fieldset>

      <fieldset className={f.section}>
        <legend className={f.legend}>
          <span className="t-eyebrow">02</span> 기본 정보
        </legend>
        <div className={f.field}>
          <label htmlFor={`${uid}-title`} className={f.label}>
            제목 <span className={f.req}>필수</span>
            <span className={f.counter} data-over={title.length > 40}>
              {title.length}/40
            </span>
          </label>
          <input id={`${uid}-title`} name="title" className={f.input} defaultValue={initial.title} required minLength={2} maxLength={40} onChange={(ev) => setTitle(ev.target.value)} aria-invalid={!!e.title} aria-describedby={described("title")} />
          {err("title")}
        </div>
        <div className={f.field}>
          <label htmlFor={`${uid}-summary`} className={f.label}>
            한 줄 설명 <span className={f.req}>필수</span>
            <span className={f.counter} data-over={summary.length > 80}>
              {summary.length}/80
            </span>
          </label>
          <input id={`${uid}-summary`} name="summary" className={f.input} defaultValue={initial.summary} required minLength={5} maxLength={80} placeholder="예: 피자를 나누며 분수의 크기를 비교하는 교실용 웹앱" onChange={(ev) => setSummary(ev.target.value)} aria-invalid={!!e.summary} aria-describedby={described("summary")} />
          {err("summary")}
        </div>
        <div className={f.field}>
          <label htmlFor={`${uid}-makers`} className={f.label}>
            만든 사람 <span className={f.req}>필수</span>
          </label>
          <p className={f.hint} id="makers-hint">
            여러 명이면 쉼표로 구분해 주세요. 이미 등록된 이름과 같으면 같은 제작자 페이지에 모입니다. 닉네임도 괜찮아요.
          </p>
          <input id={`${uid}-makers`} name="makers" className={f.input} defaultValue={initial.makers} required maxLength={200} placeholder="예: 김하늘, 이도윤" aria-invalid={!!e.makers} aria-describedby={described("makers", true)} />
          {err("makers")}
        </div>
      </fieldset>

      <fieldset className={f.section}>
        <legend className={f.legend}>
          <span className="t-eyebrow">03</span> 작품 링크
        </legend>
        <p className={f.hint} id="links-hint">
          첫 번째 링크가 카드의 「바로 열기」 버튼이 됩니다. 앱은 스토어 링크를, 영상은 YouTube 링크를 넣거나 종류를 「영상 파일」로 바꿔 직접 올릴 수 있어요.
        </p>
        <div className={f.links}>
          {links.map((l, i) => (
            <div key={l.id} className={f.linkRow}>
              <label className="visually-hidden" htmlFor={`${uid}-lk-${l.id}`}>
                링크 {i + 1} 종류
              </label>
              <select
                id={`${uid}-lk-${l.id}`}
                name="link_kind"
                value={l.kind}
                className={f.select}
                onChange={(ev) => {
                  const kind = ev.target.value;
                  setLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, kind, url: "" } : x)));
                }}
              >
                {LINK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LINK_LABEL[k]}
                  </option>
                ))}
              </select>
              {l.kind === "file" ? (
                <VideoUpload initialUrl={l.url} />
              ) : (
                <>
                  <label className="visually-hidden" htmlFor={`${uid}-lu-${l.id}`}>
                    링크 {i + 1} 주소
                  </label>
                  <input id={`${uid}-lu-${l.id}`} name="link_url" type="url" inputMode="url" defaultValue={l.url} placeholder="https://" className={f.input} required={i === 0} aria-invalid={!!e.links} aria-describedby={described("links", true)} />
                </>
              )}
              {links.length > 1 && (
                <button type="button" className={f.iconBtn} aria-label={`링크 ${i + 1} 삭제`} onClick={() => setLinks((ls) => ls.filter((x) => x.id !== l.id))}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {links.length < MAX_LINKS && (
          <button type="button" className={f.addBtn} onClick={() => setLinks((ls) => [...ls, { kind: "source", url: "", id: Math.max(...ls.map((x) => x.id)) + 1 }])}>
            + 링크 추가
          </button>
        )}
        {err("links")}
      </fieldset>

      <fieldset className={f.section}>
        <legend className={f.legend}>
          <span className="t-eyebrow">04</span> 누구를 위한 작품인가요?
        </legend>
        <div className={f.checks} aria-describedby={described("audience")}>
          {AUDIENCES.map((a) => (
            <label key={a} className={f.check}>
              <input type="checkbox" name="audience" value={a} defaultChecked={initial.audience.includes(a)} />
              {a}
            </label>
          ))}
        </div>
        {err("audience")}
        <div className={f.field}>
          <label htmlFor={`${uid}-subjects`} className={f.label}>
            교과·영역
          </label>
          <p className={f.hint} id="subjects-hint">
            쉼표로 구분, 5개까지. 예: 수학, 학급 운영
          </p>
          <input id={`${uid}-subjects`} name="subjects" className={f.input} defaultValue={initial.subjects} maxLength={120} aria-invalid={!!e.subjects} aria-describedby={described("subjects", true)} />
          {err("subjects")}
        </div>
        {projects.length > 0 && (
          <div className={f.field}>
            <label htmlFor={`${uid}-project`} className={f.label}>
              연구회 프로젝트
            </label>
            <select id={`${uid}-project`} name="project" defaultValue={initial.project} className={f.select}>
              <option value="">해당 없음</option>
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.year} {p.term} · {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <fieldset className={f.section}>
        <legend className={f.legend}>
          <span className="t-eyebrow">05</span> 썸네일
        </legend>
        <div className={f.thumbRow}>
          <div className={f.thumbPreview}>{thumbShown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbShown} alt="" />
          ) : <span>16:10 미리보기</span>}</div>
          <div className={f.thumbFields}>
            <p className={f.hint} id="thumbnail-hint">
              JPG·PNG·WebP, 5MB 이하. 16:10으로 잘려서 보여요. 없으면 제목으로 썸네일을 만들어 드려요. 사진 속 위치 정보는 자동으로 지워집니다.
            </p>
            <input
              name="thumbnail"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={f.file}
              aria-describedby={described("thumbnail", true)}
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                if (preview) URL.revokeObjectURL(preview);
                setPreview(file ? URL.createObjectURL(file) : null);
                if (file) setRemoveThumb(false);
              }}
            />
            {currentThumbnail && !preview && (
              <label className={f.check}>
                <input type="checkbox" name="remove_thumbnail" checked={removeThumb} onChange={(ev) => setRemoveThumb(ev.target.checked)} />
                지금 썸네일 지우기
              </label>
            )}
            <label htmlFor={`${uid}-alt`} className={f.label}>
              이미지 설명 (화면 낭독기용)
            </label>
            <input id={`${uid}-alt`} name="thumbnail_alt" className={f.input} defaultValue={initial.thumbnailAlt} maxLength={120} placeholder="예: 피자 그림 네 개가 조각으로 나뉜 수업 화면" />
          </div>
        </div>
        {err("thumbnail")}
      </fieldset>

      <fieldset className={f.section}>
        <legend className={f.legend}>
          <span className="t-eyebrow">06</span> 자세한 설명
        </legend>
        <p className={f.hint} id="body-hint">
          만든 이유, 사용 방법, 수업 활용 예를 적어 주세요. 빈 줄로 문단을 나누고, 「## 」로 시작하면 소제목, 「- 」로 시작하면 목록이 됩니다.
        </p>
        <textarea name="body" className={f.textarea} rows={12} defaultValue={initial.body} maxLength={5000} placeholder={"## 만든 이유\n\n## 사용 방법\n\n## 수업 활용 예"} aria-describedby={described("body", true)} />
        {err("body")}
      </fieldset>

      <fieldset className={f.section}>
        <legend className={f.legend}>
          <span className="t-eyebrow">07</span> {mode === "create" ? "제출 전 확인" : "연락처"}
        </legend>
        <div className={f.field}>
          <label htmlFor={`${uid}-email`} className={f.label}>
            연락받을 이메일 (선택, 공개되지 않음)
          </label>
          <p className={f.hint} id="contactEmail-hint">
            검수 중 확인할 것이 있을 때만 운영진이 연락드려요.
          </p>
          <input id={`${uid}-email`} name="contact_email" type="email" className={f.input} defaultValue={initial.contactEmail} maxLength={120} autoComplete="email" aria-invalid={!!e.contactEmail} aria-describedby={described("contactEmail", true)} />
          {err("contactEmail")}
        </div>
        {mode === "create" && (
          <>
            <label className={`${f.check} ${f.consent}`}>
              <input type="checkbox" name="privacy" required aria-invalid={!!e.privacy} aria-describedby={described("privacy")} />
              <span>
                <strong>썸네일·영상·설명에 학생 이름, 얼굴, 학교 등 학생을 알아볼 수 있는 정보가 없습니다.</strong> 운영진 검수 뒤 공개되는 것에 동의합니다.
              </span>
            </label>
            {err("privacy")}
          </>
        )}
      </fieldset>

      <div className={f.submitBar}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "저장하는 중…" : submitLabel}
        </Button>
        {mode === "create" && <p className={f.hint}>제출한 작품은 마이페이지에서 관리할 수 있어요.</p>}
      </div>
    </form>
  );
}
