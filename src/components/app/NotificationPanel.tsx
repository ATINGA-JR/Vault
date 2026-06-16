import { useState } from "react";
import { X, Bell, Check, Trash2 } from "lucide-react";
import { useStore, setState } from "@/lib/store";
import { markAllRead, clearAllNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notifications = useStore((s) => s.notifications);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const list = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  function markRead(id: string) {
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            <h2 className="font-serif text-xl">Notifications</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-border px-5 py-2">
          <div className="flex gap-1">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize",
                  tab === t ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={markAllRead} title="Mark all read" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={clearAllNotifications} title="Clear all" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-104px)] overflow-y-auto">
          {list.length === 0 ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
                  <Bell className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <p className="mt-3 font-serif text-lg">All quiet.</p>
                <p className="mt-1 text-sm text-muted-foreground">You'll see reminders and updates here.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((n) => (
                <li
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "cursor-pointer px-5 py-4 transition-colors hover:bg-accent/50",
                    !n.read && "bg-primary/[0.04]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-border" : "bg-primary")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-medium">{n.title}</h3>
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{n.kind}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
