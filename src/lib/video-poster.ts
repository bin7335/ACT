// 브라우저 전용. 올리는 영상에서 한 장면을 뽑아 대표 이미지 후보(JPEG)로 만든다.

const POSTER_LONG_SIDE = 1280;
const TIMEOUT_MS = 15_000;

/** 폼에서 이 이름의 파일 필드로 함께 제출한다. 서버는 대표 이미지가 없을 때만 쓴다. */
export const VIDEO_POSTER_FIELD = "video_poster";

/**
 * 영상 앞부분(길이의 10%, 최대 3초 지점)의 프레임을 JPEG 파일로 돌려준다.
 * 맨 첫 프레임은 검은 화면이나 페이드인인 경우가 많아 조금 뒤를 고른다.
 * 이 브라우저가 영상을 풀지 못하면 null — 대표 이미지는 기본값으로 남는다.
 */
export async function captureVideoPoster(source: Blob): Promise<File | null> {
  const url = URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const once = (event: string) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${event} timeout`)), TIMEOUT_MS);
        video.addEventListener(event, () => (clearTimeout(timer), resolve()), { once: true });
        video.addEventListener("error", () => (clearTimeout(timer), reject(video.error ?? new Error("video error"))), { once: true });
      });

    const loaded = once("loadeddata");
    video.src = url;
    await loaded;
    if (!video.videoWidth || !video.videoHeight) return null;

    const at = Number.isFinite(video.duration) ? Math.min(video.duration * 0.1, 3) : 0;
    if (at > 0.05) {
      const seeked = once("seeked");
      video.currentTime = at;
      await seeked;
    }

    const scale = Math.min(1, POSTER_LONG_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "video-poster.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
