import assert from "node:assert/strict";
import test from "node:test";
import { buildTargets, createStage, particleCap } from "../src/app/landing/engine";

test("모바일·데스크톱 입자 목표는 영역과 예산 안에 배치된다", () => {
  for (const [width, pw, ph] of [[375, 343, 340], [1024, 460, 415], [1440, 620, 520]]) {
    const cap = particleCap(width);
    const points = buildTargets(20, 30, pw, ph, cap);
    assert.ok(points.length > 100 && points.length <= cap);
    assert.ok(points.every(p => p.x >= 20 && p.x <= 20 + pw && p.y >= 30 && p.y <= 30 + ph));
    assert.ok(points.every(p => p.c >= 0 && p.c < 7 && p.r > 0 && Number.isFinite(p.d)));
  }
  assert.deepEqual(buildTargets(0, 0, 0, 0, 900), []);
});

test("입자는 격자로 모이고 재생·일시 정지·정적 모드·정리를 지원한다", (t) => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const install = (key: string, value: unknown) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globals[key];
    });
  };
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  let now = 0;
  let draws = 0;
  let points: { x: number; y: number }[] = [];
  const ctx = {
    setTransform() {}, beginPath() {}, moveTo() {}, fill() {},
    clearRect() { points = []; draws++; },
    arc(x: number, y: number) { points.push({ x, y }); },
  };
  const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });
  const hero = new EventTarget();
  const canvas = { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => rect(0, 0, 1024, 712) };
  const plot = { getBoundingClientRect: () => rect(530, 80, 460, 415) };
  const documentStub = Object.assign(new EventTarget(), { hidden: false });
  const windowStub = Object.assign(new EventTarget(), { devicePixelRatio: 1, matchMedia: () => new EventTarget() });
  install("window", windowStub);
  install("document", documentStub);
  install("getComputedStyle", () => ({ getPropertyValue: () => "#123456", color: "#123456" }));
  install("ResizeObserver", undefined);
  install("IntersectionObserver", undefined);
  install("requestAnimationFrame", (cb: FrameRequestCallback) => { callbacks.set(++nextId, cb); return nextId; });
  install("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  t.mock.method(Math, "random", () => 0.5);
  const frames = (count: number) => {
    for (let i = 0; i < count; i++) {
      now += 1000 / 60;
      const batch = [...callbacks.values()];
      callbacks.clear();
      for (const cb of batch) cb(now);
    }
  };
  const options = {
    hero: hero as HTMLElement,
    canvas: canvas as unknown as HTMLCanvasElement,
    plot: plot as unknown as HTMLElement,
  };
  const phases: string[] = [];
  const stage = createStage({ ...options, reduced: false, onPhase: phase => phases.push(phase) });
  // 자동 잔물결이 시작되기 전, 격자 재결집이 끝난 시점.
  frames(250);
  assert.deepEqual(phases, ["scattered", "gathering", "archive"]);
  const targets = buildTargets(530, 80, 460, 415, particleCap(1024));
  // 캔버스는 색별로 묶어 그리므로 목표도 같은 순서로 비교한다.
  const ordered = [...targets].sort((a, b) => a.c - b.c);
  assert.equal(points.length, ordered.length);
  assert.ok(points.every((p, i) => Math.hypot(p.x - ordered[i].x, p.y - ordered[i].y) < 2));
  const move = new Event("pointermove");
  Object.defineProperties(move, { clientX: { value: 700 }, clientY: { value: 200 } });
  hero.dispatchEvent(move);
  frames(30);
  assert.ok(points.some((p, i) => Math.hypot(p.x - ordered[i].x, p.y - ordered[i].y) > 5));
  hero.dispatchEvent(new Event("pointerleave"));
  stage.replay();
  frames(1);
  assert.equal(phases.at(-1), "scattered");
  documentStub.hidden = true;
  documentStub.dispatchEvent(new Event("visibilitychange"));
  assert.equal(callbacks.size, 0);
  documentStub.hidden = false;
  documentStub.dispatchEvent(new Event("visibilitychange"));
  assert.equal(callbacks.size, 1);
  stage.destroy();
  assert.equal(callbacks.size, 0);
  const previousDraws = draws;
  windowStub.dispatchEvent(new Event("resize"));
  documentStub.dispatchEvent(new Event("visibilitychange"));
  frames(2);
  assert.equal(draws, previousDraws);

  const staticPhases: string[] = [];
  const still = createStage({ ...options, reduced: true, onPhase: phase => staticPhases.push(phase) });
  assert.deepEqual(staticPhases, ["archive"]);
  assert.equal(callbacks.size, 0);
  assert.ok(points.every((p, i) => Math.hypot(p.x - ordered[i].x, p.y - ordered[i].y) < 0.001));
  still.replay();
  assert.equal(callbacks.size, 0);
  still.destroy();
});
