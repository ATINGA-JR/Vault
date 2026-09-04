import { useSyncExternalStore } from "react";
import { DEFAULT_DATA, type AppData } from "./types";
import * as db from "./db";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

let state: AppData = DEFAULT_DATA;
let currentUserId: string | null = null;
let storeReady = false;
let realtimeChannel: RealtimeChannel | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export async function initStore(userId: string) {
  currentUserId = userId;
  storeReady = false;

  try {
    const data = await db.loadUserData(userId);
    state = { ...DEFAULT_DATA, ...data };
  } catch (err) {
    console.error("[store] Failed to load from Supabase:", err);
    state = DEFAULT_DATA;
  }

  storeReady = true;

  if (state.settings.theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  notify();
  subscribeRealtime(userId);
}

export function clearStore() {
  unsubscribeRealtime();
  currentUserId = null;
  storeReady = false;
  state = DEFAULT_DATA;
  notify();
}

export function isStoreReady(): boolean {
  return storeReady;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

const REALTIME_TABLES = [
  "tasks", "books", "movies", "shows",
  "shopping_lists", "shopping_sections", "shopping_items",
  "notifications", "settings",
];

function subscribeRealtime(userId: string) {
  unsubscribeRealtime();
  const channel = supabase.channel(`vault-sync-${userId}`);
  for (const table of REALTIME_TABLES) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
      () => scheduleReload(userId),
    );
  }
  channel.subscribe();
  realtimeChannel = channel;
}

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
}

function scheduleReload(userId: string) {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if (currentUserId !== userId) return;
    try {
      const data = await db.loadUserData(userId);
      state = { ...state, ...data };
      notify();
    } catch (err) {
      console.error("[store] Realtime reload failed:", err);
    }
  }, 700);
}

export function getState(): AppData {
  return state;
}

export function setState(updater: (s: AppData) => AppData) {
  const old = state;
  state = updater(state);
  notify();

  if (!currentUserId) return;
  const uid = currentUserId;

  if (old.tasks !== state.tasks)
    db.syncTasks(uid, state.tasks).catch(console.error);

  if (old.books !== state.books)
    db.syncBooks(uid, state.books).catch(console.error);

  if (old.movies !== state.movies)
    db.syncMovies(uid, state.movies).catch(console.error);

  if (old.shows !== state.shows)
    db.syncShows(uid, state.shows).catch(console.error);

  if (old.shoppingLists !== state.shoppingLists)
    db.syncShoppingLists(uid, state.shoppingLists).catch(console.error);

  if (old.notifications !== state.notifications)
    db.syncNotifications(uid, state.notifications).catch(console.error);

  if (old.settings !== state.settings || old.lastWeeklySummary !== state.lastWeeklySummary)
    db.syncSettings(uid, state.settings, state.lastWeeklySummary).catch(console.error);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStore<T>(selector: (s: AppData) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(DEFAULT_DATA),
  );
}

export function useAppData(): AppData {
  return useStore((s) => s);
}

export function uid(): string {
  return crypto.randomUUID();
}

export function clearAll() {
  clearStore();
}

/** @deprecated */
export function hashPwd(_s: string): string {
  return "";
}
