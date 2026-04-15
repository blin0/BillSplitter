import { createClient } from '@supabase/supabase-js';

// ─── Supabase connection ───────────────────────────────────────────────────────
// Set these in your .env.local file:
//   VITE_SUPABASE_URL=https://<your-project>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<your-anon-key>
//
// Both values are found in: Supabase Dashboard → Project Settings → API

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    '[Supabase] Missing env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ─── MCP integration point ─────────────────────────────────────────────────────
// When connecting via Supabase MCP, the MCP server uses the SERVICE_ROLE key
// (never exposed to the browser). Configure that separately in your MCP host:
//
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  ← server/MCP only, never VITE_
//
// The `supabase` client above (anon key) is for browser/frontend use.
