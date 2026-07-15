import { useSyncExternalStore } from "react";
import { DEFAULT_DATA, type AppData } from "./types";
import * as db from "./db";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// Module-level state — single source of truth in memory
// ─────────────────────────────────────────────────────────────
let state: AppData = DEFAULT_DATA;
let currentUserId: string | null = null;
let storeReady = false;
let realtimeChannel: RealtimeChannel | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
// Tracks whether the pending reload originated from THIS tab's own write
// (via setState) vs. a change detected from elsewhere. Used only for
// debugging/logging; both cases reload the same way.
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

// ─────────────────────────────────────────────────────────────
// Auth lifecycle — called from auth.tsx on session change
// ─────────────────────────────────────────────────────────────

/** Load all user data from Supabase and populate in-memory state. */
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

  // Apply saved theme immediately
  if (state.settings.theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  notify();
  subscribeRealtime(userId);
}

/** Reset in-memory state on sign-out. */
export function clearStore() {
  unsubscribeRealtime();
  currentUserId = null;
  storeReady = false;
  state = DEFAULT_DATA;
  notify();
}

/** True once initStore has finished loading from Supabase. */
export function isStoreReady(): boolean {
  return storeReady;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

// ─────────────────────────────────────────────────────────────
// Realtime sync — keeps every open tab/device in sync live.
// Any change (from this device or another) triggers a debounced
// reload of the full dataset from Supabase.
// ─────────────────────────────────────────────────────────────

const REALTIME_TABLES = [
  "tasks", "banks", "transactions", "books", "watchlist",
  "calendar_events", "shopping_lists", "shopping_sections",
  "shopping_items", "notifications", "settings",
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

// Debounce: multiple rapid changes (e.g. bulk import) collapse into
// a single reload after things settle, instead of hammering Supabase.
function scheduleReload(userId: string) {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if (currentUserId !== userId) return; // user changed/signed out mid-wait
    try {
      const data = await db.loadUserData(userId);
      state = { ...state, ...data };
      notify();
    } catch (err) {
      console.error("[store] Realtime reload failed:", err);
    }
  }, 700);
}

// ─────────────────────────────────────────────────────────────
// Core API — same signatures as the old localStorage store
// ─────────────────────────────────────────────────────────────

export function getState(): AppData {
  return state;
}

export function setState(updater: (s: AppData) => AppData) {
  const old = state;
  state = updater(state);
  notify();

  // Background-sync only the slices that actually changed.
  // Each sync is fire-and-forget; errors are logged, not thrown.
  if (!currentUserId) return;
  const uid = currentUserId;

  if (old.tasks !== state.tasks)
    db.syncTasks(uid, state.tasks).catch(console.error);

  if (old.banks !== state.banks)
    db.syncBanks(uid, state.banks).catch(console.error);

  if (old.transactions !== state.transactions)
    db.syncTransactions(uid, state.transactions).catch(console.error);

  if (old.books !== state.books)
    db.syncBooks(uid, state.books).catch(console.error);

  if (old.watchlist !== state.watchlist)
    db.syncWatchlist(uid, state.watchlist).catch(console.error);

  if (old.events !== state.events)
    db.syncEvents(uid, state.events).catch(console.error);

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

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

/** Generate a valid UUID v4 for use as record IDs. */
export function uid(): string {
  return crypto.randomUUID();
}

export function clearAll() {
  clearStore();
}

/** @deprecated — auth is now handled by Supabase, not a local hash. */
export function hashPwd(_s: string): string {
  return "";
}
