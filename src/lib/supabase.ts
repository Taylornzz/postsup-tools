import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Reads the public Supabase URL + anon key from env (.env.local locally, Vercel
// env vars in prod). The anon key is safe to expose — row-level security is what
// protects the data. When either is missing, the app falls back to local-only.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anon);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url as string, anon as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
