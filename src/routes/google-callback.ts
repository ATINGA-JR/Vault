import { createAPIFileRoute } from "@tanstack/react-start/api";
import { exchangeCode, getGoogleEmail, adminSupabase } from "../../../lib/google.server";

export const Route = createAPIFileRoute("/api/google/callback")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state");

    if (!code || !userId) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/calendar?google_error=missing_params" },
      });
    }

    try {
      const tokens = await exchangeCode(code);
      const googleEmail = await getGoogleEmail(tokens.access_token);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const db = adminSupabase();
      await db.from("google_tokens").upsert(
        {
          user_id: userId,
          google_email: googleEmail,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          access_token_expires_at: expiresAt,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,google_email" },
      );

      return new Response(null, {
        status: 302,
        headers: { Location: "/calendar?google_connected=true" },
      });
    } catch (err) {
      console.error("[google/callback] error:", err);
      return new Response(null, {
        status: 302,
        headers: { Location: "/calendar?google_error=true" },
      });
    }
  },
});
