export function formatNaira(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return sign + "₦" + abs.toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateLong(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return `${DAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  return new Date(s + "T00:00:00");
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function startOfWeek(d: Date = new Date()): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0=Sun
  // week starts Monday
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function weekDays(d: Date = new Date()): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const DAY_LABEL = DAYS;
export const DAY_LABEL_LONG = DAYS_LONG;
export const MONTH_LABEL = MONTHS;
