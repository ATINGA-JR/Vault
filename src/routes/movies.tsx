import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Film, Plus, Trash2, Play } from "lucide-react";
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

export const Route = createFileRoute("/movies")({
  head: () => ({ meta: [{ title: "Movies — Vault" }] }),
  component: () => (<AuthGate><AppShell><MoviesPage /></AppShell></AuthGate>),
});

function MoviesPage() {
  const movies = useStore((s) => s.movies);
  const watched = movies.filter((m) => m.watched).length;
  const watching = movies.filter((m) => m.watching && !m.watched).length;
  const togo = movies.filter((m) => !m.watching && !m.watched).length;
  const [tab, setTab] = useState("all");

  const filtered =
    tab === "all"      ? movies :
    tab === "todo"     ? movies.filter((m) => !m.watching && !m.watched) :
    tab === "watching" ? movies.filter((m) => m.watching && !m.watched) :
                         movies.filter((m) => m.watched);

  function toggleWatching(id: string) {
    setState((s) => ({ ...s, movies: s.movies.map((m) => m.id === id ? { ...m, watching: !m.watching, watched: false } : m) }));
  }
  function toggleWatched(id: string) {
    setState((s) => ({ ...s, movies: s.movies.map((m) => m.id === id ? { ...m, watched: !m.watched, watching: false } : m) }));
  }
  function remove(id: string) {
    setState((s) => ({ ...s, movies: s.movies.filter((m) => m.id !== id) }));
    toast.success("Removed");
  }

  return (
    <>
      <PageHeader
        eyebrow="Movies"
        title="What to watch."
        subtitle={`${watched} watched · ${watching} watching · ${togo} to go`}
        action={<AddMovie />}
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
            <EmptyState icon={<Film className="h-5 w-5" />} title="Nothing here." body="Add a movie to get started." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((m) => (
                <li key={m.id} className={cn("flex items-center gap-3 rounded-lg border bg-card p-3 transition-all", m.watching && !m.watched ? "border-primary/40 bg-primary/[0.03]" : "border-border")}>
                  <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-md", m.watching && !m.watched ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                    <Film className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate font-serif text-lg", m.watched && "text-muted-foreground line-through")}>{m.title}</div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{m.year ?? ""}</span>
                      {m.watching && !m.watched && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">Watching</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!m.watched && (
                      <button onClick={() => toggleWatching(m.id)} title={m.watching ? "Remove from watching" : "Mark as watching"}
                        className={cn("grid h-7 w-7 place-items-center rounded border transition-colors", m.watching ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary")}>
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => toggleWatched(m.id)} title={m.watched ? "Mark as unwatched" : "Mark as watched"}
                      className={cn("grid h-7 w-7 place-items-center rounded border transition-colors", m.watched ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-muted-foreground hover:border-primary")}>
                      {m.watched && <span className="text-[10px]">✓</span>}
                    </button>
                    <button onClick={() => remove(m.id)} className="ml-1 text-muted-foreground hover:text-destructive">
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

function AddMovie() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setState((s) => ({
      ...s,
      movies: [...s.movies, { id: uid(), title: title.trim(), year: year ? parseInt(year) : undefined, watching: false, watched: false, createdAt: new Date().toISOString() }],
    }));
    toast.success("Added");
    setTitle(""); setYear(""); setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm"><Plus className="mr-1 h-4 w-4" />Add movie</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl">Add a movie</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" placeholder={new Date().getFullYear().toString()} value={year} onChange={(e) => setYear(e.target.value)} min="1900" max="2099" />
            </div>
            <Button type="submit" className="w-full">Add</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
