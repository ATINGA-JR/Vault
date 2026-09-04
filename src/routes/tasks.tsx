import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AuthGate } from "@/components/app/AuthGate";
import { PageHeader, Section, EmptyState } from "@/components/app/ui-bits";
import { useStore, setState, uid } from "@/lib/store";
import { weekDays, toISODate, DAY_LABEL, MONTH_LABEL, todayISO, formatDateLong, addDays, startOfWeek } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Priority, Task } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Vault" }] }),
  component: () => (
    <AuthGate><AppShell><TasksPage /></AppShell></AuthGate>
  ),
});

function TasksPage() {
  const tasks = useStore((s) => s.tasks);
  const [weekOffset, setWeekOffset] = useState(0);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [tab, setTab] = useState("week");

  const ref = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => weekDays(ref), [ref]);
  const today = todayISO();

  const pendingTasks = tasks.filter((t) => !t.done).sort(sortTask);
  const doneTasks = tasks.filter((t) => t.done).sort(sortTask);
  const unscheduled = pendingTasks.filter((t) => !t.dueDate);

  function tasksFor(date: string) { return tasks.filter((t) => t.dueDate === date).sort(sortTask); }

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="What needs doing."
        subtitle={`${pendingTasks.length} pending · ${doneTasks.length} done`}
        action={<QuickAddTask />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-serif text-xl">
              {MONTH_LABEL[ref.getMonth()]} {ref.getDate()} – {MONTH_LABEL[days[6].getMonth()]} {days[6].getDate()}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setWeekOffset((w) => w - 1)}>←</Button>
              <Button size="sm" variant="outline" onClick={() => setWeekOffset(0)}>Today</Button>
              <Button size="sm" variant="outline" onClick={() => setWeekOffset((w) => w + 1)}>→</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
            {days.map((d) => {
              const iso = toISODate(d);
              const dt = tasksFor(iso);
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  onClick={() => setOpenDay(iso)}
                  className={cn(
                    "group min-h-[140px] rounded-lg border bg-card p-3 text-left transition-all hover:border-border-strong hover:shadow-sm",
                    isToday ? "border-primary/40 bg-primary/[0.04]" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{DAY_LABEL[d.getDay()]}</div>
                      <div className={cn("font-serif text-2xl", isToday && "text-primary")}>{d.getDate()}</div>
                    </div>
                    {dt.length > 0 && (
                      <span className="rounded-full bg-secondary px-1.5 text-[10px] tabular-nums">{dt.length}</span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {dt.slice(0, 4).map((t) => (
                      <li key={t.id} className={cn("truncate rounded px-1.5 py-0.5 text-xs",
                        t.done ? "text-muted-foreground line-through" : "bg-secondary"
                      )}>
                        <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
                          t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-warning" : "bg-muted-foreground/50")} />
                        {t.text}
                      </li>
                    ))}
                    {dt.length > 4 && <li className="text-[10px] text-muted-foreground">+ more…</li>}
                  </ul>
                </button>
              );
            })}
          </div>

          {unscheduled.length > 0 && (
            <Section title="Unscheduled" subtitle="No due date" className="mt-10">
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {unscheduled.map((t) => <TaskRow key={t.id} task={t} />)}
              </ul>
            </Section>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          {pendingTasks.length === 0
            ? <EmptyState title="Nothing pending." body="All clear." />
            : <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {pendingTasks.map((t) => <TaskRow key={t.id} task={t} />)}
            </ul>}
        </TabsContent>

        <TabsContent value="done" className="mt-6">
          {doneTasks.length === 0
            ? <EmptyState title="No completed tasks yet." />
            : <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {doneTasks.map((t) => <TaskRow key={t.id} task={t} />)}
            </ul>}
        </TabsContent>
      </Tabs>

      <DayModal isoDate={openDay} onClose={() => setOpenDay(null)} />
    </>
  );
}

function sortTask(a: Task, b: Task) {
  const ad = (a.dueDate ?? "9999-99-99") + (a.dueTime ?? "99:99");
  const bd = (b.dueDate ?? "9999-99-99") + (b.dueTime ?? "99:99");
  return ad.localeCompare(bd);
}

export function TaskRow({ task, onAfter }: { task: Task; onAfter?: () => void }) {
  function toggle() {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)) }));
  }
  function remove() {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== task.id) }));
    toast.success("Task deleted");
    onAfter?.();
  }
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button onClick={toggle} className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded border",
        task.done ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
      )}>
        {task.done && <span className="text-[10px]">✓</span>}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm", task.done && "text-muted-foreground line-through")}>{task.text}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            task.priority === "high" ? "bg-destructive/10 text-destructive" :
              task.priority === "medium" ? "bg-warning/15 text-warning-foreground" : "bg-secondary",
          )}>{task.priority}</span>
          {task.dueDate && <span>{task.dueDate}{task.dueTime ? ` · ${task.dueTime}` : ""}</span>}
        </div>
      </div>
      <button onClick={remove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function QuickAddTask({ defaultDate }: { defaultDate?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState(defaultDate ?? "");
  const [dueTime, setDueTime] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          id: uid(),
          text: text.trim(),
          priority,
          dueDate: dueDate || undefined,
          dueTime: dueTime || undefined,
          done: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    toast.success("Task added");
    setText(""); setDueDate(defaultDate ?? ""); setDueTime("");
    setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm"><Plus className="mr-1 h-4 w-4" />New task</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-2xl">New task</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Task</Label>
              <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing?" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full">Add task</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DayModal({ isoDate, onClose }: { isoDate: string | null; onClose: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [time, setTime] = useState("");

  if (!isoDate) return null;
  const dt = tasks.filter((t) => t.dueDate === isoDate).sort(sortTask);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setState((s) => ({
      ...s,
      tasks: [...s.tasks, {
        id: uid(),
        text: text.trim(),
        priority,
        dueDate: isoDate!,
        dueTime: time || undefined,
        done: false,
        createdAt: new Date().toISOString(),
      }],
    }));
    toast.success("Task added");
    setText(""); setTime("");
  }

  return (
    <Dialog open={!!isoDate} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl sm:text-2xl">{formatDateLong(isoDate)}</DialogTitle>
        </DialogHeader>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tasks</div>
          {dt.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks for this day.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {dt.map((t) => <TaskRow key={t.id} task={t} />)}
            </ul>
          )}
        </div>

        <form onSubmit={add} className="mt-2 space-y-3 border-t border-border pt-4">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task for this day…" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="sm:w-32" />
            <Button type="submit" className="col-span-2 sm:flex-1">Add</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
