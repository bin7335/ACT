"use client";

import { useSyncExternalStore } from "react";

// 즐겨찾기는 로그인 없이 이 브라우저에만 저장한다. 로그인을 붙이면 서버 저장으로 옮긴다.
const KEY = "act:favorites";
const EVENT = "act:favorites-change";
const HINT_KEY = "act:favorites-hint";
const HINT_EVENT = "act:favorites-hint";
const EMPTY: string[] = [];

let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.list;
  let list: string[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    list = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : EMPTY;
  } catch {
    list = EMPTY;
  }
  cache = { raw, list };
  return list;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, cb);
  };
}

export function useFavorites() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleFavorite(slug: string) {
  const list = read();
  const next = list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENT));
  const on = next.includes(slug);
  if (on) announceFirstFavorite(list.length === 0);
  return on;
}

/** 이 브라우저에서 처음 담았을 때 한 번만 안내를 띄운다(이미 담아 둔 작품이 있으면 띄우지 않는다). */
function announceFirstFavorite(wasEmpty: boolean) {
  try {
    if (window.localStorage.getItem(HINT_KEY)) return;
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    return;
  }
  if (wasEmpty) window.dispatchEvent(new Event(HINT_EVENT));
}

/** 첫 즐겨찾기 안내를 띄울 때 불린다. 돌려주는 함수로 구독을 끊는다. */
export function onFirstFavorite(cb: () => void) {
  window.addEventListener(HINT_EVENT, cb);
  return () => window.removeEventListener(HINT_EVENT, cb);
}
