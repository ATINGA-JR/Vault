import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  adminSupabase,
  buildGoogleAuthUrl,
  getValidAccessToken,
  fetchGoogleEvents,
  pushEventToGoogle,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "../google.server";

const EVENT_COLORS = [
  "#D97757", "#7D9B76", "#6B8FB5",
  "#C9A84C", "#9B72CF", "#5C8A8A",
];

// ── Auth URL ──────────────────────────────────────────────────

/** Generate the Google OAuth consent URL for this Vault user. */
export const getGoogleAuthUrl = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    return { url: buildGoogleAuthUrl(data.userId) };
  });

// ── Connected accounts ────────────────────────────────────────

export const getConnectedGoogleAccounts = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const db = adminSupabase();
    const { data: tokens } = await db
      .from("google_tokens")
      .select("id, google_email, calendar_id, connected_at")
      .eq("user_id", data.userId);
    return { accounts: (tokens ?? []) as { id: string; google_email: string; calendar_id: string; connected_at: string }[] };
  });

export const disconnectGoogleAccount = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string(), googleEmail: z.string() }))
  .handler(async ({ data }) => {
    const db = adminSupabase();
    await db
      .from("google_tokens")
      .delete()
      .eq("user_id", data.userId)
      .eq("google_email", data.googleEmail);
    return { ok: true };
  });

// ── Two-way sync ──────────────────────────────────────────────

/**
 * Pull events from all connected Google accounts into Vault.
 * - New Google events are inserted with their google_event_id.
 * - Existing ones (matched by google_event_id) are updated (name/date/time).
 * Returns the number of newly imported events.
 */
export const syncGoogleCalendar = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const db = adminSupabase();
    const { data: tokens } = await db
      .from("google_tokens")
      .select("*")
      .eq("user_id", data.userId);

    if (!tokens?.length) return { synced: 0 };

    let synced = 0;

    for (const token of tokens) {
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(data.userId, token.google_email as string);
      } catch {
        continue; // skip this account if token refresh fails
      }

      const googleEvents = await fetchGoogleEvents(accessToken, token.calendar_id as string);

      for (const ge of googleEvents) {
        if (ge.status === "cancelled") continue;
        const name = ge.summary ?? "(No title)";
        const date = ge.start.date ?? ge.start.dateTime?.slice(0, 10) ?? "";
        const time = ge.start.dateTime ? ge.start.dateTime.slice(11, 16) : undefined;
        if (!date) continue;

        const { data: existing } = await db
          .from("calendar_events")
          .select("id")
          .eq("user_id", data.userId)
          .eq("google_event_id", ge.id)
          .single();

        if (existing) {
          // Update name/date/time if it changed in Google
          await db
            .from("calendar_events")
            .update({ name, date, time: time ?? null, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          // Import as new event
          await db.from("calendar_events").insert({
            user_id: data.userId,
            name,
            date,
            time: time ?? null,
            color: EVENT_COLORS[synced % EVENT_COLORS.length],
            google_event_id: ge.id,
          });
          synced++;
        }
      }
    }

    return { synced };
  });

// ── Push Vault → Google ───────────────────────────────────────

/**
 * Push a newly created Vault event to the first connected Google account.
 * Stores the returned google_event_id back on the Vault event row.
 */
export const pushVaultEventToGoogle = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string(),
      eventId: z.string(),
      name: z.string(),
      date: z.string(),
      time: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = adminSupabase();
    const { data: tokens } = await db
      .from("google_tokens")
      .select("*")
      .eq("user_id", data.userId)
      .limit(1);

    if (!tokens?.length) return { googleEventId: null };

    const token = tokens[0];
    const accessToken = await getValidAccessToken(data.userId, token.google_email as string);
    const googleEventId = await pushEventToGoogle(
      accessToken,
      { name: data.name, date: data.date, time: data.time },
      token.calendar_id as string,
    );

    // Link the Vault event to its Google counterpart
    await db
      .from("calendar_events")
      .update({ google_event_id: googleEventId })
      .eq("id", data.eventId)
      .eq("user_id", data.userId);

    return { googleEventId };
  });

// ── Update Google event ───────────────────────────────────────

export const updateGoogleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string(),
      googleEventId: z.string(),
      name: z.string(),
      date: z.string(),
      time: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = adminSupabase();
    const { data: tokens } = await db
      .from("google_tokens")
      .select("*")
      .eq("user_id", data.userId)
      .limit(1);

    if (!tokens?.length) return { ok: false };

    const token = tokens[0];
    const accessToken = await getValidAccessToken(data.userId, token.google_email as string);
    await updateGoogleEvent(
      accessToken,
      data.googleEventId,
      { name: data.name, date: data.date, time: data.time },
      token.calendar_id as string,
    );

    return { ok: true };
  });

// ── Delete Google event ───────────────────────────────────────

export const deleteGoogleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string(), googleEventId: z.string() }))
  .handler(async ({ data }) => {
    const db = adminSupabase();
    const { data: tokens } = await db
      .from("google_tokens")
      .select("*")
      .eq("user_id", data.userId)
      .limit(1);

    if (!tokens?.length) return { ok: false };

    const token = tokens[0];
    const accessToken = await getValidAccessToken(data.userId, token.google_email as string);
    await deleteGoogleEvent(accessToken, data.googleEventId, token.calendar_id as string);

    return { ok: true };
  });
