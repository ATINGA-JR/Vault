// All Supabase read/write operations for Vault Personal OS.
import { supabase } from "./supabase";
import type {
  Task, Book, Movie, Show,
  ShoppingList, Notification, Settings, AppData,
} from "./types";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function deleteOrphans(table: string, userId: string, keepIds: string[]) {
  const { data } = await supabase.from(table).select("id").eq("user_id", userId);
  const toDelete = (data ?? [])
    .map((r: { id: string }) => r.id)
    .filter((id) => !keepIds.includes(id));
  if (toDelete.length > 0) {
    await supabase.from(table).delete().in("id", toDelete);
  }
}

// ─────────────────────────────────────────────────────────────
// LOAD
// ─────────────────────────────────────────────────────────────

export async function loadUserData(userId: string): Promise<Partial<AppData>> {
  const [
    { data: tasksRaw },
    { data: booksRaw },
    { data: moviesRaw },
    { data: showsRaw },
    { data: settingsRaw },
    { data: notifsRaw },
    { data: listsRaw },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("books").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("movies").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("shows").select("*").eq("user_id", userId).order("created_at"),
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

  const tasks: Task[] = (tasksRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    text: r.text as string,
    priority: r.priority as Task["priority"],
    dueDate: (r.due_date as string | null) ?? undefined,
    dueTime: (r.due_time as string | null) ?? undefined,
    done: r.done as boolean,
    createdAt: r.created_at as string,
  }));

  const books: Book[] = (booksRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    author: r.author as string,
    reading: (r.reading as boolean) ?? false,
    read: r.read as boolean,
    createdAt: r.created_at as string,
  }));

  const movies: Movie[] = (moviesRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    year: (r.year as number | null) ?? undefined,
    watching: (r.watching as boolean) ?? false,
    watched: r.watched as boolean,
    createdAt: r.created_at as string,
  }));

  const shows: Show[] = (showsRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    year: (r.year as number | null) ?? undefined,
    watching: (r.watching as boolean) ?? false,
    watched: r.watched as boolean,
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

  const settings: Settings | undefined = settingsRaw
    ? {
        theme: (settingsRaw as Record<string, unknown>).theme as Settings["theme"],
        notify: {
          tasks: (settingsRaw as Record<string, unknown>).notify_tasks as boolean,
          weekly: (settingsRaw as Record<string, unknown>).notify_weekly as boolean,
        },
      }
    : undefined;

  const lastWeeklySummary = settingsRaw
    ? ((settingsRaw as Record<string, unknown>).last_weekly_summary as string | null) ?? undefined
    : undefined;

  return {
    tasks, books, movies, shows, shoppingLists, notifications,
    ...(settings ? { settings } : {}),
    ...(lastWeeklySummary ? { lastWeeklySummary } : {}),
  };
}

// ─────────────────────────────────────────────────────────────
// SYNC
// ─────────────────────────────────────────────────────────────

export async function syncTasks(userId: string, tasks: Task[]) {
  if (tasks.length > 0) {
    await supabase.from("tasks").upsert(
      tasks.map((t) => ({
        id: t.id, user_id: userId, text: t.text, priority: t.priority,
        due_date: t.dueDate ?? null, due_time: t.dueTime ?? null,
        done: t.done, created_at: t.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("tasks", userId, tasks.map((t) => t.id));
}

export async function syncBooks(userId: string, books: Book[]) {
  if (books.length > 0) {
    await supabase.from("books").upsert(
      books.map((b) => ({
        id: b.id, user_id: userId, title: b.title, author: b.author,
        reading: b.reading, read: b.read, created_at: b.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("books", userId, books.map((b) => b.id));
}

export async function syncMovies(userId: string, movies: Movie[]) {
  if (movies.length > 0) {
    await supabase.from("movies").upsert(
      movies.map((m) => ({
        id: m.id, user_id: userId, title: m.title, year: m.year ?? null,
        watching: m.watching, watched: m.watched, created_at: m.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("movies", userId, movies.map((m) => m.id));
}

export async function syncShows(userId: string, shows: Show[]) {
  if (shows.length > 0) {
    await supabase.from("shows").upsert(
      shows.map((s) => ({
        id: s.id, user_id: userId, title: s.title, year: s.year ?? null,
        watching: s.watching, watched: s.watched, created_at: s.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("shows", userId, shows.map((s) => s.id));
}

export async function syncShoppingLists(userId: string, lists: ShoppingList[]) {
  const listIds = lists.map((l) => l.id);
  const sectionIds = lists.flatMap((l) => l.sections.map((s) => s.id));
  const itemIds = lists.flatMap((l) => l.sections.flatMap((s) => s.items.map((i) => i.id)));

  if (lists.length > 0) {
    await supabase.from("shopping_lists").upsert(
      lists.map((l) => ({
        id: l.id, user_id: userId, name: l.name, icon: l.icon,
        color: l.color, created_at: l.createdAt,
      })),
      { onConflict: "id" },
    );
  }

  const allSections = lists.flatMap((l) =>
    l.sections.map((s, idx) => ({
      id: s.id, user_id: userId, list_id: l.id, name: s.name, sort_order: idx,
    })),
  );
  if (allSections.length > 0) {
    await supabase.from("shopping_sections").upsert(allSections, { onConflict: "id" });
  }

  const allItems = lists.flatMap((l) =>
    l.sections.flatMap((s) =>
      s.items.map((i) => ({
        id: i.id, user_id: userId, section_id: s.id, name: i.name,
        quantity: i.quantity, unit: i.unit, price: i.price, done: i.done,
      })),
    ),
  );
  if (allItems.length > 0) {
    await supabase.from("shopping_items").upsert(allItems, { onConflict: "id" });
  }

  await deleteOrphans("shopping_items", userId, itemIds);
  await deleteOrphans("shopping_sections", userId, sectionIds);
  await deleteOrphans("shopping_lists", userId, listIds);
}

export async function syncNotifications(userId: string, notifications: Notification[]) {
  if (notifications.length > 0) {
    await supabase.from("notifications").upsert(
      notifications.map((n) => ({
        id: n.id, user_id: userId, title: n.title, body: n.body,
        kind: n.kind, read: n.read, created_at: n.createdAt,
      })),
      { onConflict: "id" },
    );
  }
  await deleteOrphans("notifications", userId, notifications.map((n) => n.id));
}

export async function syncSettings(userId: string, settings: Settings, lastWeeklySummary?: string) {
  await supabase.from("settings").upsert(
    {
      user_id: userId,
      theme: settings.theme,
      notify_tasks: settings.notify.tasks,
      notify_weekly: settings.notify.weekly,
      last_weekly_summary: lastWeeklySummary ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}
