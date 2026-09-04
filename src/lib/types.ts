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

export interface Book {
  id: ID;
  title: string;
  author: string;
  reading: boolean;
  read: boolean;
  createdAt: string;
}

export interface Movie {
  id: ID;
  title: string;
  year?: number;
  watching: boolean;
  watched: boolean;
  createdAt: string;
}

export interface Show {
  id: ID;
  title: string;
  year?: number;
  watching: boolean;
  watched: boolean;
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
  kind: "task" | "weekly" | "system";
  read: boolean;
  createdAt: string;
}

export interface Settings {
  theme: "light" | "dark";
  notify: {
    tasks: boolean;
    weekly: boolean;
  };
}

export interface AppData {
  user: User | null;
  session: { username: string } | null;
  tasks: Task[];
  books: Book[];
  movies: Movie[];
  shows: Show[];
  shoppingLists: ShoppingList[];
  notifications: Notification[];
  settings: Settings;
  lastWeeklySummary?: string; // ISO date
}

export const DEFAULT_DATA: AppData = {
  user: null,
  session: null,
  tasks: [],
  books: [],
  movies: [],
  shows: [],
  shoppingLists: [],
  notifications: [],
  settings: {
    theme: "light",
    notify: { tasks: true, weekly: true },
  },
};
