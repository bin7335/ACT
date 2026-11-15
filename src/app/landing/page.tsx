import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { WORK_PURPOSE_HINT, WORK_PURPOSE_LABEL, WORK_PURPOSES } from "@/lib/content/types";
import { site } from "@/lib/site";
import { ParticleStage } from "./ParticleStage";
import s from "./landing.module.css";

export const metadata: Metadata = {
  title: "흩어진 작품이 모이는 곳",
  description: site.description,
  alternates: { canonical: "/landing" },
};

/* 운영 원칙 — /about, CONSTITUTION.md §2와 같은 내용만 적는다. */
const PRINCIPLES = [
  { title: "로그인 없이 엽니다", text: "둘러보기와 작품 열기에는 로그인이 필요 없습니다. 교실에서 바로 열어 써 보세요." },
  { title: "만든 선생님의 이름으로", text: "모든 작품에는 만든 선생님의 이름이 붙습니다. 누가 만들었는지 확인하고 원래 작품으로 이어집니다." },
  { title: "주소는 바뀌지 않습니다", text: "작품 페이지 주소는 한 번 공개하면 그대로 둡니다. 오래 남는 기록이 되도록." },
];

// 데이터베이스를 읽지 않는 정적 페이지다. 숫자·작품 예시는 싣지 않는다.
export default function LandingPage() {
  return (
    <>
      <ParticleStage>
        <p className="t-eyebrow">ACT / {site.name}</p>
        <h1 id="landing-title" className={s.title}>
          교실마다 흩어진 작품이
          <br />
          하나의 아카이브가 됩니다
        </h1>
        <p className={`t-body-lg ${s.lead}`}>
          선생님들이 수업과 업무, 교실 놀이를 위해 직접 만든 것을 한자리에 모읍니다. 점 하나가 작품 하나라면, 모인 자리가 곧 아카이브입니다.
        </p>
        <div className={s.ctas}>
          <ButtonLink href="/" variant="primary">
            작품 둘러보기
          </ButtonLink>
          <ButtonLink href="/submit">작품 올리기</ButtonLink>
        </div>
      </ParticleStage>

      <div className="container">
        <section className={s.section} aria-labelledby="landing-purposes">
          <header className={s.sectionHead}>
            <p className="t-eyebrow">Index / 용도</p>
            <h2 id="landing-purposes" className="t-h2">
              점의 색은 작품의 쓰임입니다
            </h2>
          </header>
          <ul className={s.purposes}>
            {WORK_PURPOSES.map((u) => (
              <li key={u}>
                <Link href={`/works?use=${u}`} className={s.purpose} data-purpose={u}>
                  <span className={s.purposeName}>
                    <span className={s.swatch} aria-hidden />
                    {WORK_PURPOSE_LABEL[u]}
                  </span>
                  <span className={s.purposeHint}>{WORK_PURPOSE_HINT[u]}</span>
                  <span className={s.purposeGo} aria-hidden>
                    모아 보기 →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={s.section} aria-labelledby="landing-principles">
          <header className={s.sectionHead}>
            <p className="t-eyebrow">Principles / 원칙</p>
            <h2 id="landing-principles" className="t-h2">
              모으는 방식
            </h2>
          </header>
          <ol className={s.principles}>
            {PRINCIPLES.map((item, i) => (
              <li key={item.title}>
                <span className={s.principleNo} aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="t-h3">{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
          <p className={s.more}>
            <Link href="/works">전체 작품 목록 →</Link>
            <Link href="/about">이 아카이브에 대하여 →</Link>
          </p>
        </section>
      </div>
    </>
  );
}
