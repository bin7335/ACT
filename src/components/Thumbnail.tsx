import type { WorkPurpose } from "@/lib/content/types";
import s from "./WorkCard.module.css";

/**
 * 16:10 썸네일. 이미지가 없으면 용도색 위에 제목을 얹은 타이포그래픽 썸네일을 그린다.
 * 업로드 이미지는 /media/{id}.webp (1280w)와 {id}-640.webp 두 가지 크기로 저장된다.
 */
export function Thumbnail({
  src,
  alt,
  title,
  purpose,
  priority,
  sizes = "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 282px",
}: {
  src: string | null;
  alt: string | null;
  title: string;
  purpose: WorkPurpose;
  priority?: boolean;
  sizes?: string;
}) {
  if (src) {
    const small = src.replace(/\.webp$/, "-640.webp");
    return (
      // 업로드 시 이미 1280/640 WebP로 만들어 두므로 next/image 최적화는 쓰지 않는다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={s.thumbImg}
        src={src}
        srcSet={`${small} 640w, ${src} 1280w`}
        sizes={sizes}
        alt={alt ?? ""}
        width={1280}
        height={800}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }
  return (
    <div className={s.thumbFallback} data-purpose={purpose} aria-hidden>
      <span className={s.thumbFallbackTitle}>{title}</span>
    </div>
  );
}
