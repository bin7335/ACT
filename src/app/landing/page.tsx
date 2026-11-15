import { redirect } from "next/navigation";

// 기존 랜딩 주소는 대표 주소로 연결한다.
export default function LandingPage() {
  redirect("/");
}
