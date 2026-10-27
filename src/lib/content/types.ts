// 콘텐츠 모델 — CONSTITUTION.md §4

export const WORK_TYPES = ["web-tool", "web-app", "mobile-app", "video", "material"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  "web-tool": "웹 도구",
  "web-app": "웹앱",
  "mobile-app": "모바일 앱",
  video: "영상",
  material: "수업 자료",
};

export const AUDIENCES = ["유아", "초등 저", "초등 중", "초등 고", "중등", "교사 업무"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const LINK_KINDS = ["open", "store-ios", "store-android", "youtube", "source"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_LABEL: Record<LinkKind, string> = {
  open: "바로 열기",
  "store-ios": "App Store",
  "store-android": "Google Play",
  youtube: "YouTube에서 보기",
  source: "소스 코드",
};

export type WorkLink = { kind: LinkKind; url: string };

export type WorkStatus = "draft" | "review" | "published" | "hidden";

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  draft: "임시 저장",
  review: "검수 대기",
  published: "공개",
  hidden: "숨김",
};

export type MakerRef = { slug: string; name: string };

export type WorkSummary = {
  slug: string;
  type: WorkType;
  title: string;
  summary: string;
  thumbnail: string | null;
  thumbnailAlt: string | null;
  audience: string[];
  subjects: string[];
  makers: MakerRef[];
  primaryLink: WorkLink | null;
  status: WorkStatus;
  publishedAt: Date | null;
  updatedAt: Date;
  linkBroken: boolean;
};

export type WorkDetail = WorkSummary & {
  body: string;
  links: WorkLink[];
  project: { slug: string; name: string; year: number; term: string } | null;
  ownerId: string | null;
  reviewNote: string | null;
  /** 비공개. 운영진·수정 링크 화면에서만 쓴다. */
  contactEmail: string | null;
  createdAt: Date;
  linkCheckedAt: Date | null;
};

// 개발 시드 전용 입력 형식
export type Work = {
  slug: string;
  type: WorkType;
  title: string;
  summary: string;
  body: string[];
  links: WorkLink[];
  audience: Audience[];
  subjects: string[];
  makers: string[];
  project?: string;
  status: WorkStatus;
  createdAt: string;
  updatedAt: string;
  linkCheckedAt?: string;
  linkBroken?: boolean;
};

export type Maker = {
  slug: string;
  name: string;
  bio: string;
  member: boolean;
  links: { label: string; url: string }[];
};

export type Project = {
  slug: string;
  year: number;
  term: string;
  name: string;
  summary: string;
};
