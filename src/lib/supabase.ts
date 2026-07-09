import { createClient } from "@supabase/supabase-js";

// VITE_ prefix makes these values available in the browser bundle.
// They are safe to expose — the anon key is public by design.
// Real security is enforced by Supabase RLS policies on every table.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Add them to your .env file and to Vercel Environment Variables.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
