// ─── Currency fetching ────────────────────────────────────────────────────────
// Calls the Supabase Edge Function `get-cached-rates`, which:
//   • Returns DB-cached rates if still fresh (before next_update_at_utc)
//   • Fetches from ExchangeRate-API v6 and upserts to DB if stale
// The API key lives in Supabase Secrets — never exposed to the client.
//
// Fallback chain if the edge function is unreachable:
//   1. Stale localStorage cache   (handled in CurrencyContext)
//   2. FALLBACK_RATES constants   (handled in CurrencyContext)

const FETCH_TIMEOUT_MS = 10_000;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const EDGE_FN_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/get-cached-rates`
  : null;

// ─── Session-level in-memory cache ───────────────────────────────────────────
// Prevents redundant edge function calls within the same browser session
// (e.g. React StrictMode double-invoke, tab refocus before localStorage TTL
// would normally trigger a refetch).

let sessionRates: Record<string, number> | null = null;

// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Fetch EUR-relative exchange rates via the `get-cached-rates` Edge Function.
 * Returns in-memory session cache if already populated this session.
 */
async function fetchViaEdgeFunction(): Promise<Record<string, number>> {
  if (!EDGE_FN_URL) throw new Error('VITE_SUPABASE_URL is not configured');

  if (sessionRates) {
    console.log('[currency] Returning session-cached rates');
    return sessionRates;
  }

  console.log('[currency] Calling edge function:', EDGE_FN_URL);
  const res = await fetchWithTimeout(EDGE_FN_URL);
  if (!res.ok) throw new Error(`Edge function HTTP ${res.status}`);

  const data: { rates: Record<string, number>; source: string; error?: string } = await res.json();
  if (data.error) throw new Error(`Edge function error: ${data.error}`);

  console.log(`[currency] Edge function OK — source: ${data.source}, currencies: ${Object.keys(data.rates).length}`);
  sessionRates = data.rates;
  return data.rates;
}

/**
 * Fetch live EUR-relative exchange rates.
 * Delegates to the Supabase Edge Function which handles DB caching and keeps
 * the API key server-side. Throws on failure so CurrencyContext can fall back.
 */
export async function fetchLiveRates(): Promise<Record<string, number>> {
  return fetchViaEdgeFunction();
}
