// All Supabase read/write operations for Vault Personal OS.
// Routes and components never import this directly — they go through store.ts.
import { supabase } from "./supabase";
import type {
  Task, Bank, Transaction, Book, Watch, CalendarEvent,
  ShoppingList, Notification, Settings, AppData,
} from "./types";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

// Fetch the IDs that currently exist for a table, then delete any
// that are no longer in `keepIds`. Avoids the finicky NOT IN syntax.
async function deleteOrphans(
  table: string,
  userId: string,
  keepIds: string[],
) {
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId);

  const toDelete = (data ?? [])
    .map((r: { id: string }) => r.id)
    .filter((id) => !keepIds.includes(id));

  if (toDelete.length > 0) {
    await supabase.from(table).delete().in("id", toDelete);
  }
}

// ─────────────────────────────────────────────────────────────
// LOAD — fetch everything for a user on login
// ─────────────────────────────────────────────────────────────

export async function loadUserData(userId: string): Promise<Partial<AppData>> {
  const [
    { data: tasksRaw },
    { data: banksRaw },
    { data: txRaw },
    { data: booksRaw },
    { data: watchRaw },
    { data: eventsRaw },
    { data: settingsRaw },
    { data: notifsRaw },
    { data: listsRaw },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("banks").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("transactions").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("books").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("watchlist").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("calendar_events").select("*").eq("user_id", userId).order("date"),
    supabase.from("settings").select("*").eq("user_id", userId).single(),
    supabase.from("notifications").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(200),
    supabase.from("shopping_lists").select(`
      id, name, icon, color, created_at,
      shopping_sections (
        id, name, sort_order,
        shopping_items ( id, name, quantity, unit, price, done )
      )
    `).eq("user_id", userId).order("created_at"),
  ]);

  // Map DB rows → app types (snake_case → camelCase)
  const tasks: Task[] = (tasksRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    text: r.text as string,
    priority: r.priority as Task["priority"],
    dueDate: (r.due_date as string | null) ?? undefined,
    dueTime: (r.due_time as string | null) ?? undefined,
    done: r.done as boolean,
    createdAt: r.created_at as string,
  }));

  const banks: Bank[] = (banksRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    icon: r.icon as string,
    color: r.color as string,
    createdAt: r.created_at as string,
  }));

  const transactions: Transaction[] = (txRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    description: r.description as string,
    amount: r.amount as number,
    type: r.type as Transaction["type"],
    category: r.category as Transaction["category"],
    bankId: (r.bank_id as string | null) ?? undefined,
    fromBankId: (r.from_bank_id as string | null) ?? undefined,
    toBankId: (r.to_bank_id as string | null) ?? undefined,
    date: r.date as string,
    time: r.time as string,
    recurrence: (r.recurrence as Transaction["recurrence"] | null) ?? undefined,
    createdAt: r.created_at as string,
  }));

  const books: Book[] = (booksRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    author: r.author as string,
    read: r.read as boolean,
    createdAt: r.created_at as string,
  }));

  const watchlist: Watch[] = (watchRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    type: r.type as Watch["type"],
    watched: r.watched as boolean,
    createdAt: r.created_at as string,
  }));

  const events: CalendarEvent[] = (eventsRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    date: r.date as string,
    time: (r.time as string | null) ?? undefined,
    color: r.color as string,
    googleEventId: (r.google_event_id as string | null) ?? undefined,
    createdAt: r.created_at as string,
  }));

  const notifications: Notification[] = (notifsRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    kind: r.kind as Notification["kind"],
    read: r.read as boolean,
    createdAt: r.created_at as string,
  }));

  const shoppingLists: ShoppingList[] = (listsRaw ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    name: l.name as string,
    icon: l.icon as string,
    color: l.color as string,
    createdAt: l.created_at as string,
    sections: ((l.shopping_sections as Record<string, unknown>[]) ?? [])
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map((sec) => ({
        id: sec.id as string,
        name: sec.name as string,
        items: ((sec.shopping_items as Record<string, unknown>[]) ?? []).map((item) => ({
          id: item.id as string,
          name: item.name as string,
          quantity: item.quantity as number,
          unit: item.unit as string,
          price: item.price as number,
          done: item.done as boolean,
        })),
      })),
  }));

  // Map settings (flat DB columns → nested store shape)
  const settings: Settings | undefined = settingsRaw
    ? {
        theme: (settingsRaw as Record<string, unknown>).theme as Settings["theme"],
        notify: {
          events: (settingsRaw as Record<string, unknown>).notify_events as boolean,
          tasks: (settingsRaw as Record<string, unknown>).notify_tasks as boolean,
          budget: (settingsRaw as Record<string, unknown>).notify_budget as boolean,
          weekly: (settingsRaw as Record<string, unknown>).notify_weekly as boolean,
        },
      }
    : undefined;

  const lastWeeklySummary =
    settingsRaw
      ? ((settingsRaw as Record<string, unknown>).last_weekly_summary as string | null) ?? undefined
      : undefined;

  return {
    tasks,
    banks,
    transactions,
    books,
    watchlist,
    events,
    shoppingLists,
    notifications,
    ...(settings ? { settings } : {}),
    ...(lastWeeklySummary ? { lastWeeklySummary } : {}),
  };
}

// ─────────────────────────────────────────────────────────────
// SYNC — write changed slices back to Supabase
// ─────────────────────────────────────────────────────────────

export async function syncTasks(userId: string, tasks: Task[]) {
  if (tasks.length > 0) {
    await supabase.from("tasks").upsert(
      tasks.map((t) => ({
        id: t.id,
        user_id: userId,
        text: t.text,
        priority: t.priority,
        due_date: t.dueDate ?? null,
        due_time: t.dueTime ?? null,
        done: t.done,
        created_at: t.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("tasks", userId, tasks.map((t) => t.id));
}

export async function syncBanks(userId: string, banks: Bank[]) {
  if (banks.length > 0) {
    await supabase.from("banks").upsert(
      banks.map((b) => ({
        id: b.id,
        user_id: userId,
        name: b.name,
        icon: b.icon,
        color: b.color,
        created_at: b.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("banks", userId, banks.map((b) => b.id));
}

export async function syncTransactions(userId: string, transactions: Transaction[]) {
  if (transactions.length > 0) {
    await supabase.from("transactions").upsert(
      transactions.map((t) => ({
        id: t.id,
        user_id: userId,
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category,
        bank_id: t.bankId ?? null,
        from_bank_id: t.fromBankId ?? null,
        to_bank_id: t.toBankId ?? null,
        date: t.date,
        time: t.time,
        recurrence: t.recurrence ?? null,
        created_at: t.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("transactions", userId, transactions.map((t) => t.id));
}

export async function syncBooks(userId: string, books: Book[]) {
  if (books.length > 0) {
    await supabase.from("books").upsert(
      books.map((b) => ({
        id: b.id,
        user_id: userId,
        title: b.title,
        author: b.author,
        read: b.read,
        created_at: b.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("books", userId, books.map((b) => b.id));
}

export async function syncWatchlist(userId: string, watchlist: Watch[]) {
  if (watchlist.length > 0) {
    await supabase.from("watchlist").upsert(
      watchlist.map((w) => ({
        id: w.id,
        user_id: userId,
        title: w.title,
        type: w.type,
        watched: w.watched,
        created_at: w.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("watchlist", userId, watchlist.map((w) => w.id));
}

export async function syncEvents(userId: string, events: CalendarEvent[]) {
  if (events.length > 0) {
    await supabase.from("calendar_events").upsert(
      events.map((e) => ({
        id: e.id,
        user_id: userId,
        name: e.name,
        date: e.date,
        time: e.time ?? null,
        color: e.color,
        google_event_id: e.googleEventId ?? null,
        created_at: e.createdAt,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("calendar_events", userId, events.map((e) => e.id));
}

export async function syncShoppingLists(userId: string, lists: ShoppingList[]) {
  // Collect all IDs for orphan cleanup
  const listIds = lists.map((l) => l.id);
  const sectionIds = lists.flatMap((l) => l.sections.map((s) => s.id));
  const itemIds = lists.flatMap((l) =>
    l.sections.flatMap((s) => s.items.map((i) => i.id)),
  );

  // Upsert lists
  if (lists.length > 0) {
    await supabase.from("shopping_lists").upsert(
      lists.map((l) => ({
        id: l.id,
        user_id: userId,
        name: l.name,
        icon: l.icon,
        color: l.color,
        created_at: l.createdAt,
      })),
      { onConflict: "id" },
    );
  }

  // Upsert sections
  const allSections = lists.flatMap((l) =>
    l.sections.map((s, idx) => ({
      id: s.id,
      user_id: userId,
      list_id: l.id,
      name: s.name,
      sort_order: idx,
    })),
  );
  if (allSections.length > 0) {
    await supabase.from("shopping_sections").upsert(allSections, { onConflict: "id" });
  }

  // Upsert items
  const allItems = lists.flatMap((l) =>
    l.sections.flatMap((s) =>
      s.items.map((i) => ({
        id: i.id,
        user_id: userId,
        section_id: s.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        price: i.price,
        done: i.done,
      })),
    ),
  );
  if (allItems.length > 0) {
    await supabase.from("shopping_items").upsert(allItems, { onConflict: "id" });
  }

  // Delete orphans — items first (FK order), then sections, then lists
  await deleteOrphans("shopping_items", userId, itemIds);
  await deleteOrphans("shopping_sections", userId, sectionIds);
  await deleteOrphans("shopping_lists", userId, listIds);
}

export async function syncNotifications(userId: string, notifications: Notification[]) {
  if (notifications.length > 0) {
    await supabase.from("notifications").upsert(
      notifications.map((n) => ({
        id: n.id,
        user_id: userId,
        title: n.title,
        body: n.body,
        kind: n.kind,
        read: n.read,
        created_at: n.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("notifications", userId, notifications.map((n) => n.id));
}

export async function syncSettings(
  userId: string,
  settings: Settings,
  lastWeeklySummary?: string,
) {
  await supabase.from("settings").upsert(
    {
      user_id: userId,
      theme: settings.theme,
      notify_events: settings.notify.events,
      notify_tasks: settings.notify.tasks,
      notify_budget: settings.notify.budget,
      notify_weekly: settings.notify.weekly,
      last_weekly_summary: lastWeeklySummary ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}
