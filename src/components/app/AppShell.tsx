import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, ListTodo, Wallet, BookOpen, Film, CalendarDays,
  ShoppingCart, Settings as SettingsIcon, Bell, Sun, Moon, LogOut, Menu, X, ShieldCheck,
} from "lucide-react";
import { useStore, setState } from "@/lib/store";
import { greeting, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NotificationPanel } from "./NotificationPanel";
import { runReminders } from "@/lib/notifications";
import { Toaster } from "@/components/ui/sonner";
import { VaultLogo } from "@/components/app/VaultLogo";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { to: "/tasks", label: "Tasks", icon: ListTodo, key: "tasks" as const },
  { to: "/cash-flow", label: "Cash Flow", icon: Wallet, key: "cash" as const },
  { to: "/vault", label: "Passcodes", icon: ShieldCheck, key: "vault" as const },
  { to: "/reading", label: "Reading List", icon: BookOpen, key: "reading" as const },
  { to: "/watch", label: "Watch List", icon: Film, key: "watch" as const },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, key: "calendar" as const },
  { to: "/shopping", label: "Shopping", icon: ShoppingCart, key: "shopping" as const },
  { to: "/settings", label: "Settings", icon: SettingsIcon, key: "settings" as const },
];

export function AppShell({ children }: { children: ReactNode }) {
  const session = useStore((s) => s.session);
  const user = useStore((s) => s.user);
  const theme = useStore((s) => s.settings.theme);
  const tasks = useStore((s) => s.tasks);
  const events = useStore((s) => s.events);
  const shoppingLists = useStore((s) => s.shoppingLists);
  const notifications = useStore((s) => s.notifications);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    runReminders();
    const id = window.setInterval(runReminders, 1000 * 60 * 5);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const pendingTasks = tasks.filter((t) => !t.done).length;
  const upcomingEvents = events.filter((e) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ed = new Date(e.date + "T00:00:00");
    const diff = (ed.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff < 7;
  }).length;
  const pendingShopping = shoppingLists.reduce(
    (n, l) => n + l.sections.reduce((m, s) => m + s.items.filter((i) => !i.done).length, 0), 0,
  );
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const badges: Record<string, number> = {
    tasks: pendingTasks,
    calendar: upcomingEvents,
    shopping: pendingShopping,
  };

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setState((s) => ({ ...s, settings: { ...s.settings, theme: next } }));
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  function signOut() {
    setState((s) => ({ ...s, session: null }));
  }

  const sidebarInner = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="border-b border-sidebar-border px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src={vaultLogo} alt="Vault" width={36} height={36} className="h-9 w-9 rounded-md object-contain" />
          <div>
            <div className="font-serif text-lg leading-none tracking-tight">Vault</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Personal OS</div>
          </div>
        </div>
        {session && user && (
          <div className="mt-5">
            <div className="text-sm text-muted-foreground">{greeting()},</div>
            <div className="font-serif text-xl">{user.username}.</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(new Date())}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
          const badge = badges[item.key];
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1">{item.label}</span>
              {badge ? (
                <span className={cn(
                  "min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
                  active ? "bg-primary text-primary-foreground" : "bg-sidebar-border/60 text-sidebar-foreground",
                )}>{badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        <button
          onClick={() => setNotifOpen(true)}
          className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          <span className="flex-1 text-left">Notifications</span>
          {unreadNotifs ? (
            <span className="min-w-[20px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold text-primary-foreground">{unreadNotifs}</span>
          ) : null}
        </button>
        <button
          onClick={toggleTheme}
          className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
          <span className="flex-1 text-left">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        {session && user && (
          <div className="mt-2 flex items-center gap-3 rounded-md px-3 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary font-medium">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.username}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
            <button onClick={signOut} title="Sign out" className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <img src={vaultLogo} alt="Vault" width={32} height={32} className="h-8 w-8 rounded-md object-contain" loading="lazy" />
          <span className="font-serif text-lg">Vault</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setNotifOpen(true)} className="relative rounded-md p-2 hover:bg-accent">
            <Bell className="h-5 w-5" strokeWidth={1.75} />
            {unreadNotifs ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" /> : null}
          </button>
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-2 hover:bg-accent">
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
          {sidebarInner}
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 max-w-[85%] border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl">
              <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-md p-1.5 hover:bg-sidebar-accent">
                <X className="h-4 w-4" />
              </button>
              {sidebarInner}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-10 md:py-10">
            {children}
          </div>
        </main>
      </div>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
