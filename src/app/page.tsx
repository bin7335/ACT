import { redirect } from "next/navigation";

// 기본 진입점은 작품 아카이브. 서비스 소개는 /landing에서 별도로 제공한다.
export default function Home() {
  redirect("/works");
}
