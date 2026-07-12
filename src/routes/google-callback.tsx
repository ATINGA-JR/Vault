import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exchangeCode, getGoogleEmail, adminSupabase } from "@/lib/google.server";

const handleGoogleCallback = createServerFn({ method: "GET" })
  .inputValidator(z.object({ code: z.string(), state: z.string() }))
  .handler(async ({ data }) => {
    try {
      const tokens = await exchangeCode(data.code);
      const googleEmail = await getGoogleEmail(tokens.access_token);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const db = adminSupabase();
      await db.from("google_tokens").upsert(
        {
          user_id: data.state,
          google_email: googleEmail,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          access_token_expires_at: expiresAt,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,google_email" },
      );

      return { ok: true, error: null };
    } catch (err) {
      console.error("[google-callback] error:", err);
      return { ok: false, error: String(err) };
    }
  });

// TanStack Router parses search params into an object — use validateSearch
// to type them properly, then read via Route.useSearch() in the component.
export const Route = createFileRoute("/google-callback")({
  head: () => ({ meta: [{ title: "Connecting Google Calendar…" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) ?? "",
    state: (search.state as string) ?? "",
  }),
  beforeLoad: async ({ search }) => {
    const { code, state } = search;
    if (!code || !state) {
      throw redirect({ to: "/calendar", search: { google_error: "true" } });
    }
    const result = await handleGoogleCallback({ data: { code, state } });
    if (result.ok) {
      throw redirect({ to: "/calendar", search: { google_connected: "true" } });
    } else {
      throw redirect({ to: "/calendar", search: { google_error: "true" } });
    }
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Connecting Google Calendar…</p>
      </div>
    </div>
  ),
});
