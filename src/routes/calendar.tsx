import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Calendar as CalIcon, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, EmptyState } from "@/components/app/ui-bits";
import { useStore, setState, uid, initStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { todayISO, toISODate, MONTH_LABEL, DAY_LABEL, formatDateLong } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EVENT_COLORS, type CalendarEvent } from "@/lib/types";
import { toast } from "sonner";
import {
  getGoogleAuthUrl,
  syncGoogleCalendar,
  pushVaultEventToGoogle,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getConnectedGoogleAccounts,
  disconnectGoogleAccount,
} from "@/lib/api/google.functions";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Vault" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <CalendarPage />
      </AppShell>
    </AuthGate>
  ),
});

function CalendarPage() {
  const { user } = useAuth();
  const events = useStore((s) => s.events);
  const today = todayISO();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<string | null>(today);
  const [openAdd, setOpenAdd] = useState(false);
  const [addDate, setAddDate] = useState(today);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<{ id: string; google_email: string }[]>([]);
  const [syncing, setSyncing] = useState(false);

  const grid = useMemo(() => buildGrid(cursor), [cursor]);
  const monthEvents = events.filter((e) => e.date.startsWith(toISODate(cursor).slice(0, 7)));
  const panelEvents = selected ? events.filter((e) => e.date === selected) : monthEvents;

  // Load connected accounts and auto-sync on mount
  useEffect(() => {
    if (!user) return;

    getConnectedGoogleAccounts({ data: { userId: user.id } })
      .then(({ accounts }) => {
        setConnectedAccounts(accounts);
        if (accounts.length > 0) {
          // Auto-sync on load
          return doSync(user.id, false);
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Handle redirect back from Google OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      toast.success("Google Calendar connected!");
      window.history.replaceState({}, "", "/calendar");
      if (user) doSync(user.id, true);
    }
    if (params.get("google_error")) {
      toast.error("Failed to connect Google Calendar. Please try again.");
      window.history.replaceState({}, "", "/calendar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function doSync(userId: string, showToast = true) {
    setSyncing(true);
    try {
      const { synced } = await syncGoogleCalendar({ data: { userId } });
      // Reload store so newly synced events appear
      await initStore(userId);
      // Refresh connected accounts list
      const { accounts } = await getConnectedGoogleAccounts({ data: { userId } });
      setConnectedAccounts(accounts);
      if (showToast) {
        toast.success(synced > 0 ? `Synced ${synced} new events from Google` : "Calendar is up to date");
      }
    } catch {
      if (showToast) toast.error("Sync failed. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function connectGoogle() {
    if (!user) return;
    const { url } = await getGoogleAuthUrl({ data: { userId: user.id } });
    window.location.href = url;
  }

  async function handleDisconnect(email: string) {
    if (!user) return;
    await disconnectGoogleAccount({ data: { userId: user.id, googleEmail: email } });
    setConnectedAccounts((a) => a.filter((x) => x.google_email !== email));
    toast.success(`Disconnected ${email}`);
  }

  function openAddFor(iso: string) {
    if (selected === iso) {
      setAddDate(iso);
      setOpenAdd(true);
    } else {
      setSelected(iso);
    }
  }

  const hasGoogle = connectedAccounts.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Your month at a glance."
        action={
          <div className="flex items-center gap-2">
            {hasGoogle ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => user && doSync(user.id)}
                disabled={syncing}
              >
                <RefreshCw className={cn("mr-1 h-3.5 w-3.5", syncing && "animate-spin")} />
                {syncing ? "Syncing…" : "Sync Google"}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={connectGoogle}>
                <img src="https://www.google.com/favicon.ico" className="mr-1.5 h-3.5 w-3.5" alt="" />
                Connect Google
              </Button>
            )}
            <Button size="sm" onClick={() => { setAddDate(selected ?? today); setOpenAdd(true); }}>
              <Plus className="mr-1 h-4 w-4" />Add event
            </Button>
          </div>
        }
      />

      {/* Connected Google accounts */}
      {hasGoogle && (
        <div className="mb-4 flex flex-wrap gap-2">
          {connectedAccounts.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs">
              <img src="https://www.google.com/favicon.ico" className="h-3 w-3" alt="" />
              <span className="text-muted-foreground">{a.google_email}</span>
              <button
                onClick={() => handleDisconnect(a.google_email)}
                className="ml-1 text-muted-foreground/50 hover:text-destructive"
                title="Disconnect"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-serif text-2xl">{MONTH_LABEL[cursor.getMonth()]} {cursor.getFullYear()}</div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setCursor((c) => { const n = new Date(c); n.setMonth(n.getMonth() - 1); return n; })}>←</Button>
              <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelected(today); }}>Today</Button>
              <Button size="sm" variant="outline" onClick={() => setCursor((c) => { const n = new Date(c); n.setMonth(n.getMonth() + 1); return n; })}>→</Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <div className="grid grid-cols-7 gap-1">
              {DAY_LABEL.map((d) => (
                <div key={d} className="py-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{d}</div>
              ))}
              {grid.map((d) => {
                const iso = toISODate(d.date);
                const dayEvents = events.filter((e) => e.date === iso);
                const isToday = iso === today;
                const isSelected = iso === selected;
                return (
                  <button
                    key={iso}
                    onClick={() => openAddFor(iso)}
                    className={cn(
                      "group aspect-square min-h-[60px] rounded-md border p-1.5 text-left transition-all",
                      d.inMonth ? "border-border bg-card hover:border-border-strong" : "border-transparent text-muted-foreground/40",
                      isToday && "border-primary/40 bg-primary/[0.04]",
                      isSelected && "ring-2 ring-primary",
                    )}
                  >
                    <div className={cn("text-sm tabular-nums", isToday && "font-semibold text-primary")}>{d.date.getDate()}</div>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dayEvents.slice(0, 4).map((e) => (
                        <span
                          key={e.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: e.color }}
                          title={e.googleEventId ? "From Google Calendar" : undefined}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 font-serif text-2xl">
            {selected ? formatDateLong(selected) : "This month"}
          </div>
          {panelEvents.length === 0 ? (
            <EmptyState
              icon={<CalIcon className="h-5 w-5" />}
              title="No events."
              body={selected ? "Tap this date again to add one." : "Add an event to start."}
            />
          ) : (
            <ul className="space-y-2">
              {panelEvents
                .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))
                .map((e) => (
                  <li key={e.id} className="group rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: e.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="truncate font-serif text-lg">{e.name}</div>
                          {e.googleEventId && (
                            <img src="https://www.google.com/favicon.ico" className="h-3 w-3 shrink-0 opacity-50" alt="Google" title="Synced from Google Calendar" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{e.date}{e.time ? ` · ${e.time}` : ""}</div>
                      </div>
                      <button
                        onClick={() => setEditEvent(e)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      <EventDialog
        open={openAdd}
        onOpenChange={setOpenAdd}
        initialDate={addDate}
        hasGoogle={hasGoogle}
        userId={user?.id}
      />
      <EventDialog
        open={!!editEvent}
        onOpenChange={(o) => !o && setEditEvent(null)}
        editEvent={editEvent ?? undefined}
        hasGoogle={hasGoogle}
        userId={user?.id}
      />
    </>
  );
}

function buildGrid(cursor: Date) {
  const first = new Date(cursor); first.setDate(1);
  const startDay = first.getDay();
  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < startDay; i++) {
    const d = new Date(first); d.setDate(d.getDate() - (startDay - i));
    days.push({ date: d, inMonth: false });
  }
  const month = cursor.getMonth();
  for (let i = 1; i <= 31; i++) {
    const d = new Date(cursor.getFullYear(), month, i);
    if (d.getMonth() !== month) break;
    days.push({ date: d, inMonth: true });
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const d = new Date(last); d.setDate(d.getDate() + 1);
    days.push({ date: d, inMonth: false });
  }
  return days;
}

function EventDialog({
  open,
  onOpenChange,
  initialDate,
  editEvent,
  hasGoogle,
  userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialDate?: string;
  editEvent?: CalendarEvent;
  hasGoogle: boolean;
  userId?: string;
}) {
  const [name, setName] = useState(editEvent?.name ?? "");
  const [date, setDate] = useState(editEvent?.date ?? initialDate ?? todayISO());
  const [time, setTime] = useState(editEvent?.time ?? "");
  const [color, setColor] = useState<string>(editEvent?.color ?? EVENT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(editEvent?.name ?? "");
    setDate(editEvent?.date ?? initialDate ?? todayISO());
    setTime(editEvent?.time ?? "");
    setColor(editEvent?.color ?? EVENT_COLORS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editEvent?.id, initialDate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      if (editEvent) {
        // Update in store
        setState((s) => ({
          ...s,
          events: s.events.map((x) =>
            x.id === editEvent.id
              ? { ...x, name: name.trim(), date, time: time || undefined, color }
              : x,
          ),
        }));
        // Update in Google if linked
        if (editEvent.googleEventId && userId) {
          await updateGoogleCalendarEvent({
            data: { userId, googleEventId: editEvent.googleEventId, name: name.trim(), date, time: time || undefined },
          }).catch(console.error);
        }
        toast.success("Event updated");
      } else {
        const newId = uid();
        const newEvent: CalendarEvent = {
          id: newId,
          name: name.trim(),
          date,
          time: time || undefined,
          color,
          createdAt: new Date().toISOString(),
        };
        setState((s) => ({ ...s, events: [...s.events, newEvent] }));

        // Push to Google if connected
        if (hasGoogle && userId) {
          pushVaultEventToGoogle({
            data: { userId, eventId: newId, name: name.trim(), date, time: time || undefined },
          }).then(({ googleEventId }) => {
            if (googleEventId) {
              // Update local state with the google_event_id
              setState((s) => ({
                ...s,
                events: s.events.map((x) =>
                  x.id === newId ? { ...x, googleEventId } : x,
                ),
              }));
            }
          }).catch(console.error);
        }
        toast.success("Event added");
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editEvent) return;
    setSaving(true);
    try {
      setState((s) => ({ ...s, events: s.events.filter((x) => x.id !== editEvent.id) }));
      // Delete from Google if linked
      if (editEvent.googleEventId && userId) {
        await deleteGoogleCalendarEvent({
          data: { userId, googleEventId: editEvent.googleEventId },
        }).catch(console.error);
      }
      toast.success("Event deleted");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {editEvent ? "Edit event" : "New event"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          {hasGoogle && !editEvent && (
            <p className="text-xs text-muted-foreground">
              This event will also be added to your Google Calendar.
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving…" : editEvent ? "Save" : "Add event"}
            </Button>
            {editEvent && (
              <Button type="button" variant="outline" onClick={remove} disabled={saving} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
