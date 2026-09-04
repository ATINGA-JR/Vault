import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Film, Tv, ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, Section, StatCard, EmptyState } from "@/components/app/ui-bits";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { greeting, formatDateLong, todayISO } from "@/lib/format";

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
  const books = useStore((s) => s.books);
  const movies = useStore((s) => s.movies);
  const shows = useStore((s) => s.shows);
  const shoppingLists = useStore((s) => s.shoppingLists);

  const stats = useMemo(() => {
    const pendingShopping = shoppingLists.reduce(
      (n, l) => n + l.sections.reduce((m, s) => m + s.items.filter((i) => !i.done).length, 0), 0,
    );
    return {
      pendingTasks: tasks.filter((t) => !t.done).length,
      booksToRead: books.filter((b) => !b.read && !b.reading).length,
      booksReading: books.filter((b) => b.reading && !b.read).length,
      moviesToWatch: movies.filter((m) => !m.watched && !m.watching).length,
      moviesWatching: movies.filter((m) => m.watching && !m.watched).length,
      showsToWatch: shows.filter((sh) => !sh.watched && !sh.watching).length,
      showsWatching: shows.filter((sh) => sh.watching && !sh.watched).length,
      shoppingLists: shoppingLists.length,
      pendingShopping,
    };
  }, [tasks, books, movies, shows, shoppingLists]);

  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 5);

  const currentBook = books.find((b) => b.reading && !b.read) ?? books.find((b) => !b.read);
  const currentMovie = movies.find((m) => m.watching && !m.watched) ?? movies.find((m) => !m.watched);
  const currentShow = shows.find((sh) => sh.watching && !sh.watched) ?? shows.find((sh) => !sh.watched);

  return (
    <>
      <PageHeader
        eyebrow={formatDateLong(todayISO())}
        title={`${greeting()}, ${username ?? ""}.`}
        subtitle="Here's everything on your plate today."
      />

      <Section>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Link to="/tasks"><StatCard label="Tasks" value={stats.pendingTasks} hint="Pending" /></Link>
          <Link to="/books">
            <StatCard
              label="Books"
              value={stats.booksReading > 0 ? stats.booksReading : stats.booksToRead}
              hint={stats.booksReading > 0 ? "Reading now" : "To read"}
              accent={stats.booksReading > 0}
            />
          </Link>
          <Link to="/movies">
            <StatCard
              label="Movies"
              value={stats.moviesWatching > 0 ? stats.moviesWatching : stats.moviesToWatch}
              hint={stats.moviesWatching > 0 ? "Watching now" : "To watch"}
              accent={stats.moviesWatching > 0}
            />
          </Link>
          <Link to="/shows">
            <StatCard
              label="Shows"
              value={stats.showsWatching > 0 ? stats.showsWatching : stats.showsToWatch}
              hint={stats.showsWatching > 0 ? "Watching now" : "To watch"}
              accent={stats.showsWatching > 0}
            />
          </Link>
          <Link to="/shopping"><StatCard label="Shopping" value={stats.pendingShopping} hint={`${stats.shoppingLists} list${stats.shoppingLists === 1 ? "" : "s"}`} /></Link>
        </div>
      </Section>

      <Section title="Pending tasks" subtitle="Top 5">
        {pending.length === 0 ? (
          <EmptyState title="Inbox zero." body="Nothing pending." action={<Link to="/tasks" className="text-sm text-primary hover:underline">Add a task →</Link>} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {pending.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-warning" : "bg-muted-foreground/50"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{t.text}</div>
                  {t.dueDate && <div className="text-xs text-muted-foreground">{t.dueDate}{t.dueTime ? ` · ${t.dueTime}` : ""}</div>}
                </div>
                <Link to="/tasks" className="text-muted-foreground hover:text-foreground">↗</Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Up next" subtitle="Book">
          {currentBook ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="grid h-20 w-14 place-items-center rounded bg-gradient-to-br from-primary/20 to-primary/5">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="font-serif text-lg">{currentBook.title}</span>
                {currentBook.reading && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Reading</span>}
              </div>
              <div className="text-xs text-muted-foreground">{currentBook.author}</div>
            </div>
          ) : <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No books queued." />}
        </Section>
        <Section title="Up next" subtitle="Movie">
          {currentMovie ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="grid h-20 w-14 place-items-center rounded bg-gradient-to-br from-chart-3/20 to-chart-3/5">
                <Film className="h-5 w-5 text-info" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="font-serif text-lg">{currentMovie.title}</span>
                {currentMovie.watching && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Watching</span>}
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{currentMovie.year ?? ""}</div>
            </div>
          ) : <EmptyState icon={<Film className="h-5 w-5" />} title="No movies queued." />}
        </Section>
        <Section title="Up next" subtitle="Show">
          {currentShow ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="grid h-20 w-14 place-items-center rounded bg-gradient-to-br from-chart-3/20 to-chart-3/5">
                <Tv className="h-5 w-5 text-info" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="font-serif text-lg">{currentShow.title}</span>
                {currentShow.watching && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Watching</span>}
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{currentShow.year ?? ""}</div>
            </div>
          ) : <EmptyState icon={<Tv className="h-5 w-5" />} title="No shows queued." />}
        </Section>
      </div>
    </>
  );
}
