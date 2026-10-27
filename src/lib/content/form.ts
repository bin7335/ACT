import { z } from "zod";
import { AUDIENCES, LINK_KINDS, WORK_TYPES } from "./types";

// 작품 등록/수정 폼 — 클라이언트(폼 상태)와 서버(검증)가 함께 쓴다.

export const MAX_LINKS = 4;

export type WorkFormValues = {
  type: string;
  title: string;
  summary: string;
  body: string;
  links: { kind: string; url: string }[];
  audience: string[];
  subjects: string;
  makers: string;
  project: string;
  thumbnailAlt: string;
  contactEmail: string;
};

export type WorkFormState = {
  values: WorkFormValues;
  errors?: Partial<Record<keyof WorkFormValues | "thumbnail" | "privacy" | "form", string>>;
  saved?: boolean;
};

export const emptyValues: WorkFormValues = {
  type: "",
  title: "",
  summary: "",
  body: "",
  links: [{ kind: "open", url: "" }],
  audience: [],
  subjects: "",
  makers: "",
  project: "",
  thumbnailAlt: "",
  contactEmail: "",
};

const list = (s: string) =>
  s
    .split(/[,，、\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

const httpUrl = z
  .string()
  .trim()
  .max(500, "주소가 너무 길어요.")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "http:// 또는 https://로 시작하는 전체 주소를 넣어 주세요.");

export const workSchema = z.object({
  type: z.enum(WORK_TYPES, { error: "작품 유형을 골라 주세요." }),
  title: z.string().trim().min(2, "제목을 2자 이상 써 주세요.").max(40, "제목은 40자 이내로 써 주세요."),
  summary: z.string().trim().min(5, "한 줄 설명을 써 주세요.").max(80, "한 줄 설명은 80자 이내로 써 주세요."),
  body: z.string().trim().max(5000, "설명은 5000자 이내로 써 주세요."),
  links: z
    .array(z.object({ kind: z.enum(LINK_KINDS), url: httpUrl }))
    .min(1, "작품을 열 수 있는 링크를 하나 이상 넣어 주세요.")
    .max(MAX_LINKS),
  audience: z.array(z.enum(AUDIENCES)).min(1, "대상을 하나 이상 골라 주세요."),
  subjects: z.array(z.string().max(20, "교과·영역 이름은 20자 이내로 써 주세요.")).max(5, "교과·영역은 5개까지 넣을 수 있어요."),
  makers: z.array(z.string().max(30)).min(1, "만든 사람 이름을 넣어 주세요.").max(6, "만든 사람은 6명까지 넣을 수 있어요."),
  project: z.string().trim().max(80),
  thumbnailAlt: z.string().trim().max(120, "이미지 설명은 120자 이내로 써 주세요."),
  contactEmail: z.union([z.literal(""), z.email("이메일 주소 형식을 확인해 주세요.").max(120)]),
});

export type WorkInput = z.infer<typeof workSchema>;

export function readWorkForm(fd: FormData): WorkFormValues {
  const str = (k: string) => String(fd.get(k) ?? "");
  const kinds = fd.getAll("link_kind").map(String);
  const urls = fd.getAll("link_url").map(String);
  return {
    type: str("type"),
    title: str("title"),
    summary: str("summary"),
    body: str("body"),
    links: kinds.slice(0, MAX_LINKS).map((kind, i) => ({ kind, url: urls[i] ?? "" })),
    audience: fd.getAll("audience").map(String),
    subjects: str("subjects"),
    makers: str("makers"),
    project: str("project"),
    thumbnailAlt: str("thumbnail_alt"),
    contactEmail: str("contact_email"),
  };
}

export function validateWork(values: WorkFormValues) {
  const parsed = workSchema.safeParse({
    ...values,
    links: values.links.filter((l) => l.url.trim()).map((l) => ({ ...l, url: l.url.trim() })),
    subjects: [...new Set(list(values.subjects))],
    makers: [...new Set(list(values.makers))],
  });
  if (parsed.success) return { data: parsed.data } as const;
  const errors: WorkFormState["errors"] = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0]) as keyof NonNullable<WorkFormState["errors"]>;
    errors[key] ??= issue.message;
  }
  return { errors } as const;
}

export function valuesFromWork(w: {
  type: string;
  title: string;
  summary: string;
  body: string;
  links: { kind: string; url: string }[];
  audience: string[];
  subjects: string[];
  makers: { name: string }[];
  project: { slug: string } | null;
  thumbnailAlt: string | null;
  contactEmail?: string | null;
}): WorkFormValues {
  return {
    type: w.type,
    title: w.title,
    summary: w.summary,
    body: w.body,
    links: w.links.length ? w.links : [{ kind: "open", url: "" }],
    audience: w.audience,
    subjects: w.subjects.join(", "),
    makers: w.makers.map((m) => m.name).join(", "),
    project: w.project?.slug ?? "",
    thumbnailAlt: w.thumbnailAlt ?? "",
    contactEmail: w.contactEmail ?? "",
  };
}
