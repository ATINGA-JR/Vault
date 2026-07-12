import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Film, Tv, Plus, Trash2 } from "lucide-react";
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
  const togo = watchlist.length - watched;
  const [tab, setTab] = useState("all");
  const filtered = tab === "all" ? watchlist : tab === "todo" ? watchlist.filter((w) => !w.watched) : watchlist.filter((w) => w.watched);

  return (
    <>
      <PageHeader eyebrow="Watch List" title="What to watch."
        subtitle={`${watched} watched · ${togo} to go`} action={<AddWatch />} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="todo">To Watch</TabsTrigger>
          <TabsTrigger value="watched">Watched</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState icon={<Film className="h-5 w-5" />} title="Nothing on the watchlist." body="Add a movie or series to get started." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((w) => (
                <li key={w.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <span className="grid h-12 w-12 place-items-center rounded-md bg-secondary text-muted-foreground">
                    {w.type === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate font-serif text-lg", w.watched && "text-muted-foreground line-through")}>{w.title}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {w.type}{w.year ? ` · ${w.year}` : ""}
                    </div>
                  </div>
                  <button onClick={() => setState((s) => ({ ...s, watchlist: s.watchlist.map((x) => x.id === w.id ? { ...x, watched: !x.watched } : x) }))}
                    className={cn("grid h-6 w-6 place-items-center rounded border",
                      w.watched ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
                    {w.watched && <span className="text-[10px]">✓</span>}
                  </button>
                  <button onClick={() => { setState((s) => ({ ...s, watchlist: s.watchlist.filter((x) => x.id !== w.id) })); toast.success("Removed"); }}
                    className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
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
              <Input
                type="number"
                placeholder={new Date().getFullYear().toString()}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="1900"
                max="2099"
              />
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
