import { getUploads } from "@/lib/db";
import { THUMB_FILE_RE } from "@/lib/uploads";

// 업로드한 썸네일을 R2에서 내보낸다. 파일명은 UUID라 내용이 바뀌지 않으므로 오래 캐시한다.
export async function GET(_req: Request, ctx: RouteContext<"/media/[file]">) {
  const { file } = await ctx.params;
  if (!THUMB_FILE_RE.test(file)) return new Response("Not found", { status: 404 });
  const object = await getUploads().get(`thumbs/${file}`);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
