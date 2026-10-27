import { WorkGridSkeleton } from "@/components/WorkCard";
import p from "@/components/page.module.css";

export default function Loading() {
  return (
    <div className={`container ${p.page}`} aria-busy="true" aria-label="불러오는 중">
      <WorkGridSkeleton />
    </div>
  );
}
