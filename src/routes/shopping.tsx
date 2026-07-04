import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingCart, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, EmptyState } from "@/components/app/ui-bits";
import { useStore, setState, uid } from "@/lib/store";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ShoppingList } from "@/lib/types";

export const Route = createFileRoute("/shopping")({
  head: () => ({ meta: [{ title: "Shopping — Vault" }] }),
  component: () => (<AuthGate><AppShell><ShoppingPage /></AppShell></AuthGate>),
});

function ShoppingPage() {
  const lists = useStore((s) => s.shoppingLists);
  const [activeId, setActiveId] = useState<string | null>(lists[0]?.id ?? null);
  const active = lists.find((l) => l.id === activeId) ?? lists[0];

  return (
    <>
      <PageHeader eyebrow="Shopping" title="Lists & items." action={<AddList onAdd={(id) => setActiveId(id)} />} />

      {lists.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="No lists yet." body="Create a list to start adding items." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-2">
            {lists.map((l) => {
              const total = l.sections.reduce((n, s) => n + s.items.length, 0);
              const done = l.sections.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);
              return (
                <button key={l.id} onClick={() => setActiveId(l.id)}
                  className={cn("group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    active?.id === l.id ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card hover:border-border-strong")}>
                  <span className="grid h-9 w-9 place-items-center rounded-md text-lg" style={{ background: l.color + "22" }}>{l.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name}</div>
                    <div className="text-[10px] tabular-nums text-muted-foreground">{done}/{total} done</div>
                  </div>
                </button>
              );
            })}
          </aside>
          {active && <ListDetail list={active} />}
        </div>
      )}
    </>
  );
}

function ListDetail({ list }: { list: ShoppingList }) {
  const total = list.sections.reduce((n, s) => n + s.items.reduce((m, i) => m + i.quantity * i.price, 0), 0);
  const spent = list.sections.reduce((n, s) => n + s.items.filter((i) => i.done).reduce((m, i) => m + i.quantity * i.price, 0), 0);
  const totalItems = list.sections.reduce((n, s) => n + s.items.length, 0);
  const doneItems = list.sections.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);
  const pct = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;

  function renameList() {
    const next = prompt("Rename list", list.name);
    if (next && next.trim()) {
      setState((s) => ({ ...s, shoppingLists: s.shoppingLists.map((l) => l.id === list.id ? { ...l, name: next.trim() } : l) }));
    }
  }
  function deleteList() {
    if (!confirm(`Delete list "${list.name}"?`)) return;
    setState((s) => ({ ...s, shoppingLists: s.shoppingLists.filter((l) => l.id !== list.id) }));
    toast.success("List deleted");
  }
  function addSection() {
    const name = prompt("Section name", "New section");
    if (!name?.trim()) return;
    setState((s) => ({ ...s, shoppingLists: s.shoppingLists.map((l) => l.id === list.id ? { ...l, sections: [...l.sections, { id: uid(), name: name.trim(), items: [] }] } : l) }));
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 onDoubleClick={renameList} className="font-serif text-3xl tracking-tight" title="Double-click to rename">
            <span className="mr-2">{list.icon}</span>{list.name}
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addSection}><Plus className="mr-1 h-4 w-4" />Section</Button>
            <Button size="sm" variant="outline" onClick={deleteList} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Spent so far</div>
            <div className="mt-0.5 font-serif text-2xl tabular-nums">{formatNaira(spent)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. total</div>
            <div className="mt-0.5 font-serif text-2xl tabular-nums">{formatNaira(total)}</div>
          </div>
        </div>
        <div className="mt-4"><Progress value={pct} className="h-2" /></div>
      </div>

      {list.sections.length === 0 ? (
        <EmptyState title="No sections yet." body="Add a section like 'Produce' or 'Electronics'." />
      ) : (
        <div className="space-y-4">
          {list.sections.map((sec) => <SectionCard key={sec.id} listId={list.id} section={sec} />)}
        </div>
      )}
    </div>
  );
}

function SectionCard({ listId, section }: { listId: string; section: ShoppingList["sections"][number] }) {
  const [name, setName] = useState(""); const [qty, setQty] = useState("1"); const [unit, setUnit] = useState(""); const [price, setPrice] = useState("");

  function rename() {
    const next = prompt("Rename section", section.name);
    if (!next?.trim()) return;
    setState((s) => ({ ...s, shoppingLists: s.shoppingLists.map((l) => l.id !== listId ? l : { ...l, sections: l.sections.map((x) => x.id === section.id ? { ...x, name: next.trim() } : x) }) }));
  }
  function removeSection() {
    if (!confirm(`Delete section "${section.name}"?`)) return;
    setState((s) => ({ ...s, shoppingLists: s.shoppingLists.map((l) => l.id !== listId ? l : { ...l, sections: l.sections.filter((x) => x.id !== section.id) }) }));
  }
  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setState((s) => ({ ...s, shoppingLists: s.shoppingLists.map((l) => l.id !== listId ? l : { ...l, sections: l.sections.map((x) => x.id !== section.id ? x : { ...x, items: [...x.items, { id: uid(), name: name.trim(), quantity: parseFloat(qty) || 1, unit: unit.trim(), price: parseFloat(price) || 0, done: false }] }) }) }));
    setName(""); setQty("1"); setUnit(""); setPrice("");
  }
  function toggleItem(id: string) {
    setState((s) => ({ ...s, shoppingLists: s.shoppingLists.map((l) => l.id !== listId ? l : { ...l, sections: l.sections.map((x) => x.id !== section.id ? x : { ...x, items: x.items.map((i) => i.id === id ? { ...i, done: !i.done } : i) }) }) }));
  }
  function delItem(id: string) {
    setState((s) => ({ ...s, shoppingLists: s.shoppingLists.map((l) => l.id !== listId ? l : { ...l, sections: l.sections.map((x) => x.id !== section.id ? x : { ...x, items: x.items.filter((i) => i.id !== id) }) }) }));
  }

  const total = section.items.length; const done = section.items.filter((i) => i.done).length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 onDoubleClick={rename} className="font-serif text-xl" title="Double-click to rename">{section.name}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">{done}/{total}</span>
          <button onClick={removeSection} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="px-4 pt-2"><Progress value={pct} className="h-1" /></div>

      {section.items.length > 0 && (
        <ul className="divide-y divide-border">
          {section.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => toggleItem(i.id)}
                className={cn("grid h-5 w-5 shrink-0 place-items-center rounded border",
                  i.done ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
                {i.done && <span className="text-[10px]">✓</span>}
              </button>
              <div className={cn("min-w-0 flex-1 text-sm", i.done && "text-muted-foreground line-through")}>
                {i.name} {i.quantity > 1 || i.unit ? <span className="text-muted-foreground">· {i.quantity}{i.unit ? ` ${i.unit}` : ""}</span> : null}
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">{formatNaira(i.quantity * i.price)}</div>
              <button onClick={() => delItem(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addItem} className="flex flex-wrap items-end gap-2 border-t border-border px-4 py-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item" className="min-w-[140px] flex-1" />
        <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" className="w-16" />
        <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="w-20" />
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₦/each" className="w-24" />
        <Button type="submit" size="sm"><Plus className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function AddList({ onAdd }: { onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [icon, setIcon] = useState("🛒"); const [color, setColor] = useState("#D97757");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const id = uid();
    setState((s) => ({ ...s, shoppingLists: [...s.shoppingLists, { id, name: name.trim(), icon, color, sections: [], createdAt: new Date().toISOString() }] }));
    onAdd(id); toast.success("List added"); setName(""); setOpen(false);
  }
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New list</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl">New shopping list</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Icon</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} /></div>
              <div className="space-y-2"><Label>Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10" /></div>
            </div>
            <Button type="submit" className="w-full">Create list</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
