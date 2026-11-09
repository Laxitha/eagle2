import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Next.js caches server-side fetch() responses by default, and supabase-js
// reads over fetch — so without this an API route can keep returning the
// numbers from before the last upload. Every read goes to the database.
const noStore: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

export const supabaseAdmin = supabaseUrl
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: { fetch: noStore },
    })
  : (null as any);
