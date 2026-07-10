import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, Section } from "@/components/app/ui-bits";
import { useStore, setState } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Vault" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <SettingsPage />
      </AppShell>
    </AuthGate>
  ),
});

function SettingsPage() {
  const { user, username } = useAuth();
  const settings = useStore((s) => s.settings);
  const [wiping, setWiping] = useState(false);

  function setTheme(theme: "light" | "dark") {
    setState((s) => ({ ...s, settings: { ...s.settings, theme } }));
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  function toggleNotif(key: keyof typeof settings.notify, v: boolean) {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, notify: { ...s.settings.notify, [key]: v } },
    }));
  }

  async function signOut() {
    await supabase.auth.signOut();
    // AuthProvider's onAuthStateChange clears the store automatically
  }

  async function wipe() {
    if (!confirm("Clear all your data? This cannot be undone.")) return;
    if (!user) return;
    setWiping(true);
    try {
      // Delete all user data from every table (cascade handles children)
      await Promise.all([
        supabase.from("tasks").delete().eq("user_id", user.id),
        supabase.from("transactions").delete().eq("user_id", user.id),
        supabase.from("banks").delete().eq("user_id", user.id),
        supabase.from("books").delete().eq("user_id", user.id),
        supabase.from("watchlist").delete().eq("user_id", user.id),
        supabase.from("calendar_events").delete().eq("user_id", user.id),
        supabase.from("shopping_lists").delete().eq("user_id", user.id),
        supabase.from("notifications").delete().eq("user_id", user.id),
        supabase.from("vault_blob").delete().eq("user_id", user.id),
      ]);
      toast.success("All data cleared.");
      await supabase.auth.signOut();
    } catch {
      toast.error("Something went wrong while clearing data.");
    } finally {
      setWiping(false);
    }
  }

  if (!user) return null;

  const displayName = username ?? user.email?.split("@")[0] ?? "—";

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Personal preferences."
        subtitle="Tune Vault to your taste."
      />

      <Section title="Profile">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 font-serif text-2xl text-primary">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-serif text-xl">{displayName}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Appearance">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-lg border p-4 text-left transition-all ${
                  settings.theme === t
                    ? "border-primary bg-primary/[0.06]"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <div className="font-serif text-lg capitalize">{t}</div>
                <div className="text-xs text-muted-foreground">
                  {t === "light" ? "Warm paper" : "Quiet evening"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Notifications">
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {(
            [
              ["events", "Calendar events", "Reminders for events today and tomorrow"],
              ["tasks", "Tasks due", "Alerts for tasks due today or overdue"],
              ["budget", "Budget alerts", "Warn when spending exceeds 80% of income"],
              ["weekly", "Weekly summary", "Monday morning recap"],
            ] as const
          ).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch
                checked={settings.notify[key]}
                onCheckedChange={(v) => toggleNotif(key, v)}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Danger zone">
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
          <div>
            <Button
              variant="outline"
              onClick={wipe}
              disabled={wiping}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {wiping ? "Clearing…" : "Clear all data"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Permanently deletes all your tasks, transactions, events, and vault data.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
