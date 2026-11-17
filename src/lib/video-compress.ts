// 브라우저 전용. 올리기 전에 영상을 WebCodecs로 다시 인코딩해 용량을 줄인다.
// 서버(Workers)에서는 영상 인코딩을 돌릴 수 없으므로 압축은 올리는 사람의 기기에서 한다.
import { COMPRESS_MAX_FPS, MAX_VIDEO_BYTES, MAX_VIDEO_MB, planCompression } from "./video";

/** 사용자에게 그대로 보여 줄 수 있는 실패. */
export class VideoCompressError extends Error {
  override name = "VideoCompressError";
}

export type CompressOutcome = {
  /** 서버로 보낼 본문. 압축하지 않았으면 원본 파일 그대로다. */
  blob: Blob;
  compressed: boolean;
};

type Options = {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

/** 압축 없이 그대로 올려도 서버가 받아 주고 브라우저에서 재생되는 형식인지. */
function isDirectlyUploadable(file: File): boolean {
  return file.type === "video/mp4" || file.type === "video/webm" || /\.(mp4|webm)$/i.test(file.name);
}

/**
 * 영상을 필요한 만큼 압축한다. 압축할 필요가 없거나, 이 브라우저가 변환을 지원하지 않는데
 * 원본을 그대로 올릴 수 있으면 원본을 돌려준다. 어느 쪽도 안 되면 VideoCompressError를 던진다.
 * 취소되면 signal의 AbortError를 던진다.
 */
export async function compressVideo(file: File, { onProgress, signal }: Options = {}): Promise<CompressOutcome> {
  const original: CompressOutcome = { blob: file, compressed: false };
  const fallback = (message: string): CompressOutcome => {
    if (isDirectlyUploadable(file) && file.size <= MAX_VIDEO_BYTES) return original;
    throw new VideoCompressError(message);
  };
  const unsupported = `이 브라우저에서는 영상을 압축할 수 없어요. 최신 Chrome·Edge·Safari에서 올리거나 ${MAX_VIDEO_MB}MB 이하 MP4로 올려 주세요.`;

  // 상한 안에 들어오는 MP4·WebM은 변환 라이브러리를 불러오지도 않고 그대로 올린다.
  if (isDirectlyUploadable(file) && file.size <= MAX_VIDEO_BYTES) return original;

  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return fallback(unsupported);

  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import("mediabunny");
  signal?.throwIfAborted();

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack().catch(() => null);
    if (!video) return fallback("영상을 읽을 수 없어요. MP4·MOV·WebM 파일인지 확인해 주세요.");
    const audio = await input.getPrimaryAudioTrack().catch(() => null);
    const [width, height, duration] = await Promise.all([video.getDisplayWidth(), video.getDisplayHeight(), input.computeDuration()]);

    const plan = planCompression({ bytes: file.size, duration, width, height, hasAudio: !!audio, playable: isDirectlyUploadable(file) });
    if (plan.action === "keep") return original;
    if (plan.action === "too-long") {
      throw new VideoCompressError(`영상이 너무 길어서 ${MAX_VIDEO_MB}MB 안으로 줄일 수 없어요. 더 짧게 자르거나 YouTube 링크로 올려 주세요.`);
    }

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { width: plan.width, height: plan.height, fit: "contain", frameRate: COMPRESS_MAX_FPS, bitrate: plan.videoBitrate, forceTranscode: true },
      audio: { bitrate: plan.audioBitrate || undefined },
      showWarnings: false,
    });
    // 화면이나 소리 트랙을 이 브라우저가 변환하지 못하면, 한쪽이 빠진 영상을 올리지 않는다.
    const kept = new Set(conversion.utilizedTracks.map((t) => t.type));
    if (!conversion.isValid || !kept.has("video") || (audio && !kept.has("audio"))) return fallback(unsupported);

    conversion.onProgress = (p) => onProgress?.(Math.min(100, Math.round(p * 100)));
    const onAbort = () => void conversion.cancel().catch(() => {});
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      signal?.throwIfAborted();
      await conversion.execute();
    } catch (error) {
      signal?.throwIfAborted();
      console.error("video compression failed", error);
      return fallback("영상을 압축하지 못했어요. 다른 파일로 시도해 주세요.");
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }

    const buffer = target.buffer;
    if (!buffer) return fallback("영상을 압축하지 못했어요. 다른 파일로 시도해 주세요.");
    // 다시 인코딩했는데 오히려 커졌다면 원본이 낫다.
    if (buffer.byteLength >= file.size && isDirectlyUploadable(file) && file.size <= MAX_VIDEO_BYTES) return original;
    if (buffer.byteLength > MAX_VIDEO_BYTES) {
      throw new VideoCompressError(`압축해도 ${MAX_VIDEO_MB}MB를 넘어요. 더 짧게 자르거나 YouTube 링크로 올려 주세요.`);
    }
    return { blob: new Blob([buffer], { type: "video/mp4" }), compressed: true };
  } finally {
    input.dispose();
  }
}
