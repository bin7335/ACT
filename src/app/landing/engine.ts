/*
 * 랜딩 캔버스 엔진 — 흩어진 점이 작품 격자(아카이브)로 모인다.
 * React와 분리된 순수 DOM 코드다. createStage()가 돌려주는 destroy()가
 * RAF·옵저버·이벤트 리스너를 모두 정리한다.
 */

export type Phase = "scattered" | "gathering" | "archive";

export interface StageHandle {
  /** 점을 다시 흩뜨린 뒤 처음부터 모은다. 정적 모드에서는 아무 일도 하지 않는다. */
  replay(): void;
  destroy(): void;
}

interface StageOptions {
  /** 포인터 입력을 받는 영역. 캔버스가 이 영역을 가득 덮는다. */
  hero: HTMLElement;
  canvas: HTMLCanvasElement;
  /** 격자가 완성될 자리. 레이아웃(CSS)이 정한 이 상자 안에 목표 좌표를 만든다. */
  plot: HTMLElement;
  /** prefers-reduced-motion: 움직임 없이 완성된 구도만 한 번 그린다. */
  reduced: boolean;
  onPhase: (phase: Phase) => void;
}

export interface Target {
  x: number;
  y: number;
  /** 반지름(px) */
  r: number;
  /** COLOR_VARS 인덱스 */
  c: number;
  /** 모이기 시작하는 시각(ms, 장면 시작 기준) */
  d: number;
}

const TAU = Math.PI * 2;
const FRAME = 1000 / 60;

/* 색은 globals.css 토큰에서 읽는다. 순서가 곧 색 인덱스다. */
const COLOR_VARS = [
  "--color-text-primary",
  "--color-text-tertiary",
  "--color-bg-accent",
  "--color-purpose-class-fg",
  "--color-purpose-work-fg",
  "--color-purpose-play-fg",
  "--color-purpose-other-fg",
] as const;
const INK = 0;
const DIM = 1;
const ACCENT = 2;
const PURPOSE = 3;

/* 카드마다 용도 색을 고르게 섞는 고정 패턴(0 수업 · 1 업무 · 2 놀이 · 3 기타) */
const CARD_PURPOSE = [0, 1, 0, 2, 3, 0, 2, 1, 0, 1, 2, 0, 3, 0, 1, 2];

/* 격자 치수(px) */
const HEAD_H = 34; // 머리 라벨 + 잉크 선 + 아래 여백
const TEXT_H = 22; // 썸네일 아래 제목·메타 두 줄
const LINE_STEP = 6; // 선을 이루는 점 간격

/* 물리 상수(60fps 한 프레임 기준) */
const SPRING = 0.022;
const SPRING_DAMP = 0.82;
const DRIFT_DAMP = 0.985;
const RAMP_MS = 700; // 스프링이 서서히 걸리는 시간
const HOLD_MS = 900; // 처음 흩어진 채로 보여 주는 시간
const SETTLE_MS = 1000; // 마지막 점이 출발한 뒤 자리를 잡는 시간
const POINTER_R = 130;
const POINTER_F = 2.6;
const POINTER_DRAG = 0.07; // 포인터가 움직이는 방향으로 끌려가는 정도
const GHOST_F = 0.6;
const BURST_R = 260;
const BURST_F = 26;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 화면 너비에 따른 입자 수 상한 */
export function particleCap(width: number) {
  return width < 768 ? 900 : width < 1024 ? 1400 : 2200;
}

/**
 * plot 상자 안에 아카이브 한 화면을 점으로 설계한다.
 * 머리(라벨·잉크 선) 아래로 카드가 놓이고, 카드는 16:10 썸네일(점 격자) + 제목 줄 + 메타 줄이다.
 */
export function buildTargets(px: number, py: number, pw: number, ph: number, cap: number): Target[] {
  const out: Target[] = [];
  if (pw < 80 || ph < 80) return out;

  const cols = pw >= 600 ? 4 : pw >= 300 ? 3 : 2;
  const colGap = clamp(pw * 0.04, 12, 28);
  const cw = (pw - (cols - 1) * colGap) / cols;
  const th = cw * 0.625;
  const ch = th + TEXT_H;
  const rowGap = clamp(cw * 0.2, 18, 32);
  const rows = clamp(Math.floor((ph - HEAD_H + rowGap) / (ch + rowGap)), 1, 4);
  const blockH = HEAD_H + rows * ch + (rows - 1) * rowGap;
  const top = py + Math.max(0, (ph - blockH) / 2);
  const cards = cols * rows;

  const line = (x0: number, x1: number, y: number, r: number, c: number, d0: number, span: number) => {
    const n = Math.max(1, Math.floor((x1 - x0) / LINE_STEP));
    for (let i = 0; i <= n; i++) out.push({ x: x0 + ((x1 - x0) * i) / n, y, r, c, d: d0 + (span * i) / n });
  };

  // 머리: 강조색 라벨, 오른쪽 보조 라벨, 전체 폭 잉크 선
  line(px, px + Math.min(64, pw * 0.2), top + 2, 1.5, ACCENT, 0, 160);
  line(px + pw - Math.min(40, pw * 0.12), px + pw, top + 2, 1.2, DIM, 260, 120);
  line(px, px + pw, top + 14, 1.2, INK, 60, 520);

  // 남은 예산 안에서 썸네일 점 격자의 간격을 정한다.
  const fixed = out.length + cards * (Math.floor((cw * 0.72) / LINE_STEP) + Math.floor((cw * 0.42) / LINE_STEP) + 2);
  let step = 9;
  let nx = 2;
  let ny = 2;
  for (; step <= 40; step += 0.5) {
    nx = Math.max(2, Math.round(cw / step) + 1);
    ny = Math.max(2, Math.round(th / step) + 1);
    if (fixed + cards * nx * ny <= cap) break;
  }
  const dot = clamp(step * 0.2, 1.4, 2.4);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const x0 = px + col * (cw + colGap);
      const y0 = top + HEAD_H + row * (ch + rowGap);
      const base = 420 + idx * 130;
      const color = PURPOSE + CARD_PURPOSE[idx % CARD_PURPOSE.length];
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          out.push({ x: x0 + (cw * i) / (nx - 1), y: y0 + (th * j) / (ny - 1), r: dot, c: color, d: base + Math.random() * 420 });
        }
      }
      line(x0, x0 + cw * 0.72, y0 + th + 11, 1.3, INK, base + 260, 200);
      line(x0, x0 + cw * 0.42, y0 + th + 20, 1.1, DIM, base + 340, 160);
    }
  }
  return out;
}

const NOOP: StageHandle = { replay() {}, destroy() {} };

export function createStage({ hero, canvas, plot, reduced, onPhase }: StageOptions): StageHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return NOOP;

  // 크기·배치
  let w = 0;
  let h = 0;
  let dpr = 1;
  let plotX = 0;
  let plotY = 0;
  let plotW = 0;
  let plotH = 0;

  // 입자(구조체 배열 대신 타입 배열)
  let n = 0;
  let x = new Float32Array(0);
  let y = new Float32Array(0);
  let vx = new Float32Array(0);
  let vy = new Float32Array(0);
  let hx = new Float32Array(0);
  let hy = new Float32Array(0);
  let rad = new Float32Array(0);
  let delay = new Float32Array(0);
  let seed = new Float32Array(0);
  let groups: Uint16Array[] = [];
  let maxDelay = 0;

  let colors: string[] = [];

  // 시간: 화면에 보이는 동안만 흐르는 자체 시계(ms)
  let clock = 0;
  let epoch = HOLD_MS;
  let last = 0;
  let raf = 0;
  let phase: Phase | null = null;
  let inView = true;
  let destroyed = false;

  const pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false, at: -1e6 };

  function readColors() {
    const cs = getComputedStyle(canvas);
    colors = COLOR_VARS.map((name) => cs.getPropertyValue(name).trim() || cs.color);
  }

  /** 캔버스와 plot 상자를 다시 잰다. 달라진 것이 없으면 false. */
  function measure() {
    const cr = canvas.getBoundingClientRect();
    const pr = plot.getBoundingClientRect();
    const nw = Math.round(cr.width);
    const nh = Math.round(cr.height);
    if (nw < 1 || nh < 1) return false;
    const nd = Math.min(window.devicePixelRatio || 1, 2);
    const npx = Math.round(pr.left - cr.left);
    const npy = Math.round(pr.top - cr.top);
    const npw = Math.round(pr.width);
    const nph = Math.round(pr.height);
    if (nw === w && nh === h && nd === dpr && npx === plotX && npy === plotY && npw === plotW && nph === plotH) return false;
    w = nw;
    h = nh;
    dpr = nd;
    plotX = npx;
    plotY = npy;
    plotW = npw;
    plotH = nph;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    return true;
  }

  /** 목표 좌표를 새로 만들고, 이미 떠 있는 입자는 위치·속도를 이어받는다. */
  function rebuild() {
    const targets = buildTargets(plotX, plotY, plotW, plotH, particleCap(w));
    const m = targets.length;
    const nxs = new Float32Array(m);
    const nys = new Float32Array(m);
    const nvx = new Float32Array(m);
    const nvy = new Float32Array(m);
    const nseed = new Float32Array(m);
    hx = new Float32Array(m);
    hy = new Float32Array(m);
    rad = new Float32Array(m);
    delay = new Float32Array(m);
    const counts = new Array<number>(COLOR_VARS.length).fill(0);
    maxDelay = 0;

    for (let i = 0; i < m; i++) {
      const t = targets[i];
      hx[i] = t.x;
      hy[i] = t.y;
      rad[i] = t.r;
      delay[i] = t.d;
      if (t.d > maxDelay) maxDelay = t.d;
      counts[t.c]++;
      if (reduced) {
        nxs[i] = t.x;
        nys[i] = t.y;
      } else if (i < n) {
        nxs[i] = x[i];
        nys[i] = y[i];
        nvx[i] = vx[i];
        nvy[i] = vy[i];
        nseed[i] = seed[i];
      } else {
        nxs[i] = Math.random() * w;
        nys[i] = Math.random() * h;
        nvx[i] = (Math.random() - 0.5) * 0.8;
        nvy[i] = (Math.random() - 0.5) * 0.8;
        nseed[i] = Math.random() * TAU;
      }
    }

    groups = counts.map((count) => new Uint16Array(count));
    const cursor = new Array<number>(COLOR_VARS.length).fill(0);
    for (let i = 0; i < m; i++) groups[targets[i].c][cursor[targets[i].c]++] = i;

    x = nxs;
    y = nys;
    vx = nvx;
    vy = nvy;
    seed = nseed;
    n = m;
  }

  /** 색 묶음마다 경로 하나로 그린다(프레임당 fill 호출은 색 수만큼). */
  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (let c = 0; c < groups.length; c++) {
      const g = groups[c];
      if (!g.length) continue;
      ctx.fillStyle = colors[c];
      ctx.beginPath();
      for (let k = 0; k < g.length; k++) {
        const i = g[k];
        ctx.moveTo(x[i] + rad[i], y[i]);
        ctx.arc(x[i], y[i], rad[i], 0, TAU);
      }
      ctx.fill();
    }
  }

  function step(f: number) {
    const springDamp = Math.pow(SPRING_DAMP, f);
    const driftDamp = Math.pow(DRIFT_DAMP, f);

    // 밀어내는 힘의 중심: 실제 포인터, 없으면 완성된 격자 위를 천천히 도는 보이지 않는 손
    let fx = 0;
    let fy = 0;
    let fr = 0;
    let force = 0;
    let dragX = 0;
    let dragY = 0;
    if (pointer.active) {
      fx = pointer.x;
      fy = pointer.y;
      fr = POINTER_R;
      force = POINTER_F;
      dragX = pointer.vx * POINTER_DRAG;
      dragY = pointer.vy * POINTER_DRAG;
    } else if (phase === "archive") {
      const idleFrom = Math.max(pointer.at, epoch + maxDelay + SETTLE_MS);
      const ease = clamp((clock - idleFrom - 1200) / 1000, 0, 1);
      if (ease > 0) {
        fx = plotX + plotW * (0.5 + 0.44 * Math.sin(clock * 0.00041));
        fy = plotY + plotH * (0.5 + 0.38 * Math.sin(clock * 0.00067 + 1.7));
        fr = clamp(plotW * 0.14, 40, 70);
        force = GHOST_F * ease;
      }
    }
    const fr2 = fr * fr;
    // 포인터 속도는 프레임마다 잦아든다(멈추면 끌림도 멈춘다).
    const pointerDecay = Math.pow(0.8, f);
    pointer.vx *= pointerDecay;
    pointer.vy *= pointerDecay;

    for (let i = 0; i < n; i++) {
      const since = clock - epoch - delay[i];
      if (since < 0) {
        // 아직 부름을 받지 않은 점: 느린 흐름을 따라 떠다닌다.
        const a = Math.sin(x[i] * 0.006 + clock * 0.0004 + seed[i]) * 2 + Math.cos(y[i] * 0.005 - clock * 0.0003) * 2;
        vx[i] = (vx[i] + Math.cos(a) * 0.03 * f) * driftDamp;
        vy[i] = (vy[i] + Math.sin(a) * 0.03 * f) * driftDamp;
      } else {
        const t = since >= RAMP_MS ? 1 : since / RAMP_MS;
        const k = SPRING * t * t * (3 - 2 * t) * f;
        vx[i] = (vx[i] + (hx[i] - x[i]) * k) * springDamp;
        vy[i] = (vy[i] + (hy[i] - y[i]) * k) * springDamp;
      }

      if (force > 0) {
        const dx = x[i] - fx;
        const dy = y[i] - fy;
        const d2 = dx * dx + dy * dy;
        if (d2 < fr2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const q = 1 - d / fr;
          const push = q * q * force * f;
          // 바깥으로 밀면서 살짝 휘돌리고, 포인터가 지나간 방향으로 끌고 간다.
          vx[i] += (dx / d) * push - (dy / d) * push * 0.25 + dragX * q * f;
          vy[i] += (dy / d) * push + (dx / d) * push * 0.25 + dragY * q * f;
        }
      }

      x[i] += vx[i] * f;
      y[i] += vy[i] * f;

      if (since < 0) {
        if (x[i] < -8) x[i] += w + 16;
        else if (x[i] > w + 8) x[i] -= w + 16;
        if (y[i] < -8) y[i] += h + 16;
        else if (y[i] > h + 8) y[i] -= h + 16;
      }
    }
  }

  function tick(ts: number) {
    if (destroyed) return;
    const dt = last ? Math.min(ts - last, 50) : FRAME;
    last = ts;
    clock += dt;

    const next: Phase = clock < epoch ? "scattered" : clock < epoch + maxDelay + SETTLE_MS ? "gathering" : "archive";
    if (next !== phase) {
      phase = next;
      onPhase(next);
    }

    step(dt / FRAME);
    draw();
    raf = requestAnimationFrame(tick);
  }

  /** 보이는 동안에만 루프를 돌린다(숨은 탭·화면 밖·정적 모드에서는 멈춤). */
  function sync() {
    const should = !destroyed && !reduced && inView && !document.hidden;
    if (should && !raf) {
      last = 0;
      raf = requestAnimationFrame(tick);
    } else if (!should && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function relayout() {
    if (!measure()) return;
    rebuild();
    draw();
  }

  function burst(bx: number, by: number) {
    const r2 = BURST_R * BURST_R;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - bx;
      const dy = y[i] - by;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const d = Math.sqrt(d2) || 1;
      const q = 1 - d / BURST_R;
      const push = q * q * BURST_F * (0.7 + Math.random() * 0.6);
      vx[i] += (dx / d) * push;
      vy[i] += (dy / d) * push;
    }
  }

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const nx = e.clientX - r.left;
    const ny = e.clientY - r.top;
    if (pointer.active) {
      pointer.vx = clamp(pointer.vx + nx - pointer.x, -40, 40);
      pointer.vy = clamp(pointer.vy + ny - pointer.y, -40, 40);
    }
    pointer.x = nx;
    pointer.y = ny;
    pointer.active = true;
    pointer.at = clock;
  };
  const onDown = (e: PointerEvent) => {
    onMove(e);
    // 링크·버튼을 누를 때는 장면을 건드리지 않는다.
    if (e.target instanceof Element && e.target.closest("a, button")) return;
    burst(pointer.x, pointer.y);
  };
  const release = () => {
    pointer.active = false;
    pointer.vx = 0;
    pointer.vy = 0;
    pointer.at = clock;
  };
  const onUp = (e: PointerEvent) => {
    // 터치·펜은 손을 떼면 포인터가 사라진다. 마우스는 영역을 벗어날 때만 놓는다.
    if (e.pointerType !== "mouse") release();
  };
  const onScheme = () => {
    readColors();
    draw();
  };

  // 초기화
  readColors();
  measure();
  rebuild();
  draw();

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(relayout) : null;
  ro?.observe(hero);
  ro?.observe(plot);
  window.addEventListener("resize", relayout);

  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", onScheme);

  let io: IntersectionObserver | null = null;
  if (reduced) {
    // 정적 모드: 완성된 구도가 곧 최종 단계다.
    phase = "archive";
    onPhase("archive");
  } else {
    const passive = { passive: true } as const;
    hero.addEventListener("pointermove", onMove, passive);
    hero.addEventListener("pointerdown", onDown, passive);
    hero.addEventListener("pointerup", onUp, passive);
    hero.addEventListener("pointercancel", release, passive);
    hero.addEventListener("pointerleave", release, passive);
    document.addEventListener("visibilitychange", sync);
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        inView = entries[entries.length - 1].isIntersecting;
        sync();
      });
      io.observe(hero);
    }
    sync();
  }

  return {
    replay() {
      if (reduced || destroyed) return;
      epoch = clock + 1500;
      pointer.at = clock;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const speed = 4 + Math.random() * 7;
        vx[i] += Math.cos(a) * speed;
        vy[i] += Math.sin(a) * speed;
      }
      sync();
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener("resize", relayout);
      scheme.removeEventListener("change", onScheme);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerdown", onDown);
      hero.removeEventListener("pointerup", onUp);
      hero.removeEventListener("pointercancel", release);
      hero.removeEventListener("pointerleave", release);
      document.removeEventListener("visibilitychange", sync);
    },
  };
}
