import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Wallet, ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, Section, EmptyState, StatCard } from "@/components/app/ui-bits";
import { useStore, setState, uid } from "@/lib/store";
import { formatNaira, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CATEGORIES, type Bank, type Category, type Transaction, type TxType } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/cash-flow")({
  head: () => ({ meta: [{ title: "Cash Flow — Jarvis" }] }),
  component: () => (<AuthGate><AppShell><CashFlowPage /></AppShell></AuthGate>),
});

function CashFlowPage() {
  const banks = useStore((s) => s.banks);
  const transactions = useStore((s) => s.transactions);
  const [activeBank, setActiveBank] = useState<string | "all">("all");
  const [breakdownBank, setBreakdownBank] = useState<string | "all">("all");
  const [reportsBank, setReportsBank] = useState<string | "all">("all");

  const filtered = activeBank === "all" ? transactions : transactions.filter((t) => t.bankId === activeBank || t.fromBankId === activeBank || t.toBankId === activeBank);

  const totals = useMemo(() => agg(filtered), [filtered]);

  return (
    <>
      <PageHeader
        eyebrow="Cash Flow"
        title="Where the money goes."
        subtitle="Track income, expenses, and transfers across all your banks."
        action={<div className="flex gap-2"><AddBankDialog /><AddTransactionDialog /></div>}
      />

      <Section title="Accounts">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <BankCard
            bank={null}
            active={activeBank === "all"}
            onClick={() => setActiveBank("all")}
            totals={agg(transactions)}
          />
          {banks.map((b) => {
            const tx = transactions.filter((t) => t.bankId === b.id || t.fromBankId === b.id || t.toBankId === b.id);
            return (
              <BankCard key={b.id} bank={b} active={activeBank === b.id} onClick={() => setActiveBank(b.id)} totals={agg(tx, b.id)} />
            );
          })}
        </div>
      </Section>

      <Section title="Overview" subtitle={activeBank === "all" ? "All accounts" : banks.find(b => b.id === activeBank)?.name}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Income" value={formatNaira(totals.income)} />
          <StatCard label="Expense" value={formatNaira(totals.expense)} />
          <StatCard label="Net" value={formatNaira(totals.income - totals.expense)} accent />
          <StatCard label="Transactions" value={totals.count} />
        </div>
        <div className="mt-4 rounded-lg border border-border bg-card p-5">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Spent</span><span className="tabular-nums">{totals.income > 0 ? Math.round((totals.expense / totals.income) * 100) : 0}% of income</span>
          </div>
          <Progress value={totals.income > 0 ? Math.min(100, (totals.expense / totals.income) * 100) : 0} className="h-2" />
        </div>
        {totals.intra > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-info/30 bg-info/[0.06] px-4 py-3 text-sm text-info">
            <ArrowLeftRight className="h-4 w-4" />
            <span><strong className="tabular-nums">{formatNaira(totals.intra)}</strong> moved between accounts — not counted in income/expense.</span>
          </div>
        )}
      </Section>

      <Section title="By category" action={<BankFilter banks={banks} value={breakdownBank} onChange={setBreakdownBank} />}>
        <CategoryBreakdown bank={breakdownBank} />
      </Section>

      <Section title="History" action={<BankFilter banks={banks} value={reportsBank} onChange={setReportsBank} />}>
        <Reports bank={reportsBank} />
      </Section>
    </>
  );
}

function agg(tx: Transaction[], bankId?: string) {
  let income = 0, expense = 0, intra = 0;
  for (const t of tx) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
    else if (t.type === "intra") intra += t.amount;
  }
  return { income, expense, intra, count: tx.length };
}

function BankFilter({ banks, value, onChange }: { banks: Bank[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All accounts</SelectItem>
        {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function BankCard({ bank, active, onClick, totals }: { bank: Bank | null; active: boolean; onClick: () => void; totals: ReturnType<typeof agg> }) {
  const balance = totals.income - totals.expense;
  const max = Math.max(totals.income, totals.expense, 1);
  const pct = (totals.expense / max) * 100;
  return (
    <button onClick={onClick} className={cn(
      "group relative rounded-lg border bg-card p-4 text-left transition-all hover:shadow-sm",
      active ? "border-primary/40 shadow-sm" : "border-border hover:border-border-strong",
    )}>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md text-lg" style={{ background: (bank?.color ?? "#D97757") + "22" }}>
          {bank?.icon ?? "🏦"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{bank?.name ?? "All Accounts"}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{totals.count} tx</div>
        </div>
        {bank && <BankActions bank={bank} />}
      </div>
      <div className="mt-3 font-serif text-2xl tabular-nums">{formatNaira(balance)}</div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span className="text-success">+{formatNaira(totals.income)}</span>
        <span className="text-destructive">-{formatNaira(totals.expense)}</span>
      </div>
      <div className="mt-2"><Progress value={pct} className="h-1" /></div>
    </button>
  );
}

function BankActions({ bank }: { bank: Bank }) {
  const [openEdit, setOpenEdit] = useState(false);
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpenEdit(true); }} className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <EditBankDialog bank={bank} open={openEdit} onOpenChange={setOpenEdit} />
    </>
  );
}

function AddBankDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [icon, setIcon] = useState("🏦"); const [color, setColor] = useState("#D97757");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setState((s) => ({ ...s, banks: [...s.banks, { id: uid(), name: name.trim(), icon, color, createdAt: new Date().toISOString() }] }));
    toast.success("Bank added");
    setName(""); setIcon("🏦"); setColor("#D97757"); setOpen(false);
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="outline"><Wallet className="mr-1 h-4 w-4" />Add bank</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl">Add bank</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="GTBank, Opay, PiggyVest…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Icon (emoji)</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} /></div>
              <div className="space-y-2"><Label>Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10" /></div>
            </div>
            <Button type="submit" className="w-full">Add bank</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditBankDialog({ bank, open, onOpenChange }: { bank: Bank; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState(bank.name); const [icon, setIcon] = useState(bank.icon); const [color, setColor] = useState(bank.color);
  function save(e: React.FormEvent) {
    e.preventDefault();
    setState((s) => ({ ...s, banks: s.banks.map((b) => b.id === bank.id ? { ...b, name, icon, color } : b) }));
    toast.success("Bank updated"); onOpenChange(false);
  }
  function remove() {
    if (!confirm(`Delete "${bank.name}"? Transactions linked to it remain.`)) return;
    setState((s) => ({ ...s, banks: s.banks.filter((b) => b.id !== bank.id) }));
    toast.success("Bank deleted"); onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif text-2xl">Edit bank</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Icon</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} /></div>
            <div className="space-y-2"><Label>Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10" /></div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Save</Button>
            <Button type="button" variant="outline" onClick={remove} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddTransactionDialog() {
  const banks = useStore((s) => s.banks);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Other");
  const [bankId, setBankId] = useState<string>("");
  const [fromBankId, setFromBankId] = useState(""); const [toBankId, setToBankId] = useState("");
  const [date, setDate] = useState(todayISO()); const [time, setTime] = useState("12:00");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!description.trim() || isNaN(amt) || amt <= 0) { toast.error("Fill all fields"); return; }
    if (type === "intra" && (!fromBankId || !toBankId || fromBankId === toBankId)) { toast.error("Pick two different banks"); return; }
    if (type !== "intra" && !bankId) { toast.error("Pick a bank"); return; }
    setState((s) => ({
      ...s,
      transactions: [...s.transactions, {
        id: uid(), description: description.trim(), amount: amt, type, category, date, time,
        ...(type === "intra" ? { fromBankId, toBankId } : { bankId }),
        createdAt: new Date().toISOString(),
      }],
    }));
    toast.success("Transaction added");
    setDescription(""); setAmount(""); setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" disabled={banks.length === 0}><Plus className="mr-1 h-4 w-4" />New transaction</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl">New transaction</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["expense", "income", "intra"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={cn("rounded-md border px-3 py-2 text-sm capitalize transition-colors",
                    type === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent")}>
                  {t === "intra" ? "Intra transfer" : t}
                </button>
              ))}
            </div>

            {type === "intra" && (
              <div className="rounded-md border border-info/30 bg-info/[0.06] px-3 py-2 text-xs text-info">
                Intra transfers move money between your accounts. They don't count as income or expense.
              </div>
            )}

            <div className="space-y-2"><Label>Description</Label><Input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Groceries, Salary, etc." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Amount (₦)</Label><Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
              <div className="space-y-2"><Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {type === "intra" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>From</Label>
                  <Select value={fromBankId} onValueChange={setFromBankId}>
                    <SelectTrigger><SelectValue placeholder="Bank" /></SelectTrigger>
                    <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>To</Label>
                  <Select value={toBankId} onValueChange={setToBankId}>
                    <SelectTrigger><SelectValue placeholder="Bank" /></SelectTrigger>
                    <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2"><Label>Bank</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder="Pick a bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            </div>

            <Button type="submit" className="w-full">Add transaction</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoryBreakdown({ bank }: { bank: string }) {
  const transactions = useStore((s) => s.transactions);
  const data = useMemo(() => {
    const filtered = (bank === "all" ? transactions : transactions.filter((t) => t.bankId === bank))
      .filter((t) => t.type === "expense");
    const map = new Map<string, number>();
    for (const t of filtered) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    const arr = Array.from(map.entries()).map(([cat, amt]) => ({ cat, amt }));
    arr.sort((a, b) => b.amt - a.amt);
    return arr;
  }, [transactions, bank]);
  const max = Math.max(...data.map((d) => d.amt), 1);
  if (data.length === 0) return <EmptyState title="No expenses to chart." body="Add a transaction to see the breakdown." />;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <ul className="space-y-3">
        {data.map((d) => (
          <li key={d.cat}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{d.cat}</span>
              <span className="tabular-nums text-muted-foreground">{formatNaira(d.amt)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(d.amt / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reports({ bank }: { bank: string }) {
  const transactions = useStore((s) => s.transactions);
  const banks = useStore((s) => s.banks);
  const filtered = bank === "all" ? transactions : transactions.filter((t) => t.bankId === bank || t.fromBankId === bank || t.toBankId === bank);

  const today = todayISO();
  const tabs = useMemo(() => {
    const daily = filtered.filter((t) => t.date === today);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekly = filtered.filter((t) => new Date(t.date) >= weekStart);
    const monthly = filtered.filter((t) => t.date.startsWith(today.slice(0, 7)));
    const yearly = filtered.filter((t) => t.date.startsWith(today.slice(0, 4)));
    return { daily, weekly, monthly, yearly };
  }, [filtered, today]);

  const [dailyFilter, setDailyFilter] = useState<"all" | "income" | "expense" | "intra">("all");
  const dailyShown = dailyFilter === "all" ? tabs.daily : tabs.daily.filter((t) => t.type === dailyFilter);

  return (
    <Tabs defaultValue="daily">
      <TabsList>
        <TabsTrigger value="daily">Daily</TabsTrigger>
        <TabsTrigger value="weekly">Weekly</TabsTrigger>
        <TabsTrigger value="monthly">Monthly</TabsTrigger>
        <TabsTrigger value="yearly">Yearly</TabsTrigger>
      </TabsList>
      <TabsContent value="daily" className="mt-4">
        <div className="mb-3 flex gap-1">
          {(["all", "income", "expense", "intra"] as const).map((f) => (
            <button key={f} onClick={() => setDailyFilter(f)}
              className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize",
                dailyFilter === f ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent")}>
              {f === "intra" ? "Transfers" : f}
            </button>
          ))}
        </div>
        <TxList tx={dailyShown} banks={banks} />
      </TabsContent>
      <TabsContent value="weekly" className="mt-4"><TxList tx={tabs.weekly} banks={banks} /></TabsContent>
      <TabsContent value="monthly" className="mt-4"><TxList tx={tabs.monthly} banks={banks} /></TabsContent>
      <TabsContent value="yearly" className="mt-4"><TxList tx={tabs.yearly} banks={banks} /></TabsContent>
    </Tabs>
  );
}

function TxList({ tx, banks }: { tx: Transaction[]; banks: Bank[] }) {
  const sorted = [...tx].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  function remove(id: string) {
    setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
    toast.success("Transaction deleted");
  }
  if (sorted.length === 0) return <EmptyState title="Nothing here yet." />;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {sorted.map((t) => {
        const bank = banks.find((b) => b.id === t.bankId || b.id === t.fromBankId);
        const toBank = banks.find((b) => b.id === t.toBankId);
        const Icon = t.type === "income" ? ArrowDown : t.type === "expense" ? ArrowUp : ArrowLeftRight;
        return (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <span className={cn("grid h-9 w-9 place-items-center rounded-md",
              t.type === "income" ? "bg-success/15 text-success" :
                t.type === "expense" ? "bg-destructive/15 text-destructive" : "bg-info/15 text-info")}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.description}</div>
              <div className="truncate text-xs text-muted-foreground">
                {t.category} · {t.date} {t.time}
                {bank && <span className="ml-1.5" style={{ color: bank.color }}>· {bank.name}{toBank ? ` → ${toBank.name}` : ""}</span>}
              </div>
            </div>
            <div className={cn("text-sm font-medium tabular-nums",
              t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : "text-info")}>
              {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}{formatNaira(t.amount)}
            </div>
            <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
