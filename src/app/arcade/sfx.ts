/**
 * 아케이드 효과음. 음원 파일 없이 Web Audio로 짧은 칩튠 소리를 합성한다.
 * 브라우저는 사용자 조작(탭·키) 뒤에만 소리를 내므로, 첫 호출 때 AudioContext를 만든다.
 */
export type Sfx = "move" | "select" | "start" | "back";

const KEY = "act-arcade-muted";
let ctx: AudioContext | null = null;
let muted: boolean | null = null;

export function isMuted() {
  if (muted === null) {
    try {
      muted = localStorage.getItem(KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

const listeners = new Set<() => void>();
/** useSyncExternalStore용 구독 */
export function subscribeMuted(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setMuted(v: boolean) {
  muted = v;
  listeners.forEach((fn) => fn());
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* 저장이 막힌 환경에서는 이번 방문 동안만 기억한다 */
  }
}

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 음 하나. at은 지금부터의 지연(초). */
function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function sfx(kind: Sfx) {
  if (isMuted()) return;
  const c = audio();
  if (!c) return;
  switch (kind) {
    case "move": // 커서 이동 — 짧은 틱
      tone(c, 1320, 0, 0.035, "square", 0.04);
      break;
    case "select": // 선택 — 위로 튀는 두 음
      tone(c, 880, 0, 0.06, "square", 0.06);
      tone(c, 1320, 0.055, 0.09, "square", 0.06);
      break;
    case "start": // 입장 — 상승 아르페지오 + 반짝임
      [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.06, 0.12, "square", 0.06));
      tone(c, 2093, 0.24, 0.25, "triangle", 0.05, 3136);
      break;
    case "back": // 닫기 — 아래로 떨어지는 음
      tone(c, 660, 0, 0.09, "square", 0.05, 330);
      break;
  }
}
