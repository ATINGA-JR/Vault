// Server-only Google Calendar API helpers.
// The .server.ts suffix prevents Vite from bundling this into the client.
// GOOGLE_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY never reach the browser.
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

/** Supabase admin client — bypasses RLS, server-side only. */
export function adminSupabase() {
  return createClient(
    getEnv("VITE_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

// ── OAuth ─────────────────────────────────────────────────────

/** Build the Google OAuth consent URL. userId is passed as `state`. */
export function buildGoogleAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: getEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: getEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Exchange an OAuth code for access + refresh tokens. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getEnv("GOOGLE_CLIENT_ID"),
      client_secret: getEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: getEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) throw new Error(`Token exchange failed: ${await r.text()}`);
  return r.json() as Promise<TokenResponse>;
}

/** Get the Google account email for a given access token. */
export async function getGoogleEmail(accessToken: string): Promise<string> {
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const d = (await r.json()) as { email: string };
  return d.email;
}

// ── Token management ──────────────────────────────────────────

/** Return a valid access token, refreshing it if expired. */
export async function getValidAccessToken(
  userId: string,
  googleEmail: string,
): Promise<string> {
  const db = adminSupabase();
  const { data } = await db
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("google_email", googleEmail)
    .single();

  if (!data) throw new Error("No Google token found");

  // Return cached token if still valid (5-min buffer)
  if (data.access_token && data.access_token_expires_at) {
    if (new Date(data.access_token_expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
      return data.access_token as string;
    }
  }

  // Refresh
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: data.refresh_token as string,
      client_id: getEnv("GOOGLE_CLIENT_ID"),
      client_secret: getEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error(`Token refresh failed: ${await r.text()}`);
  const tokens = (await r.json()) as { access_token: string; expires_in: number };

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await db
    .from("google_tokens")
    .update({ access_token: tokens.access_token, access_token_expires_at: expiresAt })
    .eq("user_id", userId)
    .eq("google_email", googleEmail);

  return tokens.access_token;
}

// ── Calendar events ───────────────────────────────────────────

export interface GoogleEvent {
  id: string;
  summary?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  status?: string;
}

/** Fetch events from a Google Calendar (past 30 days → next 90 days). */
export async function fetchGoogleEvents(
  accessToken: string,
  calendarId = "primary",
): Promise<GoogleEvent[]> {
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 90);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!r.ok) throw new Error(`Fetch events failed: ${await r.text()}`);
  const d = (await r.json()) as { items?: GoogleEvent[] };
  return d.items ?? [];
}

/** Push a new event to Google Calendar. Returns the Google event ID. */
export async function pushEventToGoogle(
  accessToken: string,
  event: { name: string; date: string; time?: string },
  calendarId = "primary",
): Promise<string> {
  const body = {
    summary: event.name,
    start: event.time
      ? { dateTime: `${event.date}T${event.time}:00`, timeZone: "UTC" }
      : { date: event.date },
    end: event.time
      ? { dateTime: `${event.date}T${event.time}:00`, timeZone: "UTC" }
      : { date: event.date },
  };
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) throw new Error(`Push event failed: ${await r.text()}`);
  const d = (await r.json()) as { id: string };
  return d.id;
}

/** Update an existing Google Calendar event. */
export async function updateGoogleEvent(
  accessToken: string,
  googleEventId: string,
  event: { name: string; date: string; time?: string },
  calendarId = "primary",
): Promise<void> {
  const body = {
    summary: event.name,
    start: event.time
      ? { dateTime: `${event.date}T${event.time}:00`, timeZone: "UTC" }
      : { date: event.date },
    end: event.time
      ? { dateTime: `${event.date}T${event.time}:00`, timeZone: "UTC" }
      : { date: event.date },
  };
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/** Delete a Google Calendar event. */
export async function deleteGoogleEvent(
  accessToken: string,
  googleEventId: string,
  calendarId = "primary",
): Promise<void> {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
