import type { Metadata } from "next";
import { SectionHeader } from "@/components/SectionHeader";
import p from "@/components/page.module.css";
import { FavoriteList } from "./FavoriteList";

export const metadata: Metadata = { title: "즐겨찾기", robots: { index: false } };

export default function FavoritesPage() {
  return (
    <div className={`container ${p.page}`}>
      <SectionHeader eyebrow="FAVORITES" title="즐겨찾기" description="이 브라우저에 저장된 작품이에요. 다른 기기나 브라우저에서는 보이지 않습니다." />
      <FavoriteList />
    </div>
  );
}
