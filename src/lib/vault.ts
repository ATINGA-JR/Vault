// Zero-knowledge password vault. AES-GCM with PBKDF2-derived key.
// The master password is never stored; only an encrypted blob lives in localStorage.
import { useSyncExternalStore } from "react";

const KEY = "jarvis-vault/v1";
const ITERATIONS = 250_000;

export interface VaultEntry {
  id: string;
  name: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredBlob {
  salt: string; // base64
  iv: string;   // base64
  ct: string;   // base64 ciphertext of JSON entries
}

interface VaultState {
  initialized: boolean;   // a blob exists in storage
  unlocked: boolean;      // we have a key in memory
  entries: VaultEntry[];
}

let key: CryptoKey | null = null;
let salt: Uint8Array | null = null;
let state: VaultState = { initialized: false, unlocked: false, entries: [] };
let loaded = false;
const listeners = new Set<() => void>();

// ---------- base64 helpers ----------
function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- storage ----------
function readBlob(): StoredBlob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredBlob) : null;
  } catch {
    return null;
  }
}
function writeBlob(b: StoredBlob) {
  localStorage.setItem(KEY, JSON.stringify(b));
}

function loadOnce() {
  if (loaded) return;
  loaded = true;
  const blob = readBlob();
  state = { initialized: !!blob, unlocked: false, entries: [] };
}

// ---------- crypto ----------
async function deriveKey(password: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptEntries(entries: VaultEntry[]): Promise<StoredBlob> {
  if (!key || !salt) throw new Error("Vault locked");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(entries));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct) };
}

// ---------- public API ----------
function emit() {
  listeners.forEach((l) => l());
}

export async function createVault(password: string) {
  if (password.length < 8) throw new Error("Master password must be at least 8 characters.");
  salt = crypto.getRandomValues(new Uint8Array(16));
  key = await deriveKey(password, salt);
  const blob = await encryptEntries([]);
  writeBlob(blob);
  state = { initialized: true, unlocked: true, entries: [] };
  emit();
}

export async function unlockVault(password: string): Promise<boolean> {
  const blob = readBlob();
  if (!blob) return false;
  const saltBytes = b64decode(blob.salt);
  const candidate = await deriveKey(password, saltBytes);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64decode(blob.iv) },
      candidate,
      b64decode(blob.ct),
    );
    const entries = JSON.parse(new TextDecoder().decode(pt)) as VaultEntry[];
    key = candidate;
    salt = saltBytes;
    state = { initialized: true, unlocked: true, entries };
    emit();
    return true;
  } catch {
    return false;
  }
}

export function lockVault() {
  key = null;
  salt = null;
  state = { ...state, unlocked: false, entries: [] };
  emit();
}

async function persistEntries(next: VaultEntry[]) {
  const blob = await encryptEntries(next);
  writeBlob(blob);
  state = { ...state, entries: next };
  emit();
}

export async function upsertEntry(entry: VaultEntry) {
  const exists = state.entries.some((e) => e.id === entry.id);
  const next = exists
    ? state.entries.map((e) => (e.id === entry.id ? entry : e))
    : [entry, ...state.entries];
  await persistEntries(next);
}

export async function deleteEntry(id: string) {
  await persistEntries(state.entries.filter((e) => e.id !== id));
}

export async function changeMasterPassword(current: string, next: string) {
  const ok = await unlockVault(current);
  if (!ok) throw new Error("Current password is incorrect.");
  if (next.length < 8) throw new Error("New password must be at least 8 characters.");
  salt = crypto.getRandomValues(new Uint8Array(16));
  key = await deriveKey(next, salt);
  const blob = await encryptEntries(state.entries);
  writeBlob(blob);
  emit();
}

export function destroyVault() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
  key = null;
  salt = null;
  state = { initialized: false, unlocked: false, entries: [] };
  emit();
}

export function useVault<T>(selector: (s: VaultState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      loadOnce();
      return selector(state);
    },
    () => selector({ initialized: false, unlocked: false, entries: [] }),
  );
}

export function vid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// Password generator
export function generatePassword(length = 20, opts?: { symbols?: boolean }): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+?";
  const charset = lower + upper + digits + (opts?.symbols !== false ? symbols : "");
  const buf = crypto.getRandomValues(new Uint32Array(length));
  let out = "";
  for (let i = 0; i < length; i++) out += charset[buf[i] % charset.length];
  return out;
}
