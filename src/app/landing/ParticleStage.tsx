"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { createStage, type StageHandle } from "./engine";
import s from "./landing.module.css";

const STEPS = [
  { phase: "scattered", label: "01 흩어짐" },
  { phase: "gathering", label: "02 모이는 중" },
  { phase: "archive", label: "03 아카이브" },
] as const;

type RegisterCards = (root: HTMLElement | null) => void;
const CardsContext = createContext<RegisterCards | null>(null);

/** ThumbCards가 자기 루트 요소를 캔버스 엔진에 알릴 때 쓴다. ParticleStage 밖에서는 null. */
export function useRegisterCards() {
  return useContext(CardsContext);
}

/**
 * 랜딩 히어로. 캔버스가 영역 전체를 덮고, 점들은 오른쪽(좁은 화면에서는 아래) plot 상자 안에서 완성된다.
 * 문구(children)와 작품 카드(cards)는 서버에서 그려 그대로 끼운다. cards가 연결되면 점들이 실제 썸네일로
 * 모이고, 없거나 쓸 수 없으면 추상 작품 격자로 모인다.
 */
export function ParticleStage({ children, cards }: { children: ReactNode; cards?: ReactNode }) {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageHandle | null>(null);
  const cardsRef = useRef<HTMLElement | null>(null);
  const expectsCards = cards != null;

  // 카드는 스트리밍으로 엔진보다 늦게 올 수도, 먼저 와 있을 수도 있다.
  const registerCards = useCallback<RegisterCards>((root) => {
    cardsRef.current = root;
    stageRef.current?.setCards(root);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const canvas = canvasRef.current;
    const plot = plotRef.current;
    if (!hero || !canvas || !plot) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // 단계 표시는 React 상태 없이 data-phase로만 바꾼다(프레임 루프가 리렌더를 일으키지 않게).
    const start = () =>
      createStage({
        hero,
        canvas,
        plot,
        reduced: motion.matches,
        cards: cardsRef.current,
        awaitCards: expectsCards,
        onPhase: (phase) => {
          hero.dataset.phase = phase;
        },
      });

    let stage = start();
    stageRef.current = stage;
    const restart = () => {
      stage.destroy();
      stage = start();
      stageRef.current = stage;
    };
    motion.addEventListener("change", restart);

    return () => {
      motion.removeEventListener("change", restart);
      stage.destroy();
      stageRef.current = null;
      delete hero.dataset.phase;
    };
  }, [expectsCards]);

  return (
    <section ref={heroRef} className={s.hero} aria-labelledby="landing-title">
      {/* 장식이다. 작품 정보는 아래 카드의 실제 링크와 이미지가 전한다. */}
      <canvas ref={canvasRef} className={s.canvas} aria-hidden />
      <div className={`container ${s.inner}`}>
        <div className={s.copy}>{children}</div>
        <div className={s.stage}>
          <div ref={plotRef} className={s.plot}>
            <CardsContext.Provider value={registerCards}>{cards}</CardsContext.Provider>
          </div>
          <div className={s.stageFoot}>
            <ol className={s.steps} aria-hidden>
              {STEPS.map((step) => (
                <li key={step.phase} data-step={step.phase}>
                  {step.label}
                </li>
              ))}
            </ol>
            <button type="button" className={s.replay} onClick={() => stageRef.current?.replay()}>
              다시 흩뜨리기
            </button>
          </div>
          <p className={s.hint}>점들을 건드려 보세요. 흩어졌다가 다시 제자리를 찾아갑니다.</p>
        </div>
      </div>
    </section>
  );
}
