import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn("Supabase environment variables are not configured. See docs/supabase.md for setup steps.");
}

export const supabase: SupabaseClient = createClient(
  url ?? "",
  anonKey ?? "",
  {
    auth: {
      persistSession: false,
    },
  }
);
