import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, Section } from "@/components/app/ui-bits";
import { useStore, setState, clearAll } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Jarvis" }] }),
  component: () => (<AuthGate><AppShell><SettingsPage /></AppShell></AuthGate>),
});

function SettingsPage() {
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.settings);
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setState((s) => s.user ? ({ ...s, user: { ...s.user, username: username.trim(), email: email.trim() }, session: { username: username.trim() } }) : s);
    toast.success("Profile saved");
  }
  function setTheme(theme: "light" | "dark") {
    setState((s) => ({ ...s, settings: { ...s.settings, theme } }));
    if (theme === "dark") document.documentElement.classList.add("dark"); else document.documentElement.classList.remove("dark");
  }
  function toggleNotif(key: keyof typeof settings.notify, v: boolean) {
    setState((s) => ({ ...s, settings: { ...s.settings, notify: { ...s.settings.notify, [key]: v } } }));
  }
  function signOut() { setState((s) => ({ ...s, session: null })); }
  function wipe() {
    if (!confirm("Clear all local data? This cannot be undone.")) return;
    clearAll(); toast.success("Local data cleared");
  }

  if (!user) return null;

  return (
    <>
      <PageHeader eyebrow="Settings" title="Personal preferences." subtitle="Tune Jarvis to your taste." />

      <Section title="Profile">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 font-serif text-2xl text-primary">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-serif text-xl">{user.username}</div>
              <div className="text-xs text-muted-foreground">Member since {formatDate(user.createdAt)}</div>
            </div>
          </div>
          <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="md:col-span-2"><Button type="submit">Save profile</Button></div>
          </form>
        </div>
      </Section>

      <Section title="Appearance">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {(["light", "dark"] as const).map((t) => (
              <button key={t} onClick={() => setTheme(t)}
                className={`rounded-lg border p-4 text-left transition-all ${settings.theme === t ? "border-primary bg-primary/[0.06]" : "border-border hover:border-border-strong"}`}>
                <div className="font-serif text-lg capitalize">{t}</div>
                <div className="text-xs text-muted-foreground">{t === "light" ? "Warm paper" : "Quiet evening"}</div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Notifications">
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {([
            ["events", "Calendar events", "Reminders for events today and tomorrow"],
            ["tasks", "Tasks due", "Alerts for tasks due today or overdue"],
            ["budget", "Budget alerts", "Warn when spending exceeds 80% of income"],
            ["weekly", "Weekly summary", "Monday morning recap"],
          ] as const).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch checked={settings.notify[key]} onCheckedChange={(v) => toggleNotif(key, v)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Danger zone">
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
          <div>
            <Button variant="outline" onClick={wipe} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Clear local cache</Button>
            <p className="mt-2 text-xs text-muted-foreground">Removes all data on this device — tasks, transactions, books, everything.</p>
          </div>
        </div>
      </Section>
    </>
  );
}
