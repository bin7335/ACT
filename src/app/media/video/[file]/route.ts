import { getUploads } from "@/lib/db";
import { VIDEO_KEY } from "@/lib/uploads";
import { VIDEO_MIME, videoExtensionOf } from "@/lib/video";

// 업로드한 영상 파일. 브라우저가 탐색(seek)하려면 Range 요청에 206으로 답해야 한다.
const FILE_RE = /^[0-9a-f-]{36}\.(mp4|webm)$/;

const baseHeaders = (file: string) => ({
  "Content-Type": VIDEO_MIME[videoExtensionOf(file)!],
  "Accept-Ranges": "bytes",
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
});

export async function GET(request: Request, ctx: RouteContext<"/media/video/[file]">) {
  const { file } = await ctx.params;
  if (!FILE_RE.test(file)) return new Response("Not found", { status: 404 });
  const bucket = getUploads();
  const head = await bucket.head(VIDEO_KEY(file));
  if (!head) return new Response("Not found", { status: 404 });
  const size = head.size;

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const object = await bucket.get(VIDEO_KEY(file), { range: { offset: start, length: end - start + 1 } });
    if (!object) return new Response("Not found", { status: 404 });
    return new Response(object.body, {
      status: 206,
      headers: { ...baseHeaders(file), "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const object = await bucket.get(VIDEO_KEY(file));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { status: 200, headers: { ...baseHeaders(file), "Content-Length": String(size) } });
}

export async function HEAD(_request: Request, ctx: RouteContext<"/media/video/[file]">) {
  const { file } = await ctx.params;
  if (!FILE_RE.test(file)) return new Response(null, { status: 404 });
  const head = await getUploads().head(VIDEO_KEY(file));
  if (!head) return new Response(null, { status: 404 });
  return new Response(null, { status: 200, headers: { ...baseHeaders(file), "Content-Length": String(head.size) } });
}
