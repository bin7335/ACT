import "server-only";
import { getImages, getUploads } from "./db";
import { MAX_VIDEO_BYTES, MAX_VIDEO_MB, VIDEO_MIME, type VideoExtension } from "./video";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPT = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export class UploadError extends Error {}

/** 업로드 파일은 R2 버킷에 둔다. 공개 경로(/media/…)와 R2 키 사이의 대응. */
const THUMB_KEY = (id: string, small = false) => `thumbs/${id}${small ? "-640" : ""}.webp`;
export const VIDEO_KEY = (file: string) => `videos/${file}`;
export const THUMB_FILE_RE = /^([0-9a-f-]{36})(-640)?\.webp$/;

const streamOf = (bytes: Uint8Array) => new Blob([bytes as BlobPart]).stream();

/** 16:10으로 잘라 1280w / 640w WebP 두 장을 저장하고 공개 경로를 돌려준다. 메타데이터(EXIF·GPS)는 제거된다. */
export async function saveThumbnail(file: File): Promise<string> {
  if (!ACCEPT.has(file.type)) throw new UploadError("JPG, PNG, WebP, GIF 이미지만 올릴 수 있어요.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("이미지는 5MB 이하로 올려 주세요.");
  return saveThumbnailBytes(new Uint8Array(await file.arrayBuffer()));
}

/** 바이트로 받은 이미지를 썸네일로 저장한다. 형식은 헤더가 아니라 실제 내용으로 확인한다. */
export async function saveThumbnailBytes(input: Uint8Array): Promise<string> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("이미지는 5MB 이하로 올려 주세요.");
  const id = crypto.randomUUID();
  try {
    const images = getImages();
    const info = await images.info(streamOf(input));
    if (!("width" in info) || !info.width || !info.height || !ACCEPT.has(info.format) || info.width * info.height > 40_000_000) throw new Error();
    const render = async (width: number, height: number, quality: number) => {
      const out = await images.input(streamOf(input)).transform({ width, height, fit: "cover", gravity: "auto" }).output({ format: "image/webp", quality });
      return new Uint8Array(await new Response(out.image()).arrayBuffer());
    };
    const [large, small] = await Promise.all([render(1280, 800, 82), render(640, 400, 78)]);
    const bucket = getUploads();
    const httpMetadata = { contentType: "image/webp" };
    await Promise.all([bucket.put(THUMB_KEY(id), large, { httpMetadata }), bucket.put(THUMB_KEY(id, true), small, { httpMetadata })]);
  } catch {
    throw new UploadError("이미지를 읽을 수 없어요. 다른 파일로 시도해 주세요.");
  }
  return `/media/${id}.webp`;
}

export async function deleteThumbnail(publicPath: string | null) {
  const m = publicPath?.match(/^\/media\/([0-9a-f-]{36})\.webp$/);
  if (!m) return;
  await getUploads().delete([THUMB_KEY(m[1]), THUMB_KEY(m[1], true)]).catch(() => {});
}

// ── 영상 파일 ────────────────────────────────────────────────────

/** 파일 앞부분(컨테이너 시그니처)으로 실제 형식을 확인한다. 확장자·Content-Type은 믿지 않는다. */
function detectVideoExtension(head: Uint8Array): VideoExtension | null {
  if (head.length >= 8 && String.fromCharCode(...head.subarray(4, 8)) === "ftyp") return "mp4";
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
  return null;
}

const PART_BYTES = 8 * 1024 * 1024; // R2 멀티파트: 마지막을 뺀 모든 파트는 5MiB 이상이어야 한다.

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** 업로드 스트림을 읽으며 크기를 재고, 앞부분으로 형식을 확인한 뒤 R2에 저장한다. 8MiB씩 멀티파트로 올린다. */
export async function saveVideo(body: ReadableStream<Uint8Array>): Promise<{ url: string; size: number }> {
  const bucket = getUploads();
  const reader = body.getReader();
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let size = 0;
  let ext: VideoExtension | null = null;
  let file = "";
  let multipart: R2MultipartUpload | null = null;
  const parts: R2UploadedPart[] = [];
  const id = crypto.randomUUID();

  const flush = () => {
    const bytes = concat(pending, pendingBytes);
    pending = [];
    pendingBytes = 0;
    return bytes;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_VIDEO_BYTES) {
        await reader.cancel().catch(() => {});
        throw new UploadError(`영상은 ${MAX_VIDEO_MB}MB 이하로 올려 주세요.`);
      }
      pending.push(value);
      pendingBytes += value.byteLength;
      if (!ext && pendingBytes >= 12) {
        const merged = flush();
        pending = [merged];
        pendingBytes = merged.byteLength;
        ext = detectVideoExtension(merged.subarray(0, 12));
        if (!ext) throw new UploadError("MP4 또는 WebM 영상만 올릴 수 있어요.");
        file = `${id}.${ext}`;
      }
      if (ext && pendingBytes >= PART_BYTES) {
        multipart ??= await bucket.createMultipartUpload(VIDEO_KEY(file), { httpMetadata: { contentType: VIDEO_MIME[ext] } });
        parts.push(await multipart.uploadPart(parts.length + 1, flush()));
      }
    }
    if (size === 0) throw new UploadError("빈 파일은 올릴 수 없어요.");
    if (!ext) {
      ext = detectVideoExtension(concat(pending, pendingBytes));
      if (!ext) throw new UploadError("MP4 또는 WebM 영상만 올릴 수 있어요.");
      file = `${id}.${ext}`;
    }
    if (!multipart) {
      await bucket.put(VIDEO_KEY(file), flush(), { httpMetadata: { contentType: VIDEO_MIME[ext] } });
    } else {
      if (pendingBytes > 0) parts.push(await multipart.uploadPart(parts.length + 1, flush()));
      await multipart.complete(parts);
    }
    return { url: `/media/video/${file}`, size };
  } catch (error) {
    await multipart?.abort().catch(() => {});
    throw error;
  }
}

export async function deleteVideo(publicPath: string | null | undefined) {
  const m = publicPath?.match(/^\/media\/video\/([0-9a-f-]{36}\.(?:mp4|webm))$/);
  if (!m) return;
  await getUploads().delete(VIDEO_KEY(m[1])).catch(() => {});
}
