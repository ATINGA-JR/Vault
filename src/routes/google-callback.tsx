import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exchangeCode, getGoogleEmail, adminSupabase } from "@/lib/google.server";

// Server function that handles the OAuth token exchange
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

      throw redirect({ to: "/calendar", search: { google_connected: "true" } });
    } catch (err) {
      // Re-throw redirects
      if (err && typeof err === "object" && "to" in err) throw err;
      console.error("[google-callback] error:", err);
      throw redirect({ to: "/calendar", search: { google_error: "true" } });
    }
  });

export const Route = createFileRoute("/google-callback")({
  head: () => ({ meta: [{ title: "Connecting Google Calendar…" }] }),
  beforeLoad: async ({ location }) => {
    const code = new URLSearchParams(location.search as string).get("code");
    const state = new URLSearchParams(location.search as string).get("state");

    if (!code || !state) {
      throw redirect({ to: "/calendar", search: { google_error: "true" } });
    }

    await handleGoogleCallback({ data: { code, state } });
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
