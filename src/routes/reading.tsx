import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Plus, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, EmptyState } from "@/components/app/ui-bits";
import { useStore, setState, uid } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reading")({
  head: () => ({ meta: [{ title: "Reading List — Vault" }] }),
  component: () => (<AuthGate><AppShell><ReadingPage /></AppShell></AuthGate>),
});

function ReadingPage() {
  const books = useStore((s) => s.books);
  const readCount = books.filter((b) => b.read).length;
  const readingCount = books.filter((b) => b.reading && !b.read).length;
  const toGoCount = books.filter((b) => !b.reading && !b.read).length;
  const [tab, setTab] = useState("all");

  const filtered =
    tab === "all"     ? books :
    tab === "todo"    ? books.filter((b) => !b.reading && !b.read) :
    tab === "reading" ? books.filter((b) => b.reading && !b.read) :
                        books.filter((b) => b.read);

  function toggleReading(id: string) {
    setState((s) => ({
      ...s,
      books: s.books.map((b) =>
        b.id === id ? { ...b, reading: !b.reading, read: false } : b
      ),
    }));
  }

  function toggleRead(id: string) {
    setState((s) => ({
      ...s,
      books: s.books.map((b) =>
        b.id === id ? { ...b, read: !b.read, reading: false } : b
      ),
    }));
  }

  function remove(id: string) {
    setState((s) => ({ ...s, books: s.books.filter((b) => b.id !== id) }));
    toast.success("Removed");
  }

  return (
    <>
      <PageHeader
        eyebrow="Reading List"
        title="Books to read."
        subtitle={`${readCount} read · ${readingCount} reading · ${toGoCount} to go`}
        action={
          <div className="flex gap-2">
            <BulkImportBooks />
            <AddBook />
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="todo">To Read</TabsTrigger>
          <TabsTrigger value="reading">
            Reading {readingCount > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{readingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No books here yet." body="Add one to start your reading list." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {filtered.map((b) => (
                <li key={b.id} className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-all",
                  b.reading && !b.read && "bg-primary/[0.03]"
                )}>
                  {/* Currently reading indicator */}
                  <button
                    onClick={() => toggleReading(b.id)}
                    title={b.reading ? "Remove from reading" : "Mark as currently reading"}
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] transition-colors",
                      b.reading && !b.read
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {b.reading && !b.read ? "▶" : ""}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate font-serif text-lg", b.read && "text-muted-foreground line-through")}>
                      {b.title}
                    </div>
                    <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                      <span>{b.author}</span>
                      {b.reading && !b.read && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">Reading</span>
                      )}
                    </div>
                  </div>

                  {/* Read toggle */}
                  <button
                    onClick={() => toggleRead(b.id)}
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded border",
                      b.read ? "border-primary bg-primary text-primary-foreground" : "border-border-strong"
                    )}
                  >
                    {b.read && <span className="text-[10px]">✓</span>}
                  </button>

                  <button onClick={() => remove(b.id)} className="text-muted-foreground hover:text-destructive">
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

function BulkImportBooks() {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const newBooks = lines.map((line) => {
      const dashIdx = line.lastIndexOf(" - ");
      const title = dashIdx > -1 ? line.slice(0, dashIdx).trim() : line.trim();
      const author = dashIdx > -1 ? line.slice(dashIdx + 3).trim() : "";
      return { id: uid(), title, author, reading: false, read: false, createdAt: new Date().toISOString() };
    });
    setState((s) => ({ ...s, books: [...s.books, ...newBooks] }));
    toast.success(`Added ${newBooks.length} book${newBooks.length === 1 ? "" : "s"}`);
    setRaw(""); setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="mr-1 h-4 w-4" />Import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Bulk import books</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>One book per line</Label>
              <p className="text-xs text-muted-foreground">Format: <span className="font-mono">Title - Author</span></p>
              <Textarea autoFocus rows={10} value={raw} onChange={(e) => setRaw(e.target.value)}
                placeholder={"Atomic Habits - James Clear\nSapiens - Yuval Noah Harari"} className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">
                {raw.split("\n").filter((l) => l.trim()).length} books detected
              </p>
            </div>
            <Button type="submit" className="w-full">Import books</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddBook() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setState((s) => ({
      ...s,
      books: [...s.books, { id: uid(), title: title.trim(), author: author.trim(), reading: false, read: false, createdAt: new Date().toISOString() }],
    }));
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
