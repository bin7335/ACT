import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { averageCells, buildTargets, buildThumbTargets, createStage, particleCap, thumbGrid } from "../src/app/landing/engine";

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

// ── 썸네일 구도 ──────────────────────────────────────────────────

test("썸네일 격자는 예산과 상자 안에서 셀 평균색을 입자로 옮긴다", () => {
  for (const [w, h, budget] of [[200, 125, 700], [165, 103, 225], [139, 87, 244], [60, 38, 2000]]) {
    const { nx, ny } = thumbGrid(w, h, budget);
    assert.ok(nx >= 4 && ny >= 3 && nx * ny <= Math.min(budget, 520));
    // 셀 한 변은 4px 아래로 내려가지 않는다.
    assert.ok(w / nx >= 4 && h / ny >= 4);
  }
  assert.deepEqual(thumbGrid(10, 6, 500), { nx: 0, ny: 0 });
  assert.deepEqual(thumbGrid(200, 125, 0), { nx: 0, ny: 0 });

  // 2×1 셀, 셀마다 2×2 픽셀: 왼쪽은 빨강·검정 반반, 오른쪽은 전부 파랑.
  const px = (r: number, g: number, b: number) => [r, g, b, 255];
  const rgba = [...px(255, 0, 0), ...px(0, 0, 0), ...px(0, 0, 255), ...px(0, 0, 255), ...px(255, 0, 0), ...px(0, 0, 0), ...px(0, 0, 255), ...px(0, 0, 255)];
  const cells = averageCells(rgba, 2, 1, 2);
  assert.deepEqual([...cells], [128, 0, 0, 0, 0, 255]);

  const points = buildThumbTargets([
    { x: 100, y: 50, w: 40, h: 20, nx: 2, ny: 1, rgb: cells, at: 300, card: 3 },
    { x: 0, y: 0, w: 40, h: 20, nx: 2, ny: 1, rgb: null, at: 0, card: 4 },
  ]);
  assert.equal(points.length, 4);
  assert.deepEqual(points.slice(0, 2).map(p => [p.x, p.y, p.rgb, p.card]), [[110, 60, 0x800000, 3], [130, 60, 0x0000ff, 3]]);
  assert.ok(points.slice(0, 2).every(p => p.d >= 300 && p.d <= 720 && p.r > 0 && p.r <= 10));
  // 픽셀을 읽지 못한 썸네일은 색 없이(중립색으로) 같은 자리에 놓인다.
  assert.ok(points.slice(2).every(p => p.rgb === undefined && p.card === 4));
});

type Dot = { x: number; y: number; style: string; alpha: number };
type ImgState = "ok" | "broken" | "pending";

/** 캔버스·RAF·카드 DOM을 흉내 낸다. 썸네일 픽셀은 전부 #c86432이고, taint가 true면 읽기가 거절된다. */
function setupStage(t: TestContext, { taint = false } = {}) {
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
  const env = { dots: [] as Dot[], scratch: [] as { width: number; height: number }[], callbacks };
  const ctx = {
    fillStyle: "", globalAlpha: 1,
    setTransform() {}, beginPath() {}, moveTo() {}, fill() {},
    clearRect() { env.dots = []; },
    arc(x: number, y: number) { env.dots.push({ x, y, style: ctx.fillStyle, alpha: ctx.globalAlpha }); },
  };
  const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });
  const hero = new EventTarget();
  const canvas = { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => rect(0, 0, 1024, 712) };
  const plot = { getBoundingClientRect: () => rect(530, 80, 460, 415) };
  const createElement = () => {
    const scratch = {
      width: 0, height: 0,
      getContext: () => ({
        imageSmoothingQuality: "",
        drawImage() {},
        getImageData(_x: number, _y: number, w: number, h: number) {
          if (taint) throw new Error("SecurityError");
          const data = new Uint8ClampedArray(w * h * 4);
          for (let i = 0; i < data.length; i += 4) data.set([200, 100, 50, 255], i);
          return { data };
        },
      }),
    };
    env.scratch.push(scratch);
    return scratch;
  };
  install("window", Object.assign(new EventTarget(), { devicePixelRatio: 1, matchMedia: () => new EventTarget() }));
  install("document", Object.assign(new EventTarget(), { hidden: false, createElement }));
  install("getComputedStyle", () => ({ getPropertyValue: () => "#123456", color: "#123456" }));
  install("ResizeObserver", undefined);
  install("IntersectionObserver", undefined);
  install("requestAnimationFrame", (cb: FrameRequestCallback) => { callbacks.set(++nextId, cb); return nextId; });
  install("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  t.mock.method(Math, "random", () => 0.5);

  const makeCards = (states: ImgState[]) => {
    const cards = states.map((state, i) => {
      let settle: () => void = () => {};
      const img = Object.assign(new EventTarget(), {
        complete: state !== "pending",
        naturalWidth: state === "ok" ? 640 : 0,
        naturalHeight: state === "ok" ? 400 : 0,
        decode: () => (state === "broken" ? Promise.reject(new Error("broken")) : new Promise<void>((resolve) => { settle = resolve; })),
      });
      const box = rect(540 + i * 220, 120, 200, 125);
      const thumb = { dataset: {} as Record<string, string | undefined>, getBoundingClientRect: () => box, querySelector: () => img };
      const el = { dataset: {} as Record<string, string | undefined>, querySelector: () => thumb };
      const load = () => {
        Object.assign(img, { complete: true, naturalWidth: 640, naturalHeight: 400 });
        settle();
      };
      return { el, thumb, box, load };
    });
    const root = { dataset: {} as Record<string, string | undefined>, querySelectorAll: () => cards.map(c => c.el) };
    return { cards, root, element: root as unknown as HTMLElement };
  };

  return {
    env,
    makeCards,
    frames(count: number) {
      for (let i = 0; i < count; i++) {
        now += 1000 / 60;
        const batch = [...callbacks.values()];
        callbacks.clear();
        for (const cb of batch) cb(now);
      }
    },
    /** decode() 결과처럼 프라미스로 이어지는 일을 마저 처리한다. */
    flush: () => new Promise<void>((resolve) => setImmediate(resolve)),
    options: {
      hero: hero as HTMLElement,
      canvas: canvas as unknown as HTMLCanvasElement,
      plot: plot as unknown as HTMLElement,
    },
    hero,
  };
}

test("실제 썸네일 색으로 모여 원본을 드러내고, 포인터 주변 입자만 다시 들뜬다", (t) => {
  const { env, makeCards, frames, options, hero } = setupStage(t);
  const { cards, root, element } = makeCards(["ok", "ok"]);
  const phases: string[] = [];
  const stage = createStage({ ...options, reduced: false, cards: element, onPhase: phase => phases.push(phase) });
  assert.equal(root.dataset.mode, "thumbs");
  assert.ok(cards.every(c => c.el.dataset.shown === undefined));

  // 흩어져 있는 동안: 썸네일에서 읽은 색의 입자가 예산만큼 떠 있다.
  frames(30);
  const { nx, ny } = thumbGrid(200, 125, Math.floor(particleCap(1024) / 2));
  assert.equal(env.dots.length, nx * ny * 2);
  assert.ok(env.dots.length <= particleCap(1024));
  assert.ok(env.dots.every(d => d.style === "#c86432" && d.alpha === 1));

  // 다 모이면 원본이 드러나고, 제자리에 놓인 입자는 더 그리지 않는다(원본이 그대로 보인다).
  frames(220);
  assert.deepEqual(phases, ["scattered", "gathering", "archive"]);
  assert.ok(cards.every(c => c.el.dataset.shown === "true"));
  assert.equal(env.dots.length, 0);

  // 포인터 주변 입자는 색을 띠고 떠올라 흩어진다. 썸네일 상자 밖으로도 밀려난다.
  const move = new Event("pointermove");
  Object.defineProperties(move, { clientX: { value: 640 }, clientY: { value: 180 } });
  hero.dispatchEvent(move);
  frames(20);
  assert.ok(env.dots.length > 10 && env.dots.length < nx * ny);
  assert.ok(env.dots.every(d => d.style === "#c86432" && d.alpha >= 0.02 && d.alpha <= 1));
  assert.ok(env.dots.every(d => Math.hypot(d.x - 640, d.y - 180) < 260));
  assert.ok(cards.every(c => c.el.dataset.shown === "true"));

  // 포인터가 떠나면 제자리로 돌아가 다시 투명해진다.
  hero.dispatchEvent(new Event("pointerleave"));
  frames(60);
  assert.equal(env.dots.length, 0);

  // 다시 흩뜨리면 원본을 가리고 처음부터 모은다.
  stage.replay();
  frames(1);
  assert.equal(phases.at(-1), "scattered");
  assert.ok(cards.every(c => c.el.dataset.shown === undefined));
  assert.equal(env.dots.length, nx * ny * 2);

  stage.destroy();
  assert.equal(env.callbacks.size, 0);
  // 샘플링용 캔버스는 하나만 만들어 쓰고, 정리할 때 픽셀 버퍼를 놓는다.
  assert.equal(env.scratch.length, 1);
  assert.deepEqual(env.scratch[0], { ...env.scratch[0], width: 0, height: 0 });
});

test("픽셀을 읽을 수 없으면 중립색 입자로, 이미지가 전부 깨지면 추상 격자로 물러난다", async (t) => {
  const tainted = setupStage(t, { taint: true });
  const first = tainted.makeCards(["ok", "ok"]);
  const stage = createStage({ ...tainted.options, reduced: false, cards: first.element, onPhase() {} });
  tainted.frames(30);
  // 오염된 캔버스: 색은 못 읽어도 자리는 같고, 토큰 색(중립) 점이 모인다.
  assert.equal(first.root.dataset.mode, "thumbs");
  assert.ok(tainted.env.dots.length > 100 && tainted.env.dots.every(d => d.style === "#123456"));
  tainted.frames(220);
  assert.ok(first.cards.every(c => c.el.dataset.shown === "true"));
  stage.destroy();

  // 전부 깨진 이미지: 카드를 감추고(가짜 썸네일을 만들지 않는다) 기존 추상 격자를 완성한다.
  const broken = setupStage(t);
  const second = broken.makeCards(["broken", "broken"]);
  const phases: string[] = [];
  const fallback = createStage({ ...broken.options, reduced: false, cards: second.element, onPhase: phase => phases.push(phase) });
  assert.equal(second.root.dataset.mode, "wait");
  await broken.flush();
  assert.equal(second.root.dataset.mode, "abstract");
  assert.ok(second.cards.every(c => c.thumb.dataset.failed === "true" && c.el.dataset.shown === undefined));
  broken.frames(250);
  assert.deepEqual(phases, ["scattered", "gathering", "archive"]);
  assert.equal(broken.env.dots.length, buildTargets(530, 80, 460, 415, particleCap(1024)).length);
  fallback.destroy();

  // 일부만 깨졌으면 나머지는 실제 썸네일로 모이고, 깨진 카드는 입자 없이 제목 링크만 드러난다.
  const mixed = setupStage(t);
  const third = mixed.makeCards(["ok", "broken"]);
  const partial = createStage({ ...mixed.options, reduced: false, cards: third.element, onPhase() {} });
  await mixed.flush();
  assert.equal(third.root.dataset.mode, "thumbs");
  mixed.frames(30);
  assert.ok(mixed.env.dots.length > 100 && mixed.env.dots.every(d => d.x < 540 + 220 && d.style === "#c86432"));
  mixed.frames(220);
  assert.ok(third.cards.every(c => c.el.dataset.shown === "true"));
  assert.deepEqual(third.cards.map(c => c.thumb.dataset.failed), [undefined, "true"]);
  partial.destroy();
});

test("카드·이미지를 기다리다 늦으면 추상 격자로 시작하고, 도착하면 썸네일로 다시 모인다", async (t) => {
  const { env, makeCards, frames, flush, options } = setupStage(t);
  const phases: string[] = [];
  const stage = createStage({ ...options, reduced: false, awaitCards: true, onPhase: phase => phases.push(phase) });
  // 카드가 스트리밍되는 동안에는 흩어진 채로 기다린다.
  frames(100);
  assert.deepEqual(phases, ["scattered"]);
  stage.replay();
  frames(1);
  assert.deepEqual(phases, ["scattered"]);

  // 카드는 왔지만 이미지가 아직이다: 가린 채로 더 기다리다가, 한도를 넘기면 추상 격자로 모은다.
  const { cards, root, element } = makeCards(["pending"]);
  stage.setCards(element);
  assert.equal(root.dataset.mode, "wait");
  frames(160);
  assert.equal(phases.at(-1), "gathering");
  assert.equal(root.dataset.mode, "wait");
  assert.equal(env.dots.length, buildTargets(530, 80, 460, 415, particleCap(1024)).length);
  assert.ok(env.dots.every(d => d.style === "#123456"));

  // 이미지가 도착하면 실제 썸네일 구도로 바꿔 다시 모으고 원본을 드러낸다.
  cards[0].load();
  await flush();
  assert.equal(root.dataset.mode, "thumbs");
  frames(40);
  const { nx, ny } = thumbGrid(200, 125, particleCap(1024));
  assert.equal(env.dots.length, nx * ny);
  assert.ok(env.dots.every(d => d.style === "#c86432"));
  frames(200);
  assert.equal(phases.at(-1), "archive");
  assert.equal(cards[0].el.dataset.shown, "true");

  // 카드 묶음이 사라지면(작품 없음) 표시를 거두고 추상 격자로 돌아간다.
  stage.setCards(null);
  assert.equal(root.dataset.mode, undefined);
  assert.equal(cards[0].el.dataset.shown, undefined);
  frames(1);
  assert.equal(env.dots.length, buildTargets(530, 80, 460, 415, particleCap(1024)).length);
  stage.destroy();
  cards[0].load();
  await flush();
  assert.equal(env.callbacks.size, 0);

  // 조회 결과가 비어 있으면(작품 0개) 기다리지 않고 바로 추상 격자로 모은다.
  const empty = setupStage(t);
  const none = empty.makeCards([]);
  const emptyPhases: string[] = [];
  const bare = createStage({ ...empty.options, reduced: false, awaitCards: true, onPhase: phase => emptyPhases.push(phase) });
  bare.setCards(none.element);
  empty.frames(250);
  assert.deepEqual(emptyPhases, ["scattered", "gathering", "archive"]);
  bare.destroy();
});

test("정적 모드에서는 입자 없이 원본 썸네일 카드를 바로 드러낸다", (t) => {
  const { env, makeCards, options } = setupStage(t);
  const { cards, root, element } = makeCards(["ok", "pending", "broken"]);
  const phases: string[] = [];
  const still = createStage({ ...options, reduced: true, cards: element, onPhase: phase => phases.push(phase) });
  assert.deepEqual(phases, ["archive"]);
  assert.equal(root.dataset.mode, "thumbs");
  assert.ok(cards.every(c => c.el.dataset.shown === "true"));
  assert.equal(env.dots.length, 0);
  assert.equal(env.callbacks.size, 0);
  // 픽셀을 읽을 일이 없으므로 샘플링 캔버스도 만들지 않는다.
  assert.equal(env.scratch.length, 0);
  still.destroy();

  // 캔버스를 쓸 수 없는 브라우저에서도 카드는 가려진 채 남지 않는다.
  const next = makeCards(["ok"]);
  const noCanvas = { ...options.canvas, getContext: () => null } as unknown as HTMLCanvasElement;
  const bare = createStage({ ...options, canvas: noCanvas, reduced: false, cards: next.element, onPhase() {} });
  assert.equal(next.root.dataset.mode, "thumbs");
  assert.equal(next.cards[0].el.dataset.shown, "true");
  bare.destroy();
});
