import { useSyncExternalStore } from "react";
import { DEFAULT_DATA, type AppData, type Book, type BookStatus, type Watch, type WatchStatus } from "./types";

const KEY = "jarvis-personal-os/v1";

let state: AppData = DEFAULT_DATA;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppData>;
      state = {
        ...DEFAULT_DATA,
        ...parsed,
        books: migrateBooks(parsed.books),
        watchlist: migrateWatchlist(parsed.watchlist),
        settings: {
          ...DEFAULT_DATA.settings,
          ...(parsed.settings ?? {}),
          notify: { ...DEFAULT_DATA.settings.notify, ...(parsed.settings?.notify ?? {}) },
        },
      };
    }
  } catch {
    state = DEFAULT_DATA;
  }
  // apply theme
  if (state.settings.theme === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}

function migrateBooks(books: any[]): Book[] {
  return (books ?? []).map((b) => {
    if (b && typeof b.status === "string") return b as Book;
    const status: BookStatus = b?.read === true ? "read" : "to-read";
    const { read: _, ...rest } = b ?? {};
    return { ...rest, status } as Book;
  });
}

function migrateWatchlist(watchlist: any[]): Watch[] {
  return (watchlist ?? []).map((w) => {
    if (w && typeof w.status === "string") return w as Watch;
    const status: WatchStatus = w?.watched === true ? "watched" : "to-watch";
    const { watched: _, ...rest } = w ?? {};
    return { ...rest, status } as Watch;
  });
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function getState(): AppData {
  load();
  return state;
}

export function setState(updater: (s: AppData) => AppData) {
  load();
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useStore<T>(selector: (s: AppData) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(DEFAULT_DATA),
  );
}

export function useAppData(): AppData {
  return useStore((s) => s);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// Simple password "hash" — local only, not real security
export function hashPwd(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function clearAll() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  state = DEFAULT_DATA;
  loaded = false;
  load();
  listeners.forEach((l) => l());
}
