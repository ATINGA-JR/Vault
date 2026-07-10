import { getState, setState, uid, isStoreReady } from "./store";
import { todayISO } from "./format";

export function pushNotif(kind: "task" | "event" | "budget" | "weekly" | "system", title: string, body: string) {
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

/** Run reminder checks for tasks/events/budget/weekly. Called on load + every 5 min. */
export function runReminders() {
  // Only run once data has loaded from Supabase
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

  // Events today or tomorrow
  if (cfg.events) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomISO = tomorrow.toISOString().slice(0, 10);
    for (const e of s.events) {
      if (e.date === today || e.date === tomISO) {
        const key = `evt-${e.id}-${today}`;
        if (!seen.has(key)) {
          seen.add(key);
          pushNotif("event", e.date === today ? "Event today" : "Event tomorrow", e.name);
        }
      }
    }
  }

  // Budget: spending > 80% of income this month
  if (cfg.budget) {
    const month = today.slice(0, 7);
    let income = 0, expense = 0;
    for (const t of s.transactions) {
      if (!t.date.startsWith(month)) continue;
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
    }
    if (income > 0 && expense / income >= 0.8) {
      const key = `budget-${month}`;
      if (!seen.has(key)) {
        seen.add(key);
        pushNotif("budget", "Budget alert", `You've spent ${Math.round((expense / income) * 100)}% of your income this month.`);
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
        const eventsThisWeek = s.events.filter((e) => {
          const diff = (new Date(e.date).getTime() - d.getTime()) / 86400000;
          return diff >= 0 && diff < 7;
        }).length;
        pushNotif(
          "weekly",
          "Your week ahead",
          `${pending} pending task${pending === 1 ? "" : "s"} · ${eventsThisWeek} event${eventsThisWeek === 1 ? "" : "s"} this week`,
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
