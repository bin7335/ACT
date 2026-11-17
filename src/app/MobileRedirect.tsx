"use client";

import { useEffect } from "react";

/** 휴대폰인지(굵은 포인터 + 짧은 변 768px 미만), 그리고 사용자가 웹 화면을 고르지 않았는지. 바깥 변수를 쓰지 않는다(문자열로도 실행). */
function shouldGoArcade() {
  try {
    if (new URLSearchParams(location.search).has("web")) sessionStorage.setItem("act-web", "1");
    if (sessionStorage.getItem("act-web")) return false;
    return matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 768;
  } catch {
    return false;
  }
}

/**
 * 휴대폰으로 홈(/)에 들어오면 콘솔형 모바일 화면(/arcade)으로 보낸다. 태블릿·데스크톱은 그대로 둔다.
 * 아케이드의 [웹 화면] 버튼(/?web=1)으로 온 경우는 이번 방문(탭) 동안 다시 보내지 않는다.
 * 첫 로드는 인라인 스크립트가 그리기 전에 처리하고, 앱 안에서 홈으로 돌아올 때는 effect가 처리한다.
 */
export function MobileRedirect() {
  useEffect(() => {
    if (shouldGoArcade()) location.replace("/arcade");
  }, []);
  return <script dangerouslySetInnerHTML={{ __html: `if((${shouldGoArcade.toString()})())location.replace("/arcade")` }} />;
}
