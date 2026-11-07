import { NextResponse, type NextRequest } from "next/server";

// 운영진 쿠키나 회원 세션이 없으면 렌더링 전에 로그인 화면으로 보낸다(낙관적 확인).
// 실제 서명·만료·운영진 권한 검증은 각 페이지와 서버 액션의 requireAdmin()이 한다.
const ADMIN_COOKIES = ["act_admin", "act_session", "__Host-act_session"];

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login" || ADMIN_COOKIES.some(name => request.cookies.has(name))) return NextResponse.next();
  const url = new URL("/admin/login", request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
