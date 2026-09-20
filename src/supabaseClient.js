import { createClient } from '@supabase/supabase-js';

// Public (anon) credentials, baked in at build time. They are safe to ship in the browser;
// what the anon key may do is limited by the database's access rules (supabase/migrations).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
