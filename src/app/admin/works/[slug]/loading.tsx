import s from "@/app/works/[slug]/work.module.css";
import c from "@/components/WorkCard.module.css";

export default function Loading() {
  return (
    <div className={`container ${s.page}`} aria-busy="true" aria-label="불러오는 중">
      <div className={s.layout}>
        <div className={`${s.media} ${c.skelThumb}`} />
        <div className={s.aside}>
          <div className={c.skelLine} style={{ width: "40%" }} />
          <div className={c.skelLine} style={{ height: 32 }} />
          <div className={c.skelLine} />
        </div>
      </div>
    </div>
  );
}
