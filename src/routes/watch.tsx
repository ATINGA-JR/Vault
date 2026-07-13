import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Film, Tv, Plus, Trash2, Play } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, EmptyState } from "@/components/app/ui-bits";
import { useStore, setState, uid } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { WatchType } from "@/lib/types";

export const Route = createFileRoute("/watch")({
  head: () => ({ meta: [{ title: "Watch List — Vault" }] }),
  component: () => (<AuthGate><AppShell><WatchPage /></AppShell></AuthGate>),
});

function WatchPage() {
  const watchlist = useStore((s) => s.watchlist);
  const watched = watchlist.filter((w) => w.watched).length;
  const watching = watchlist.filter((w) => w.watching && !w.watched).length;
  const togo = watchlist.filter((w) => !w.watching && !w.watched).length;
  const [tab, setTab] = useState("all");

  const filtered =
    tab === "all"     ? watchlist :
    tab === "watching"? watchlist.filter((w) => w.watching && !w.watched) :
    tab === "todo"    ? watchlist.filter((w) => !w.watching && !w.watched) :
                        watchlist.filter((w) => w.watched);

  function toggleWatching(id: string) {
    setState((s) => ({
      ...s,
      watchlist: s.watchlist.map((x) =>
        x.id === id ? { ...x, watching: !x.watching, watched: false } : x
      ),
    }));
  }

  function toggleWatched(id: string) {
    setState((s) => ({
      ...s,
      watchlist: s.watchlist.map((x) =>
        x.id === id ? { ...x, watched: !x.watched, watching: false } : x
      ),
    }));
  }

  function remove(id: string) {
    setState((s) => ({ ...s, watchlist: s.watchlist.filter((x) => x.id !== id) }));
    toast.success("Removed");
  }

  return (
    <>
      <PageHeader
        eyebrow="Watch List"
        title="What to watch."
        subtitle={`${watched} watched · ${watching} watching · ${togo} to go`}
        action={<AddWatch />}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="todo">To Watch</TabsTrigger>
          <TabsTrigger value="watching">
            Watching {watching > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{watching}</span>}
          </TabsTrigger>
          <TabsTrigger value="watched">Watched</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState icon={<Film className="h-5 w-5" />} title="Nothing here." body="Add a movie or series to get started." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((w) => (
                <li key={w.id} className={cn(
                  "flex items-center gap-3 rounded-lg border bg-card p-3 transition-all",
                  w.watching && !w.watched ? "border-primary/40 bg-primary/[0.03]" : "border-border"
                )}>
                  <span className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-md",
                    w.watching && !w.watched ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                  )}>
                    {w.type === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate font-serif text-lg", w.watched && "text-muted-foreground line-through")}>
                      {w.title}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{w.type}{w.year ? ` · ${w.year}` : ""}</span>
                      {w.watching && !w.watched && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">Watching</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Currently watching toggle */}
                    {!w.watched && (
                      <button
                        onClick={() => toggleWatching(w.id)}
                        title={w.watching ? "Remove from watching" : "Mark as watching"}
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded border transition-colors",
                          w.watching
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                        )}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Watched toggle */}
                    <button
                      onClick={() => toggleWatched(w.id)}
                      title={w.watched ? "Mark as unwatched" : "Mark as watched"}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded border transition-colors",
                        w.watched
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong text-muted-foreground hover:border-primary"
                      )}
                    >
                      {w.watched && <span className="text-[10px]">✓</span>}
                    </button>
                    <button onClick={() => remove(w.id)} className="ml-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function AddWatch() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WatchType>("movie");
  const [year, setYear] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setState((s) => ({
      ...s,
      watchlist: [...s.watchlist, {
        id: uid(),
        title: title.trim(),
        type,
        year: year ? parseInt(year) : undefined,
        watching: false,
        watched: false,
        createdAt: new Date().toISOString(),
      }],
    }));
    toast.success("Added");
    setTitle(""); setYear(""); setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm"><Plus className="mr-1 h-4 w-4" />Add title</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl">Add to watchlist</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" placeholder={new Date().getFullYear().toString()}
                value={year} onChange={(e) => setYear(e.target.value)} min="1900" max="2099" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["movie", "series"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={cn("flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm capitalize",
                    type === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent")}>
                  {t === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />} {t}
                </button>
              ))}
            </div>
            <Button type="submit" className="w-full">Add</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
