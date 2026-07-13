import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ListTodo, Wallet, BookOpen, Film, ShoppingCart, CalendarDays,
  ArrowUpRight, TrendingUp, TrendingDown,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, Section, StatCard, EmptyState } from "@/components/app/ui-bits";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { formatNaira, greeting, formatDateLong, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Vault" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <Dashboard />
      </AppShell>
    </AuthGate>
  ),
});

function Dashboard() {
  const { username } = useAuth();
  const tasks = useStore((s) => s.tasks);
  const transactions = useStore((s) => s.transactions);
  const banks = useStore((s) => s.banks);
  const books = useStore((s) => s.books);
  const watchlist = useStore((s) => s.watchlist);
  const events = useStore((s) => s.events);
  const shoppingLists = useStore((s) => s.shoppingLists);

  const stats = useMemo(() => {
    const month = todayISO().slice(0, 7);
    let income = 0, expense = 0;
    for (const t of transactions) {
      if (!t.date.startsWith(month)) continue;
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
    }
    const upcoming = events.filter((e) => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = (new Date(e.date + "T00:00:00").getTime() - today.getTime()) / 86400000;
      return diff >= 0 && diff < 14;
    });
    const pendingShopping = shoppingLists.reduce(
      (n, l) => n + l.sections.reduce((m, s) => m + s.items.filter((i) => !i.done).length, 0), 0,
    );
    return {
      pendingTasks: tasks.filter((t) => !t.done).length,
      income, expense, balance: income - expense,
      booksToRead: books.filter((b) => !b.read).length,
      moviesToWatch: watchlist.filter((w) => !w.watched).length,
      shoppingLists: shoppingLists.length,
      pendingShopping,
      upcoming,
    };
  }, [tasks, transactions, books, watchlist, events, shoppingLists]);

  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 5);

  const recentTx = [...transactions].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 3);
  const nextBook = books.find((b) => !b.read);
  const nextMovie = watchlist.find((w) => !w.watched);
  const incomePct = stats.income > 0 ? Math.min(100, (stats.expense / stats.income) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow={formatDateLong(new Date())}
        title={`${greeting()}, ${username ?? ""}.`}
        subtitle="Here's everything on your plate today."
      />

      <Section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Link to="/tasks"><StatCard label="Pending Tasks" value={stats.pendingTasks} hint="To do" /></Link>
          <Link to="/cash-flow"><StatCard label="Net Balance" value={formatNaira(stats.balance)} hint="This month" accent /></Link>
          <Link to="/reading"><StatCard label="Books" value={stats.booksToRead} hint="To read" /></Link>
          <Link to="/watch"><StatCard label="Watchlist" value={stats.moviesToWatch} hint="To watch" /></Link>
          <Link to="/shopping"><StatCard label="Shopping" value={stats.pendingShopping} hint={`${stats.shoppingLists} list${stats.shoppingLists === 1 ? "" : "s"}`} /></Link>
          <Link to="/calendar"><StatCard label="Upcoming" value={stats.upcoming.length} hint="Next 2 weeks" /></Link>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tasks */}
        <Section title="Pending tasks" subtitle="Top 5" className="lg:col-span-2">
          {pending.length === 0 ? (
            <EmptyState icon={<ListTodo className="h-5 w-5" />} title="Inbox zero." body="Nothing pending."
              action={<Link to="/tasks" className="text-sm font-medium text-primary hover:underline">Add a task →</Link>} />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {pending.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full",
                    t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-warning" : "bg-muted-foreground/50",
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{t.text}</div>
                    {t.dueDate && <div className="text-xs text-muted-foreground">{t.dueDate}{t.dueTime ? ` · ${t.dueTime}` : ""}</div>}
                  </div>
                  <Link to="/tasks" className="text-muted-foreground hover:text-foreground"><ArrowUpRight className="h-4 w-4" /></Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Budget */}
        <Section title="This month" subtitle="Cash flow">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3 text-success" /> Income</div>
                <div className="mt-1 font-serif text-xl tabular-nums">{formatNaira(stats.income)}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingDown className="h-3 w-3 text-destructive" /> Expense</div>
                <div className="mt-1 font-serif text-xl tabular-nums">{formatNaira(stats.expense)}</div>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Spent</span>
                <span className="tabular-nums">{Math.round(incomePct)}% of income</span>
              </div>
              <Progress value={incomePct} className="h-2" />
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Net balance</div>
              <div className="mt-1 font-serif text-3xl tabular-nums">{formatNaira(stats.balance)}</div>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Recent transactions">
          {recentTx.length === 0 ? (
            <EmptyState icon={<Wallet className="h-5 w-5" />} title="No transactions yet." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {recentTx.map((t) => {
                const bank = banks.find((b) => b.id === t.bankId || b.id === t.fromBankId);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-base">
                      {t.type === "income" ? "↓" : t.type === "expense" ? "↑" : "⇄"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.category} · {t.date}{bank ? ` · ${bank.name}` : ""}
                      </div>
                    </div>
                    <div className={cn("text-sm font-medium tabular-nums",
                      t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : "text-muted-foreground")}>
                      {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}{formatNaira(t.amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Upcoming events">
          {stats.upcoming.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Calendar's clear." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {stats.upcoming.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.date}{e.time ? ` · ${e.time}` : ""}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Up next" subtitle="Book">
          {nextBook ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="grid h-20 w-14 place-items-center rounded bg-gradient-to-br from-primary/20 to-primary/5 font-serif text-2xl">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-3 font-serif text-lg">{nextBook.title}</div>
              <div className="text-xs text-muted-foreground">{nextBook.author}</div>
            </div>
          ) : <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No books queued." />}
        </Section>
        <Section title="Up next" subtitle="Watch">
          {nextMovie ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="grid h-20 w-14 place-items-center rounded bg-gradient-to-br from-chart-3/20 to-chart-3/5">
                <Film className="h-5 w-5 text-info" />
              </div>
              <div className="mt-3 font-serif text-lg">{nextMovie.title}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{nextMovie.type}</div>
            </div>
          ) : <EmptyState icon={<Film className="h-5 w-5" />} title="Nothing on the watchlist." />}
        </Section>
        <Section title="Shopping lists">
          {shoppingLists.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="No lists yet." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {shoppingLists.map((l) => {
                const total = l.sections.reduce((n, s) => n + s.items.length, 0);
                const done = l.sections.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);
                return (
                  <Link key={l.id} to="/shopping" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-border-strong">
                    <span className="mr-1">{l.icon}</span>
                    <span className="font-medium">{l.name}</span>
                    <span className="ml-2 tabular-nums text-muted-foreground">{done}/{total}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
