import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { UPLOAD_DIR } from "./db";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPT = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export class UploadError extends Error {}

/** 16:10으로 잘라 1280w / 640w WebP 두 장을 저장하고 공개 경로를 돌려준다. 메타데이터(EXIF·GPS)는 제거된다. */
export async function saveThumbnail(file: File): Promise<string> {
  if (!ACCEPT.has(file.type)) throw new UploadError("JPG, PNG, WebP, GIF 이미지만 올릴 수 있어요.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("이미지는 5MB 이하로 올려 주세요.");
  return saveThumbnailBytes(Buffer.from(await file.arrayBuffer()));
}

const FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif"]);

/** 바이트로 받은 이미지를 썸네일로 저장한다. 형식은 헤더가 아니라 실제 내용으로 확인한다. */
export async function saveThumbnailBytes(input: Buffer): Promise<string> {
  if (input.length > MAX_UPLOAD_BYTES) throw new UploadError("이미지는 5MB 이하로 올려 주세요.");
  const id = randomUUID();
  try {
    const base = sharp(input, { limitInputPixels: 40_000_000 }).rotate();
    const meta = await base.metadata();
    if (!meta.width || !meta.height || !FORMATS.has(meta.format ?? "")) throw new Error();
    await Promise.all([
      base.clone().resize(1280, 800, { fit: "cover", position: "attention" }).webp({ quality: 82 }).toFile(path.join(UPLOAD_DIR, `${id}.webp`)),
      base.clone().resize(640, 400, { fit: "cover", position: "attention" }).webp({ quality: 78 }).toFile(path.join(UPLOAD_DIR, `${id}-640.webp`)),
    ]);
  } catch {
    throw new UploadError("이미지를 읽을 수 없어요. 다른 파일로 시도해 주세요.");
  }
  return `/media/${id}.webp`;
}

export async function deleteThumbnail(publicPath: string | null) {
  const m = publicPath?.match(/^\/media\/([0-9a-f-]{36})\.webp$/);
  if (!m) return;
  await Promise.allSettled([fs.unlink(path.join(UPLOAD_DIR, `${m[1]}.webp`)), fs.unlink(path.join(UPLOAD_DIR, `${m[1]}-640.webp`))]);
}
