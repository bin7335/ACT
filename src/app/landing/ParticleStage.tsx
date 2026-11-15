"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createStage, type StageHandle } from "./engine";
import s from "./landing.module.css";

const STEPS = [
  { phase: "scattered", label: "01 흩어짐" },
  { phase: "gathering", label: "02 모이는 중" },
  { phase: "archive", label: "03 아카이브" },
] as const;

/**
 * 랜딩 히어로. 캔버스가 영역 전체를 덮고, 점들은 오른쪽(좁은 화면에서는 아래) plot 상자 안에서
 * 작품 격자로 완성된다. 문구(children)는 서버에서 그려 그대로 끼운다.
 */
export function ParticleStage({ children }: { children: ReactNode }) {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageHandle | null>(null);

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
  }, []);

  return (
    <section ref={heroRef} className={s.hero} aria-labelledby="landing-title">
      <canvas ref={canvasRef} className={s.canvas} role="img" aria-label="흩어져 떠다니던 점들이 모여 작품 카드가 줄지어 놓인 아카이브 격자를 이루는 그림" />
      <div className={`container ${s.inner}`}>
        <div className={s.copy}>{children}</div>
        <div className={s.stage}>
          <div ref={plotRef} className={s.plot} aria-hidden />
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
