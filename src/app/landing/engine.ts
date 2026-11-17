/*
 * 랜딩 캔버스 엔진 — 흩어진 점이 아카이브로 모인다.
 * React와 분리된 순수 DOM 코드다. createStage()가 돌려주는 destroy()가
 * RAF·옵저버·이벤트 리스너를 모두 정리한다.
 *
 * 두 가지 구도가 있다.
 *  - thumbs: 실제 작품 카드(ThumbCards)가 연결되면, 각 썸네일 <img>를 작은 격자로 샘플링한 색 입자가
 *    그 자리로 모인다. 다 모이면 아래에 깔린 원본 이미지가 드러나고 입자는 투명해진다.
 *    그 뒤로는 제자리에서 밀려난 입자만 다시 보인다(커서 주변이 들뜬다).
 *  - abstract: 카드가 없거나 이미지를 하나도 쓸 수 없을 때의 폴백. 토큰 색 점으로 추상 작품 격자를 그린다.
 *
 * 카드 마크업 계약: 루트 안의 [data-card] > [data-thumb] > img.
 * 엔진은 루트에 data-mode(wait·thumbs·abstract), 카드에 data-shown, 썸네일에 data-failed를 쓴다.
 */

export type Phase = "scattered" | "gathering" | "archive";

export interface StageHandle {
  /** 점을 다시 흩뜨린 뒤 처음부터 모은다. 정적 모드에서는 아무 일도 하지 않는다. */
  replay(): void;
  /** 작품 카드 묶음(ThumbCards의 루트)을 연결한다. null이면 해제하고 추상 격자로 돌아간다. */
  setCards(root: HTMLElement | null): void;
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
  /** 이미 그려져 있는 작품 카드 묶음 */
  cards?: HTMLElement | null;
  /** 카드 묶음이 곧 연결될 예정이면(스트리밍 중) 흩어진 채로 잠시 기다린다. */
  awaitCards?: boolean;
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
  /** 썸네일에서 읽은 색(0xRRGGBB). 없으면 c의 토큰 색을 쓴다. */
  rgb?: number;
  /** 썸네일 입자가 속한 카드 번호 */
  card?: number;
}

/** 썸네일 한 장을 입자로 옮길 때의 입력 */
export interface ThumbSource {
  x: number;
  y: number;
  w: number;
  h: number;
  nx: number;
  ny: number;
  /** 셀마다 RGB 3바이트(nx*ny*3). 픽셀을 읽지 못했으면 null이고 중립색 점을 쓴다. */
  rgb: Uint8ClampedArray | null;
  /** 모이기 시작하는 시각(ms, 장면 시작 기준) */
  at: number;
  card: number;
}

type CardStatus = "idle" | "loading" | "ready" | "plain" | "failed";

interface CardState {
  el: HTMLElement;
  thumb: HTMLElement;
  img: HTMLImageElement | null;
  /** idle: 아직 화면에 없음 · plain: 보이지만 픽셀을 읽을 수 없음(교차 출처) · failed: 이미지가 깨짐 */
  status: CardStatus;
  /** 캔버스 좌표계의 썸네일 상자 */
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  /** 모이기 시작하는 시각(ms, 장면 시작 기준). 아직 정하지 않았으면 음수. */
  at: number;
  shown: boolean;
  sample: { nx: number; ny: number; rgb: Uint8ClampedArray } | null;
  /** 걸어 둔 load·error 리스너를 떼는 함수 */
  off: (() => void) | null;
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

/* 썸네일 구도 */
const THUMB_MAX = 520; // 썸네일 한 장에 쓰는 입자 상한
const MIN_CELL = 4; // 셀 한 변의 최소 길이(px)
const SUPERSAMPLE = 3; // 셀 하나의 색을 정할 때 읽는 픽셀 수(한 변)
const CARD_LEAD = 200; // 첫 카드가 모이기 시작하는 시각
const CARD_STAGGER = 200; // 카드 사이 간격
const GATHER_SPREAD = 420; // 한 카드 안에서 점이 출발하는 시간 폭
const REVEAL_START = 1500; // 카드가 모이기 시작한 뒤 원본이 드러나기까지
const REVEAL_MS = 800; // 원본이 드러나고 입자가 투명해지는 시간(landing.module.css의 전환 시간과 같다)
const WAIT_MAX_MS = 3500; // 카드·이미지를 기다리는 최대 시간. 넘기면 추상 격자로 시작한다.
const LIFT_PX = 9; // 제자리에서 이만큼 벗어나면 다 들뜬 것으로 본다
const LIFT_ALPHA = 0.9; // 들뜬 입자의 불투명도
const FAR_FROM = 20; // 제자리에서 이보다 멀어지면 점이 작아지기 시작한다
const FAR_SPAN = 140; // 그 뒤 이만큼 더 멀어지면 가장 작아진다
const THUMB_POINTER_R = 110;
const THUMB_POINTER_F = 1.8;
const TINT_MS = 500; // 구도가 바뀔 때 이전 색에서 새 색으로 넘어가는 시간

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const hex = (rgb: number) => `#${(0x1000000 | rgb).toString(16).slice(1)}`;

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

/** w×h 상자를 budget개 이하의 정사각형에 가까운 셀로 나눈다. 너무 작은 상자는 0×0. */
export function thumbGrid(w: number, h: number, budget: number) {
  if (w < MIN_CELL * 4 || h < MIN_CELL * 3 || budget < 12) return { nx: 0, ny: 0 };
  const aspect = w / h;
  const count = Math.min(budget, THUMB_MAX);
  const nx = clamp(Math.floor(Math.sqrt(count * aspect)), 4, Math.floor(w / MIN_CELL));
  const ny = clamp(Math.floor(nx / aspect), 3, Math.floor(h / MIN_CELL));
  return { nx, ny };
}

/** (nx*ss)×(ny*ss) RGBA 픽셀을 셀마다 평균 내어 nx*ny*3 RGB로 줄인다. */
export function averageCells(src: ArrayLike<number>, nx: number, ny: number, ss: number) {
  const out = new Uint8ClampedArray(nx * ny * 3);
  const row = nx * ss * 4;
  const area = ss * ss;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let v = 0; v < ss; v++) {
        let p = (j * ss + v) * row + i * ss * 4;
        for (let u = 0; u < ss; u++, p += 4) {
          r += src[p];
          g += src[p + 1];
          b += src[p + 2];
        }
      }
      const o = (j * nx + i) * 3;
      out[o] = r / area;
      out[o + 1] = g / area;
      out[o + 2] = b / area;
    }
  }
  return out;
}

/** 썸네일마다 셀 중심에 입자 하나씩. 색은 그 셀의 평균색이다. */
export function buildThumbTargets(sources: ThumbSource[]): Target[] {
  const out: Target[] = [];
  for (const s of sources) {
    if (s.nx < 1 || s.ny < 1) continue;
    const cw = s.w / s.nx;
    const ch = s.h / s.ny;
    const r = Math.min(cw, ch) * 0.48;
    for (let j = 0; j < s.ny; j++) {
      for (let i = 0; i < s.nx; i++) {
        const o = (j * s.nx + i) * 3;
        out.push({
          x: s.x + (i + 0.5) * cw,
          y: s.y + (j + 0.5) * ch,
          r,
          c: DIM,
          d: s.at + Math.random() * GATHER_SPREAD,
          card: s.card,
          rgb: s.rgb ? (s.rgb[o] << 16) | (s.rgb[o + 1] << 8) | s.rgb[o + 2] : undefined,
        });
      }
    }
  }
  return out;
}

/** 캔버스를 쓸 수 없을 때: 카드를 가리지 않고 그대로 보여 준다. */
function revealCards(root: HTMLElement | null) {
  if (!root) return;
  root.dataset.mode = "thumbs";
  root.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => {
    el.dataset.shown = "true";
  });
}

export function createStage({ hero, canvas, plot, reduced, onPhase, cards: initialCards = null, awaitCards = false }: StageOptions): StageHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    revealCards(initialCards);
    return { replay() {}, setCards: revealCards, destroy() {} };
  }

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
  /** 장면 시작(epoch)부터 구도가 완성되기까지 걸리는 시간(ms) */
  let settle = SETTLE_MS;

  let colors: string[] = [];

  // 썸네일 구도
  let mode: "abstract" | "thumbs" = "abstract";
  let cardsRoot: HTMLElement | null = null;
  let cards: CardState[] = [];
  let cardSig = "";
  /** 카드 묶음이 아직 연결되지 않았고, 곧 연결될 예정이다. */
  let awaiting = awaitCards && !initialCards;
  let waitUntil = WAIT_MAX_MS;
  let waitTimer: ReturnType<typeof setTimeout> | null = null;
  let colorIdx = new Uint8Array(0);
  let cardOf = new Int16Array(0);
  /** 입자별 색 문자열(썸네일에서 읽은 색). null이면 토큰 색. */
  let css: (string | null)[] = [];
  /** 구도가 바뀌기 직전의 색. tintAt부터 TINT_MS 동안 섞어 그린다. */
  let prevCss: (string | null)[] = [];
  let tintAt = -1e6;
  /** 카드별 입자층의 기본 불투명도(1: 모이는 중, 0: 원본이 드러남) */
  let veil = new Float32Array(0);
  let scratch: HTMLCanvasElement | null = null;

  // 시간: 화면에 보이는 동안만 흐르는 자체 시계(ms)
  let clock = 0;
  /** 모이기 시작하는 시각. 카드·이미지를 기다리는 동안은 Infinity다. */
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

  /** 이미지가 실제로 그려질 수 있는지 확인한다. 끝나면 구도를 다시 정한다. */
  function probe(card: CardState) {
    const img = card.img;
    if (!img) {
      card.status = "failed";
      card.thumb.dataset.failed = "true";
      return;
    }
    if (img.complete && img.naturalWidth > 0) {
      card.status = "ready";
      return;
    }
    card.status = "loading";
    const finish = () => {
      card.off?.();
      // 그사이 엔진이 정리됐거나 카드 묶음이 바뀌었으면 무시한다.
      if (destroyed || !cards.includes(card) || card.status !== "loading") return;
      card.status = img.naturalWidth > 0 ? "ready" : "failed";
      if (card.status === "failed") card.thumb.dataset.failed = "true";
      evaluate();
      draw();
    };
    const listen = () => {
      if (destroyed || !cards.includes(card)) return;
      img.addEventListener("load", finish);
      img.addEventListener("error", finish);
      card.off = () => {
        img.removeEventListener("load", finish);
        img.removeEventListener("error", finish);
        card.off = null;
      };
    };
    // decode()는 이미 깨진 이미지에는 바로 거절하고, 받는 중이면 끝날 때까지 기다린다.
    // 받는 도중에 거절하는 브라우저가 있으면 load·error 이벤트로 마저 기다린다.
    if (typeof img.decode === "function") img.decode().then(finish, () => (img.complete ? finish() : listen()));
    else listen();
  }

  /** 카드 썸네일 상자를 캔버스 좌표로 다시 읽는다. 배치가 같으면 같은 문자열을 돌려준다. */
  function readCards(cr: { left: number; top: number }) {
    let sig = "";
    for (const c of cards) {
      const r = c.thumb.getBoundingClientRect();
      c.visible = r.width >= MIN_CELL * 4 && r.height >= MIN_CELL * 3;
      c.x = r.left - cr.left;
      c.y = r.top - cr.top;
      c.w = r.width;
      c.h = r.height;
      if (!c.visible) {
        sig += "-;";
        continue;
      }
      sig += `${Math.round(c.x)},${Math.round(c.y)},${Math.round(c.w)},${Math.round(c.h)};`;
      if (c.status === "idle") probe(c);
    }
    return sig;
  }

  /** 캔버스와 plot 상자, 카드 배치를 다시 잰다. 달라진 것이 없으면 false. */
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
    const sig = readCards(cr);
    if (nw === w && nh === h && nd === dpr && npx === plotX && npy === plotY && npw === plotW && nph === plotH && sig === cardSig) return false;
    cardSig = sig;
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

  /** 썸네일을 nx×ny 셀의 평균색으로 읽는다. 읽을 수 없으면(교차 출처로 오염된 캔버스 등) null. */
  function sampleCard(card: CardState, nx: number, ny: number) {
    if (card.sample && card.sample.nx === nx && card.sample.ny === ny) return card.sample.rgb;
    const img = card.img;
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    try {
      scratch ??= document.createElement("canvas");
      const sw = nx * SUPERSAMPLE;
      const sh = ny * SUPERSAMPLE;
      scratch.width = sw;
      scratch.height = sh;
      const sctx = scratch.getContext("2d", { willReadFrequently: true });
      if (!sctx) return null;
      sctx.imageSmoothingQuality = "high";
      // object-fit: cover와 같은 영역을 잘라 읽는다.
      const boxAspect = card.w / card.h;
      let cw = img.naturalWidth;
      let ch = img.naturalHeight;
      if (cw / ch > boxAspect) cw = ch * boxAspect;
      else ch = cw / boxAspect;
      sctx.drawImage(img, (img.naturalWidth - cw) / 2, (img.naturalHeight - ch) / 2, cw, ch, 0, 0, sw, sh);
      const rgb = averageCells(sctx.getImageData(0, 0, sw, sh).data, nx, ny, SUPERSAMPLE);
      card.sample = { nx, ny, rgb };
      return rgb;
    } catch {
      return null;
    }
  }

  /** 화면에 보이는 카드마다 모이는 순서를 정하고, 쓸 수 있는 썸네일을 입자 목표로 바꾼다. */
  function thumbTargets() {
    const visible = cards.filter((c) => c.visible);
    const usable = visible.filter((c) => c.status === "ready" || c.status === "plain").length;
    const budget = usable ? Math.floor(particleCap(w) / usable) : 0;
    const sources: ThumbSource[] = [];
    let latest = 0;
    visible.forEach((c, order) => {
      // 뒤늦게 합류한 카드는 지금부터 모인다.
      if (c.at < 0) c.at = Math.max(CARD_LEAD + order * CARD_STAGGER, clock - epoch);
      if (c.at > latest) latest = c.at;
      if (reduced || (c.status !== "ready" && c.status !== "plain")) return;
      const { nx, ny } = thumbGrid(c.w, c.h, budget);
      if (!nx) return;
      let rgb: Uint8ClampedArray | null = null;
      if (c.status === "ready") {
        rgb = sampleCard(c, nx, ny);
        if (!rgb) c.status = "plain";
      }
      sources.push({ x: c.x, y: c.y, w: c.w, h: c.h, nx, ny, rgb, at: c.at, card: cards.indexOf(c) });
    });
    settle = latest + REVEAL_START + REVEAL_MS;
    return buildThumbTargets(sources);
  }

  /** 목표 좌표를 새로 만들고, 이미 떠 있는 입자는 위치·속도를 이어받는다. */
  function rebuild() {
    // 정적 모드에서 카드를 기다리는 동안에는 아무것도 그리지 않는다(추상 격자가 잠깐 비치지 않게).
    const targets = mode === "thumbs" ? thumbTargets() : reduced && epoch === Infinity ? [] : buildTargets(plotX, plotY, plotW, plotH, particleCap(w));
    const m = targets.length;
    const nxs = new Float32Array(m);
    const nys = new Float32Array(m);
    const nvx = new Float32Array(m);
    const nvy = new Float32Array(m);
    const nseed = new Float32Array(m);
    const ncolor = new Uint8Array(m);
    const ncard = new Int16Array(m).fill(-1);
    const ncss = new Array<string | null>(m).fill(null);
    const nprev = new Array<string | null>(m).fill(null);
    hx = new Float32Array(m);
    hy = new Float32Array(m);
    rad = new Float32Array(m);
    delay = new Float32Array(m);
    const counts = new Array<number>(COLOR_VARS.length).fill(0);
    let maxDelay = 0;

    for (let i = 0; i < m; i++) {
      const t = targets[i];
      hx[i] = t.x;
      hy[i] = t.y;
      rad[i] = t.r;
      delay[i] = t.d;
      if (t.d > maxDelay) maxDelay = t.d;
      counts[t.c]++;
      ncolor[i] = t.c;
      if (t.card !== undefined) ncard[i] = t.card;
      if (t.rgb !== undefined) ncss[i] = hex(t.rgb);
      if (i < n) nprev[i] = css[i] ?? colors[colorIdx[i]];
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
    colorIdx = ncolor;
    cardOf = ncard;
    css = ncss;
    prevCss = nprev;
    n = m;
    if (mode === "thumbs") {
      tintAt = clock;
      veil = new Float32Array(cards.length).fill(1);
      updateCards();
    } else {
      settle = maxDelay + SETTLE_MS;
    }
  }

  function show(card: CardState) {
    if (card.shown) return;
    card.shown = true;
    card.el.dataset.shown = "true";
  }

  function hide(card: CardState) {
    card.shown = false;
    delete card.el.dataset.shown;
  }

  function setRootMode(value: "wait" | "thumbs" | "abstract") {
    if (cardsRoot && cardsRoot.dataset.mode !== value) cardsRoot.dataset.mode = value;
  }

  /** 카드마다 원본을 드러낼 때가 됐는지 보고, 입자층의 불투명도를 맞춘다. */
  function updateCards() {
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (!c.visible || c.at < 0) continue;
      const t = reduced ? REVEAL_MS : clock - epoch - c.at - REVEAL_START;
      if (t >= 0) show(c);
      veil[i] = t <= 0 ? 1 : t >= REVEAL_MS ? 0 : 1 - smooth(t / REVEAL_MS);
    }
  }

  function wants(): "hold" | "thumbs" | "abstract" {
    const visible = cards.filter((c) => c.visible);
    if (!visible.length) return awaiting && clock < waitUntil ? "hold" : "abstract";
    if (reduced) return "thumbs";
    const pending = visible.some((c) => c.status === "loading");
    // 이미 썸네일 구도라면 새 이미지를 기다리느라 되돌리지 않는다(도착하면 합류한다).
    if (pending && clock < waitUntil && mode !== "thumbs") return "hold";
    if (visible.some((c) => c.status === "ready" || c.status === "plain")) return "thumbs";
    // 전부 깨졌거나, 기다리다 시간이 다 됐다. 늦게라도 도착하면 그때 썸네일 구도로 바꾼다.
    return "abstract";
  }

  /** 카드·이미지 상태에 맞는 구도를 고르고 목표를 다시 만든다. */
  function evaluate() {
    if (destroyed) return;
    const want = wants();
    const held = epoch === Infinity;
    if (want === "hold") {
      // 아직 모이기 전이면 흩어진 채로 기다린다. 이미 추상 격자로 모이는 중이면 그대로 둔다.
      if (clock < epoch) epoch = Infinity;
      mode = "abstract";
      rebuild();
      setRootMode("wait");
      return;
    }
    if (want === "thumbs") {
      const restart = held || mode !== "thumbs";
      mode = "thumbs";
      if (restart) {
        epoch = Math.max(clock + 120, HOLD_MS);
        for (const c of cards) {
          c.at = -1;
          hide(c);
        }
      }
      rebuild();
      setRootMode("thumbs");
      return;
    }
    mode = "abstract";
    if (held) epoch = Math.max(clock, HOLD_MS);
    rebuild();
    // 아직 받는 중인 이미지가 있으면 카드를 가린 채로 두고, 전부 쓸 수 없으면 카드를 감춘다.
    setRootMode(cards.some((c) => c.visible && c.status === "loading") ? "wait" : "abstract");
  }

  function detach() {
    for (const c of cards) {
      c.off?.();
      hide(c);
    }
    if (cardsRoot) {
      ro?.unobserve(cardsRoot);
      delete cardsRoot.dataset.mode;
    }
    cards = [];
    cardsRoot = null;
    cardSig = "";
  }

  function attach(root: HTMLElement | null) {
    detach();
    if (!root) return;
    cardsRoot = root;
    root.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => {
      const thumb = el.querySelector<HTMLElement>("[data-thumb]");
      if (!thumb) return;
      delete el.dataset.shown;
      cards.push({
        el,
        thumb,
        img: thumb.querySelector("img"),
        status: thumb.dataset.failed === "true" ? "failed" : "idle",
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        visible: false,
        at: -1,
        shown: false,
        sample: null,
        off: null,
      });
    });
    ro?.observe(root);
  }

  function clearWaitTimer() {
    if (waitTimer !== null) clearTimeout(waitTimer);
    waitTimer = null;
  }

  /** 입자마다 색과 불투명도가 달라 하나씩 그린다. 제자리에 있고 원본이 드러난 입자는 건너뛴다. */
  function drawThumbs() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const tint = clamp((clock - tintAt) / TINT_MS, 0, 1);
    const lift2 = LIFT_PX * LIFT_PX;
    const neutral = colors[DIM];
    let style = "";
    for (let i = 0; i < n; i++) {
      const dx = x[i] - hx[i];
      const dy = y[i] - hy[i];
      const d2 = dx * dx + dy * dy;
      const lift = Math.min(1, d2 / lift2);
      const base = veil[cardOf[i]];
      // 들뜬 입자는 살짝 비치게 두어 아래 원본이 계속 읽히게 한다.
      const alpha = base > lift * LIFT_ALPHA ? base : lift * LIFT_ALPHA;
      if (alpha < 0.02) continue;
      // 제자리에서는 셀을 채우는 크기, 들뜨면 조금 작게(틈으로 원본이 보인다), 멀리 흩어지면 작은 점.
      const far = d2 > FAR_FROM * FAR_FROM ? Math.min(1, (Math.sqrt(d2) - FAR_FROM) / FAR_SPAN) : 0;
      const r = rad[i] * (1 - 0.15 * lift) * (1 - 0.4 * far);
      const now = css[i] ?? neutral;
      const before = tint < 1 ? prevCss[i] : null;
      if (before && before !== now) {
        ctx.globalAlpha = alpha * (1 - tint);
        ctx.fillStyle = before;
        ctx.beginPath();
        ctx.arc(x[i], y[i], r, 0, TAU);
        ctx.fill();
        style = "";
        if (tint <= 0) continue;
        ctx.globalAlpha = alpha * tint;
      } else {
        ctx.globalAlpha = alpha;
      }
      if (now !== style) {
        ctx.fillStyle = now;
        style = now;
      }
      ctx.beginPath();
      ctx.arc(x[i], y[i], r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 색 묶음마다 경로 하나로 그린다(프레임당 fill 호출은 색 수만큼). */
  function draw() {
    if (!ctx) return;
    if (mode === "thumbs") {
      drawThumbs();
      return;
    }
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
      // 썸네일 위에서는 구멍을 내기보다 살짝 들뜨는 정도로 민다.
      fr = mode === "thumbs" ? THUMB_POINTER_R : POINTER_R;
      force = mode === "thumbs" ? THUMB_POINTER_F : POINTER_F;
      dragX = pointer.vx * POINTER_DRAG;
      dragY = pointer.vy * POINTER_DRAG;
    } else if (phase === "archive") {
      const idleFrom = Math.max(pointer.at, epoch + settle);
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

    // 카드·이미지를 기다리다 시간이 다 되면 지금 있는 것으로 시작한다.
    if (epoch === Infinity && clock >= waitUntil) {
      awaiting = false;
      evaluate();
    }

    const next: Phase = clock < epoch ? "scattered" : clock < epoch + settle ? "gathering" : "archive";
    if (next !== phase) {
      phase = next;
      onPhase(next);
    }

    if (mode === "thumbs") updateCards();
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
    if (destroyed || !measure()) return;
    evaluate();
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
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(relayout) : null;
  readColors();
  attach(initialCards);
  measure();
  evaluate();
  draw();

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
    // 프레임 루프가 없으므로, 카드가 끝내 연결되지 않으면 타이머로 추상 격자를 그린다.
    if (awaiting) {
      waitTimer = setTimeout(() => {
        waitTimer = null;
        awaiting = false;
        evaluate();
        draw();
      }, WAIT_MAX_MS);
    }
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
      // 카드·이미지를 기다리는 중이면 아직 모인 것이 없다.
      if (reduced || destroyed || epoch === Infinity) return;
      epoch = clock + 1500;
      pointer.at = clock;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const speed = 4 + Math.random() * 7;
        vx[i] += Math.cos(a) * speed;
        vy[i] += Math.sin(a) * speed;
      }
      if (mode === "thumbs") {
        // 원본을 다시 가리고 카드 순서대로 처음부터 모은다.
        for (const c of cards) {
          c.at = -1;
          hide(c);
        }
        rebuild();
      }
      sync();
    },
    setCards(root) {
      if (destroyed) return;
      clearWaitTimer();
      awaiting = false;
      attach(root);
      // 늦게 연결됐어도 이미지를 받을 시간은 준다.
      if (root) waitUntil = Math.max(waitUntil, clock + 1200);
      measure();
      evaluate();
      draw();
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearWaitTimer();
      // 카드의 표시 상태(data-shown 등)는 건드리지 않는다. 다음 엔진이 이어받거나 화면에서 사라진다.
      for (const c of cards) c.off?.();
      cards = [];
      cardsRoot = null;
      if (scratch) {
        // 샘플링용 캔버스의 픽셀 버퍼를 바로 놓아 준다.
        scratch.width = 0;
        scratch.height = 0;
        scratch = null;
      }
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
