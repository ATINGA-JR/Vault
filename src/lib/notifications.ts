import { getState, setState, uid, isStoreReady } from "./store";
import { todayISO } from "./format";

export function pushNotif(kind: "task" | "weekly" | "system", title: string, body: string) {
  setState((s) => ({
    ...s,
    notifications: [
      { id: uid(), kind, title, body, read: false, createdAt: new Date().toISOString() },
      ...s.notifications,
    ].slice(0, 200),
  }));
}

const SEEN_KEY = "vault/seen-reminders/v1";

function getSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveSeen(s: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s)));
}

/** Run reminder checks for tasks and the weekly summary. Called on load + every 5 min. */
export function runReminders() {
  if (!isStoreReady()) return;

  const s = getState();
  const seen = getSeen();
  const today = todayISO();
  const cfg = s.settings.notify;

  // Tasks due today or overdue
  if (cfg.tasks) {
    for (const t of s.tasks) {
      if (t.done || !t.dueDate) continue;
      if (t.dueDate <= today) {
        const key = `task-${t.id}-${today}`;
        if (!seen.has(key)) {
          seen.add(key);
          pushNotif("task", t.dueDate < today ? "Task overdue" : "Task due today", t.text);
        }
      }
    }
  }

  // Weekly summary on Mondays
  if (cfg.weekly) {
    const d = new Date();
    if (d.getDay() === 1) {
      const wk = today;
      if (s.lastWeeklySummary !== wk) {
        const pending = s.tasks.filter((t) => !t.done).length;
        pushNotif(
          "weekly",
          "Your week ahead",
          `${pending} pending task${pending === 1 ? "" : "s"} this week`,
        );
        setState((st) => ({ ...st, lastWeeklySummary: wk }));
      }
    }
  }

  saveSeen(seen);
}

export function markAllRead() {
  setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
}

export function clearAllNotifications() {
  setState((s) => ({ ...s, notifications: [] }));
}
