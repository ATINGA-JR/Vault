// Zero-knowledge password vault. AES-GCM with PBKDF2-derived key.
// The master password never leaves the browser.
// Only the encrypted blob (salt + iv + ciphertext) is stored in Supabase.
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

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
  initialized: boolean; // a blob exists in Supabase
  unlocked: boolean;    // we have a key in memory
  entries: VaultEntry[];
}

let vaultUserId: string | null = null;
let key: CryptoKey | null = null;
let salt: Uint8Array | null = null;
let state: VaultState = { initialized: false, unlocked: false, entries: [] };
const listeners = new Set<() => void>();

// ── base64 helpers ────────────────────────────────────────────
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

// ── Supabase storage ──────────────────────────────────────────
async function readBlobFromSupabase(): Promise<StoredBlob | null> {
  if (!vaultUserId) return null;
  const { data, error } = await supabase
    .from("vault_blob")
    .select("salt, iv, ct")
    .eq("user_id", vaultUserId)
    .single();
  if (error || !data) return null;
  return data as StoredBlob;
}

async function writeBlobToSupabase(blob: StoredBlob): Promise<void> {
  if (!vaultUserId) throw new Error("Vault not initialized — no user ID.");
  await supabase.from("vault_blob").upsert(
    {
      user_id: vaultUserId,
      salt: blob.salt,
      iv: blob.iv,
      ct: blob.ct,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

// ── crypto ────────────────────────────────────────────────────
async function deriveKey(password: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptEntries(entries: VaultEntry[]): Promise<StoredBlob> {
  if (!key || !salt) throw new Error("Vault is locked.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(entries));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return { salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct) };
}

// ── init / clear ──────────────────────────────────────────────

/** Called from auth.tsx when the user signs in. */
export async function initVault(userId: string) {
  vaultUserId = userId;
  const blob = await readBlobFromSupabase();
  state = { initialized: !!blob, unlocked: false, entries: [] };
  emit();
}

/** Called from auth.tsx when the user signs out. */
export function clearVault() {
  vaultUserId = null;
  key = null;
  salt = null;
  state = { initialized: false, unlocked: false, entries: [] };
  emit();
}

// ── public API ────────────────────────────────────────────────
function emit() {
  listeners.forEach((l) => l());
}

export async function createVault(password: string) {
  if (password.length < 8) throw new Error("Master password must be at least 8 characters.");
  salt = crypto.getRandomValues(new Uint8Array(16));
  key = await deriveKey(password, salt);
  const blob = await encryptEntries([]);
  await writeBlobToSupabase(blob);
  state = { initialized: true, unlocked: true, entries: [] };
  emit();
}

export async function unlockVault(password: string): Promise<boolean> {
  const blob = await readBlobFromSupabase();
  if (!blob) return false;
  const saltBytes = b64decode(blob.salt);
  const candidate = await deriveKey(password, saltBytes);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64decode(blob.iv) as BufferSource },
      candidate,
      b64decode(blob.ct) as BufferSource,
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
  await writeBlobToSupabase(blob);
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
  await writeBlobToSupabase(blob);
  emit();
}

export async function destroyVault() {
  if (vaultUserId) {
    await supabase.from("vault_blob").delete().eq("user_id", vaultUserId);
  }
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
    () => selector(state),
    () => selector({ initialized: false, unlocked: false, entries: [] }),
  );
}

export function vid(): string {
  return crypto.randomUUID();
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
