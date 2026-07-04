import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShieldCheck, Lock, Unlock, Plus, Search, Copy, Eye, EyeOff, Trash2, Pencil, RefreshCw, KeyRound, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import {
  useVault, createVault, unlockVault, lockVault, upsertEntry, deleteEntry,
  destroyVault, generatePassword, vid, type VaultEntry,
} from "@/lib/vault";

export const Route = createFileRoute("/vault")({
  component: VaultPage,
});

function VaultPage() {
  const initialized = useVault((s) => s.initialized);
  const unlocked = useVault((s) => s.unlocked);

  if (!initialized) return <SetupVault />;
  if (!unlocked) return <UnlockScreen />;
  return <VaultBrowser />;
}

// ---------------- Setup ----------------
function SetupVault() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      await createVault(pwd);
      toast.success("Passcodes vault created");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenterShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-display text-2xl tracking-tight">Initialize Passcodes</h1>
          <p className="text-sm text-muted-foreground">Set a master password. Encryption happens on this device.</p>
        </div>
      </div>

      <div className="mb-5 rounded-md border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Read this once
        </div>
        Your master password is never stored or transmitted. If you forget it, your saved credentials cannot be recovered — by you or by anyone.
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Master password">
          <input type="password" autoFocus required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" placeholder="At least 8 characters" />
        </Field>
        <Field label="Confirm password">
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
        </Field>
        <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
          {busy ? "Creating…" : "Create passcodes vault"}
        </button>
      </form>
    </CenterShell>
  );
}

// ---------------- Unlock ----------------
function UnlockScreen() {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [danger, setDanger] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await unlockVault(pwd);
    setBusy(false);
    if (!ok) toast.error("Incorrect master password");
    else setPwd("");
  }

  return (
    <CenterShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-md bg-sidebar text-sidebar-foreground">
          <Lock className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-display text-2xl tracking-tight">Unlock Passcodes</h1>
          <p className="text-sm text-muted-foreground">Enter your master password to continue.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Master password">
          <input type="password" autoFocus required value={pwd} onChange={(e) => setPwd(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
        </Field>
        <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
          <span className="inline-flex items-center gap-2"><Unlock className="h-4 w-4" />{busy ? "Unlocking…" : "Unlock"}</span>
        </button>
      </form>

      <div className="mt-8 border-t border-border pt-5">
        {!danger ? (
          <button onClick={() => setDanger(true)} className="text-xs text-muted-foreground hover:text-destructive">
            Forgot master password?
          </button>
        ) : (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
            <div className="mb-2 font-medium text-destructive">Passcodes cannot be recovered.</div>
            <div className="mb-3 text-muted-foreground">The only option is to wipe it and start over. All saved credentials will be permanently lost.</div>
            <div className="flex gap-2">
              <button onClick={() => setDanger(false)} className="rounded-md border border-border px-3 py-1.5">Cancel</button>
              <button
                onClick={() => { destroyVault(); toast.success("Passcodes wiped"); }}
                className="rounded-md bg-destructive px-3 py-1.5 text-destructive-foreground"
              >Wipe passcodes</button>
            </div>
          </div>
        )}
      </div>
    </CenterShell>
  );
}

// ---------------- Browser ----------------
function VaultBrowser() {
  const entries = useVault((s) => s.entries);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      (e.url ?? "").toLowerCase().includes(q) ||
      (e.category ?? "").toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Encrypted · Local</div>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Passcodes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{entries.length} {entries.length === 1 ? "credential" : "credentials"} stored.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => lockVault()} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Lock</span>
          </button>
          <button onClick={() => setCreating(true)} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" />New entry</span>
          </button>
        </div>
      </header>

      <div className="mb-5 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, account, site…"
          className="w-full rounded-md border border-input bg-background py-2.5 pl-9 pr-3 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState onNew={() => setCreating(true)} hasQuery={!!query} />
      ) : (
        <div className="grid gap-3">
          {filtered.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onEdit={() => setEditing(entry)} />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <EntryDialog
          entry={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function EmptyState({ onNew, hasQuery }: { onNew: () => void; hasQuery: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 py-16 text-center">
      <KeyRound className="mx-auto mb-3 h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      <div className="font-display text-lg">{hasQuery ? "No matches" : "No passcodes yet"}</div>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        {hasQuery ? "Try a different search term." : "Add your first credential to begin."}
      </p>
      {!hasQuery && (
        <button onClick={onNew} className="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          Add entry
        </button>
      )}
    </div>
  );
}

function EntryCard({ entry, onEdit }: { entry: VaultEntry; onEdit: () => void }) {
  const [show, setShow] = useState(false);

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary font-display text-sm">
              {entry.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{entry.name}</div>
              {entry.category && <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{entry.category}</div>}
            </div>
          </div>

          <div className="mt-3 grid gap-1.5 text-sm">
            <Row label="Account" value={entry.username} onCopy={() => copy(entry.username, "Account")} />
            <Row
              label="Password"
              value={show ? entry.password : "•".repeat(Math.min(entry.password.length, 14))}
              monospace
              actions={
                <button onClick={() => setShow((s) => !s)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title={show ? "Hide" : "Show"}>
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              }
              onCopy={() => copy(entry.password, "Password")}
            />
            {entry.url && <Row label="URL" value={entry.url} onCopy={() => copy(entry.url!, "URL")} link />}
            {entry.notes && (
              <div className="mt-1 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground whitespace-pre-wrap">{entry.notes}</div>
            )}
          </div>
        </div>

        <button onClick={onEdit} className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Row({
  label, value, onCopy, monospace, actions, link,
}: { label: string; value: string; onCopy: () => void; monospace?: boolean; actions?: React.ReactNode; link?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {link ? (
        <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm text-primary hover:underline">{value}</a>
      ) : (
        <div className={`flex-1 truncate text-sm ${monospace ? "font-mono" : ""}`}>{value}</div>
      )}
      {actions}
      <button onClick={onCopy} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Copy">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------- Entry dialog ----------------
function EntryDialog({ entry, onClose }: { entry: VaultEntry | null; onClose: () => void }) {
  const isEdit = !!entry;
  const [form, setForm] = useState<VaultEntry>(
    entry ?? {
      id: vid(),
      name: "",
      username: "",
      password: "",
      url: "",
      notes: "",
      category: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );
  const [reveal, setReveal] = useState(!isEdit);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof VaultEntry>(k: K, v: VaultEntry[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.password) return toast.error("Name and password are required");
    setBusy(true);
    try {
      await upsertEntry({ ...form, updatedAt: new Date().toISOString() });
      toast.success(isEdit ? "Entry updated" : "Entry saved");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!entry) return;
    if (!confirm(`Delete "${entry.name}"? This can't be undone.`)) return;
    await deleteEntry(entry.id);
    toast.success("Entry deleted");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-lg rounded-t-xl border border-border bg-background p-6 shadow-2xl md:rounded-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl tracking-tight">{isEdit ? "Edit entry" : "New entry"}</h2>
            <p className="text-xs text-muted-foreground">Stored encrypted on this device.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={onSave} className="space-y-3">
          <Field label="Name *">
            <input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. GTBank, Gmail, Netflix"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <input value={form.category ?? ""} onChange={(e) => update("category", e.target.value)} placeholder="Banking, Email…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="URL">
              <input value={form.url ?? ""} onChange={(e) => update("url", e.target.value)} placeholder="example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
          </div>
          <Field label="Account / Username">
            <input value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Password *">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  required
                  type={reveal ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm font-mono"
                />
                <button type="button" onClick={() => setReveal((r) => !r)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent">
                  {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button type="button" onClick={() => { update("password", generatePassword(20)); setReveal(true); }}
                className="rounded-md border border-border px-3 text-sm hover:bg-accent" title="Generate strong password">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </Field>
          <Field label="Notes">
            <textarea value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </Field>

          <div className="flex items-center justify-between gap-2 pt-2">
            {isEdit ? (
              <button type="button" onClick={onDelete} className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                <span className="inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" />Delete</span>
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Cancel</button>
              <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------- shared ----------------
function CenterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
