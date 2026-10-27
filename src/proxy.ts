import { NextResponse, type NextRequest } from "next/server";

// 운영진 쿠키가 없으면 렌더링 전에 로그인 화면으로 보낸다(낙관적 확인).
// 실제 서명·만료 검증은 각 페이지와 서버 액션의 requireAdmin()이 한다.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login" || request.cookies.has("act_admin")) return NextResponse.next();
  const url = new URL("/admin/login", request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
