import { ButtonLink } from "@/components/ui";
import p from "@/components/page.module.css";

export default function NotFound() {
  return (
    <div className={`container ${p.page}`}>
      <div className={p.empty}>
        <p className="t-eyebrow">404 / 페이지 없음</p>
        <h1 className="t-h1">찾는 페이지가 없어요</h1>
        <p>주소가 바뀌었거나 비공개로 전환된 작품일 수 있어요.</p>
        <div className={p.emptyActions}>
          <ButtonLink href="/works">작품 둘러보기</ButtonLink>
          <ButtonLink href="/" variant="ghost">
            처음으로
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
