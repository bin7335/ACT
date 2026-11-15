import { isAdmin } from "@/lib/admin";
import { currentMember } from "@/lib/auth";
import { uploadRateLimit } from "@/lib/security";
import { saveVideo, UploadError } from "@/lib/uploads";
import { MAX_VIDEO_BYTES, MAX_VIDEO_MB } from "@/lib/video";

// 영상 파일 업로드. 서버 액션 본문 제한(6MB)을 피하려고 스트림으로 직접 받는다.
// 저장만 하고 작품과는 연결하지 않는다. 폼이 돌려받은 경로를 링크(kind: file)로 제출한다.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin) {
    let sameHost = false;
    try {
      sameHost = !host || new URL(origin).host === host;
    } catch {
      sameHost = false;
    }
    if (!sameHost) return Response.json({ error: "허용되지 않은 요청이에요." }, { status: 403 });
  }

  const member = await currentMember();
  const admin = member?.isAdmin || await isAdmin();
  if (!member && !admin) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (!admin && member && !uploadRateLimit("video", member)) {
    return Response.json({ error: "짧은 시간에 너무 많이 올렸어요. 잠시 뒤 다시 시도해 주세요." }, { status: 429 });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_VIDEO_BYTES) {
    return Response.json({ error: `영상은 ${MAX_VIDEO_MB}MB 이하로 올려 주세요.` }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "영상 파일이 없어요." }, { status: 400 });

  try {
    const saved = await saveVideo(request.body);
    return Response.json(saved, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UploadError) return Response.json({ error: error.message }, { status: 400 });
    console.error("video upload failed", error);
    return Response.json({ error: "영상을 저장하지 못했어요." }, { status: 500 });
  }
}
