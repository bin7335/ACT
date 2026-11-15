// 영상 파일 업로드 규칙. 클라이언트(사전 확인·진행 표시)와 서버(저장·검증)가 함께 쓴다.

/**
 * 한 파일 최대 크기. 앞단에 Cloudflare 무료 요금제가 있으면 요청 본문이 100MB를 넘을 때
 * 엣지에서 먼저 거절하므로 여유를 둔다. 리버스 프록시의 본문 크기 제한도 함께 맞춘다.
 */
export const MAX_VIDEO_MB = 90;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export const VIDEO_EXTENSIONS = ["mp4", "webm"] as const;
export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];

/** 업로드된 영상의 공개 경로. 파일명은 서버가 만든 UUID만 받는다. */
export const VIDEO_PATH_RE = /^\/media\/video\/[0-9a-f-]{36}\.(mp4|webm)$/;

export const VIDEO_MIME: Record<VideoExtension, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
};

export function isVideoPath(url: string): boolean {
  return VIDEO_PATH_RE.test(url);
}

export function videoExtensionOf(url: string): VideoExtension | null {
  const m = url.match(/\.(mp4|webm)$/);
  return m ? (m[1] as VideoExtension) : null;
}

export function videoFileName(url: string): string {
  return url.split("/").pop() ?? "";
}
