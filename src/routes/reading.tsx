import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
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
import type { BookStatus } from "@/lib/types";

export const Route = createFileRoute("/reading")({
  head: () => ({ meta: [{ title: "Reading List — Vault" }] }),
  component: () => (<AuthGate><AppShell><ReadingPage /></AppShell></AuthGate>),
});

const nextBookStatus = (status: BookStatus): BookStatus => {
  if (status === "to-read") return "reading";
  if (status === "reading") return "read";
  return "to-read";
};

function statusLabel(status: BookStatus) {
  return status === "to-read" ? "to read" : status;
}

function ReadingPage() {
  const books = useStore((s) => s.books);
  const read = books.filter((b) => b.status === "read").length;
  const reading = books.filter((b) => b.status === "reading").length;
  const togo = books.filter((b) => b.status === "to-read").length;
  const [tab, setTab] = useState("all");
  const filtered = tab === "all"
    ? books
    : tab === "todo"
      ? books.filter((b) => b.status === "to-read")
      : tab === "reading"
        ? books.filter((b) => b.status === "reading")
        : books.filter((b) => b.status === "read");

  return (
    <>
      <PageHeader eyebrow="Reading List" title="Books to read."
        subtitle={`${read} read · ${reading} reading · ${togo} to go`} action={<AddBook />} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="todo">To Read</TabsTrigger>
          <TabsTrigger value="reading">Reading</TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No books here yet." body="Add one to start your reading list." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {filtered.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    title={`Status: ${statusLabel(b.status)}. Click to advance.`}
                    onClick={() => setState((s) => ({ ...s, books: s.books.map((x) => x.id === b.id ? { ...x, status: nextBookStatus(x.status) } : x) }))}
                    className={cn("grid h-5 w-5 shrink-0 place-items-center rounded border",
                      b.status === "read" ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
                    {b.status === "reading" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    {b.status === "read" && <span className="text-[10px]">✓</span>}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate font-serif text-lg", b.status === "read" && "text-muted-foreground line-through")}>{b.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {b.author}{b.author && " · "}{statusLabel(b.status)}
                    </div>
                  </div>
                  <button onClick={() => { setState((s) => ({ ...s, books: s.books.filter((x) => x.id !== b.id) })); toast.success("Removed"); }}
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

function AddBook() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [author, setAuthor] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setState((s) => ({ ...s, books: [...s.books, { id: uid(), title: title.trim(), author: author.trim(), status: "to-read" as BookStatus, createdAt: new Date().toISOString() }] }));
    toast.success("Book added"); setTitle(""); setAuthor(""); setOpen(false);
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm"><Plus className="mr-1 h-4 w-4" />Add book</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl">Add a book</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Author</Label><Input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
            <Button type="submit" className="w-full">Add</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
