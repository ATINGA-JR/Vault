// All data types for Vault Personal OS

export type ID = string;

export interface User {
  username: string;
  email: string;
  passwordHash: string; // kept for type compat, no longer used
  createdAt: string;
}

export type Priority = "high" | "medium" | "low";

export interface Task {
  id: ID;
  text: string;
  priority: Priority;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  done: boolean;
  createdAt: string;
}

export interface Bank {
  id: ID;
  name: string;
  icon: string; // emoji
  color: string; // hex
  createdAt: string;
}

export type TxType = "income" | "expense" | "intra";

export const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills", "Health",
  "Entertainment", "Salary", "Business", "Other",
] as const;
export type Category = typeof CATEGORIES[number];

export interface Transaction {
  id: ID;
  description: string;
  amount: number;
  type: TxType;
  category: Category;
  bankId?: ID; // for income/expense
  fromBankId?: ID; // for intra
  toBankId?: ID; // for intra
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  createdAt: string;
}

export interface Book {
  id: ID;
  title: string;
  author: string;
  reading: boolean;
  read: boolean;
  createdAt: string;
}

export type WatchType = "movie" | "series";
export interface Watch {
  id: ID;
  title: string;
  type: WatchType;
  year?: number;
  watching: boolean;
  watched: boolean;
  createdAt: string;
}

export const EVENT_COLORS = [
  "#D97757", // terracotta
  "#7D9B76", // sage
  "#6B8FB5", // dusk
  "#C9A84C", // gold
  "#9B72CF", // plum
  "#5C8A8A", // teal
] as const;

export interface CalendarEvent {
  id: ID;
  name: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  color: string;
  googleEventId?: string; // set when this event is linked to Google Calendar
  createdAt: string;
}

export interface ShoppingItem {
  id: ID;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  done: boolean;
}
export interface ShoppingSection {
  id: ID;
  name: string;
  items: ShoppingItem[];
}
export interface ShoppingList {
  id: ID;
  name: string;
  icon: string;
  color: string;
  sections: ShoppingSection[];
  createdAt: string;
}

export interface Notification {
  id: ID;
  title: string;
  body: string;
  kind: "task" | "event" | "budget" | "weekly" | "system";
  read: boolean;
  createdAt: string;
}

export interface Settings {
  theme: "light" | "dark";
  notify: {
    events: boolean;
    tasks: boolean;
    budget: boolean;
    weekly: boolean;
  };
}

export interface AppData {
  user: User | null;
  session: { username: string } | null;
  tasks: Task[];
  banks: Bank[];
  transactions: Transaction[];
  books: Book[];
  watchlist: Watch[];
  events: CalendarEvent[];
  shoppingLists: ShoppingList[];
  notifications: Notification[];
  settings: Settings;
  lastWeeklySummary?: string; // ISO date
}

export const DEFAULT_DATA: AppData = {
  user: null,
  session: null,
  tasks: [],
  banks: [],
  transactions: [],
  books: [],
  watchlist: [],
  events: [],
  shoppingLists: [],
  notifications: [],
  settings: {
    theme: "light",
    notify: { events: true, tasks: true, budget: true, weekly: true },
  },
};
