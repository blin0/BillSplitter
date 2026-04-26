// ─── Currency fetching ────────────────────────────────────────────────────────
// Calls the Supabase Edge Function `get-cached-rates`, which:
//   • Returns DB-cached rates if still fresh (before next_update_at_utc)
//   • Fetches from ExchangeRate-API v6 and upserts to DB if stale
//     — also snapshots the outgoing rates into `previous_rates` so callers
//       can compute daily ± change without a second API call.
// The API key lives in Supabase Secrets — never exposed to the client.
//
// Fallback chain if the edge function is unreachable:
//   1. Stale localStorage cache   (handled in CurrencyContext)
//   2. FALLBACK_RATES constants   (handled in CurrencyContext)

export interface LiveRatesResult {
  rates:         Record<string, number>;
  previousRates: Record<string, number> | null;
}

const FETCH_TIMEOUT_MS = 10_000;

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const EDGE_FN_URL   = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/get-cached-rates`
  : null;

// ─── Session-level in-memory cache ───────────────────────────────────────────
// Prevents redundant edge function calls within the same browser session.

let sessionCache: LiveRatesResult | null = null;

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
 * Fetch EUR-relative exchange rates (+ previous day's rates) via the
 * `get-cached-rates` Edge Function.  Returns in-memory session cache if
 * already populated this session.
 */
export async function fetchLiveRates(): Promise<LiveRatesResult> {
  if (!EDGE_FN_URL) throw new Error('VITE_SUPABASE_URL is not configured');

  if (sessionCache) {
    console.log('[currency] Returning session-cached rates');
    return sessionCache;
  }

  console.log('[currency] Calling edge function:', EDGE_FN_URL);
  const res = await fetchWithTimeout(EDGE_FN_URL);
  if (!res.ok) throw new Error(`Edge function HTTP ${res.status}`);

  const data: {
    rates:         Record<string, number>;
    previousRates: Record<string, number> | null;
    source:        string;
    error?:        string;
  } = await res.json();

  if (data.error) throw new Error(`Edge function error: ${data.error}`);

  console.log(`[currency] Edge function OK — source: ${data.source}, currencies: ${Object.keys(data.rates).length}`);

  sessionCache = { rates: data.rates, previousRates: data.previousRates ?? null };
  return sessionCache;
}
