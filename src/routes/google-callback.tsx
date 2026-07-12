import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useEffect } from "react";
import { exchangeCode, getGoogleEmail, adminSupabase } from "@/lib/google.server";

const handleGoogleCallback = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string(), state: z.string() }))
  .handler(async ({ data }) => {
    const tokens = await exchangeCode(data.code);
    const googleEmail = await getGoogleEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const db = adminSupabase();
    const { error } = await db.from("google_tokens").upsert(
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

    if (error) throw new Error(error.message);
    return { ok: true, email: googleEmail };
  });

export const Route = createFileRoute("/google-callback")({
  head: () => ({ meta: [{ title: "Connecting Google Calendar…" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) ?? "",
    state: (search.state as string) ?? "",
    error: (search.error as string) ?? "",
  }),
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const { code, state, error: oauthError } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    // Google returned an error (e.g. user denied access)
    if (oauthError) {
      navigate({ to: "/calendar", search: { google_error: "true" } });
      return;
    }

    if (!code || !state) {
      navigate({ to: "/calendar", search: { google_error: "true" } });
      return;
    }

    handleGoogleCallback({ data: { code, state } })
      .then(() => {
        navigate({ to: "/calendar", search: { google_connected: "true" } });
      })
      .catch((err) => {
        console.error("[google-callback]", err);
        navigate({ to: "/calendar", search: { google_error: "true" } });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Connecting Google Calendar…</p>
        <p className="mt-1 text-xs text-muted-foreground/60">Please wait, do not close this tab.</p>
      </div>
    </div>
  );
}
