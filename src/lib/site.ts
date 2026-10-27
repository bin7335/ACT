// 연구회 공식 명칭이 정해지면 여기만 바꾼다 (CONSTITUTION.md 머리말).
export const site = {
  shortName: "ACT",
  name: "선생님 작품 아카이브",
  description: "선생님들이 직접 만든 웹 도구, 웹앱, 모바일 앱, 영상, 수업 자료를 모은 연구회 아카이브",
  url: (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};
