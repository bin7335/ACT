// 회원 역할 — 화면과 서버가 함께 쓴다.
// 관리자: 모든 것. 연구회회원: 연구회 프로젝트 열람·생성·게시글. 일반회원: 작품 구경과 업로드.
// 작품 업로드는 관리자만 검수 없이 공개되고, 나머지는 승인을 거친다.

export const ROLES = ["member", "research", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  member: "일반회원",
  research: "연구회회원",
  admin: "관리자",
};

export function roleOf(m: { isAdmin: boolean; isResearch: boolean }): Role {
  return m.isAdmin ? "admin" : m.isResearch ? "research" : "member";
}

export function isRole(value: unknown): value is Role {
  return (ROLES as readonly string[]).includes(value as string);
}
