import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/SectionHeader";
import p from "@/components/page.module.css";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "소개", description: site.description, alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <div className={`container ${p.narrow} ${p.page}`}>
      <SectionHeader eyebrow="소개" title="이 아카이브에 대하여" />
      <div className={p.prose}>
        <p>
          <strong>{site.name}</strong>는 함께 연구하는 선생님들이 교실을 위해 직접 만든 수업 도구, 업무 도구, 교실 놀이를 모으는 곳입니다.
          다른 선생님이 바로 열어 써 볼 수 있는 <strong>모음집</strong>이면서, 연구회가 해마다 쌓아 가는 <strong>포트폴리오</strong>입니다.
        </p>
        <h2>이렇게 운영해요</h2>
        <ul>
          <li>둘러보기와 작품 열기에는 로그인이 필요 없습니다.</li>
          <li>모든 작품에는 만든 선생님의 이름이 붙습니다. 순위나 점수는 매기지 않습니다.</li>
          <li>작품 페이지 주소는 한 번 공개하면 바뀌지 않습니다. 바로가기 링크는 주기적으로 점검합니다.</li>
          <li>학생 이름, 얼굴, 학교처럼 학생을 알아볼 수 있는 정보가 담긴 이미지와 영상은 공개하지 않습니다.</li>
        </ul>
        <h2>작품 올리기</h2>
        <p>
          <Link href="/submit">작품 올리기</Link>에서 로그인 후 제출할 수 있습니다. 운영진이 내용을 확인한 뒤 공개하며, 마이페이지에서 수정할 수 있습니다.
        </p>
        <h2>즐겨찾기</h2>
        <p>즐겨찾기는 지금 쓰는 브라우저에만 저장됩니다. 다른 기기에서는 보이지 않아요.</p>
      </div>
    </div>
  );
}
