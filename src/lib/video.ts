// 영상 파일 업로드 규칙. 클라이언트(사전 확인·진행 표시)와 서버(저장·검증)가 함께 쓴다.

/**
 * 한 파일 최대 크기. 앞단에 Cloudflare 무료 요금제가 있으면 요청 본문이 100MB를 넘을 때
 * 엣지에서 먼저 거절하므로 여유를 둔다. 리버스 프록시의 본문 크기 제한도 함께 맞춘다.
 */
export const MAX_VIDEO_MB = 90;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

/**
 * 올리기 전에 브라우저에서 압축하므로, 고르는 원본은 저장 상한보다 커도 된다.
 * 압축 결과만 MAX_VIDEO_BYTES 안에 들어오면 된다.
 */
export const MAX_VIDEO_SOURCE_MB = 2048;
export const MAX_VIDEO_SOURCE_BYTES = MAX_VIDEO_SOURCE_MB * 1024 * 1024;

const COMPRESS_LONG_SIDE = 1920;
const COMPRESS_SHORT_SIDE = 1080;
const COMPRESS_AUDIO_BITRATE = 128_000;
const COMPRESS_MIN_VIDEO_BITRATE = 400_000;
export const COMPRESS_MAX_FPS = 30;

export type CompressionPlan =
  | { action: "keep" }
  | { action: "too-long" }
  | { action: "compress"; width: number; height: number; videoBitrate: number; audioBitrate: number };

/** 짧은 변 기준 화질 단계별 목표 비트레이트(H.264, 30fps 기준). */
function targetVideoBitrate(shortSide: number): number {
  if (shortSide <= 480) return 1_200_000;
  if (shortSide <= 720) return 2_500_000;
  return 4_500_000;
}

/**
 * 원본의 크기·길이·해상도로 압축 방법을 정한다.
 * - 저장 상한 안에 들어오고 그대로 재생되는 파일은 건드리지 않는다(keep). 압축은 상한에 걸릴 때만 한다.
 * - 상한을 넘으면 1080p 이하로 줄이고, 화질 단계에 맞는 비트레이트로 다시 인코딩한다.
 * - 길어서 그 비트레이트로도 상한을 넘으면 상한에 맞게 비트레이트를 더 낮춘다.
 */
export function planCompression(src: { bytes: number; duration: number; width: number; height: number; hasAudio: boolean; playable: boolean }): CompressionPlan {
  const long = Math.max(src.width, src.height);
  const short = Math.min(src.width, src.height);
  const scale = Math.min(1, COMPRESS_LONG_SIDE / long, COMPRESS_SHORT_SIDE / short);
  // H.264는 짝수 해상도만 받는다.
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  const width = even(src.width);
  const height = even(src.height);
  const audioBitrate = src.hasAudio ? COMPRESS_AUDIO_BITRATE : 0;
  const target = targetVideoBitrate(Math.min(width, height));

  if (src.playable && src.bytes <= MAX_VIDEO_BYTES) return { action: "keep" };
  const duration = Math.max(src.duration, 0.1);

  // 컨테이너 오버헤드와 인코더 오차를 감안해 상한의 92%를 예산으로 잡는다.
  const budget = Math.floor((MAX_VIDEO_BYTES * 8 * 0.92) / duration) - audioBitrate;
  if (budget < COMPRESS_MIN_VIDEO_BITRATE) return { action: "too-long" };
  return { action: "compress", width, height, videoBitrate: Math.min(target, budget), audioBitrate };
}

export const VIDEO_EXTENSIONS =["mp4", "webm"] as const;
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
