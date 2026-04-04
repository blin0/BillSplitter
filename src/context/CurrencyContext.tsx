import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { FALLBACK_RATES } from '../constants/fallbackRates';

// ─── Base currencies (group display) ─────────────────────────────────────────

export type CurrencyCode =
  // Americas
  | 'USD' | 'CAD' | 'MXN' | 'BRL'
  // Europe
  | 'EUR' | 'GBP' | 'CHF' | 'SEK'
  // Asia / Pacific
  | 'CNY' | 'JPY' | 'KRW' | 'INR' | 'AUD' | 'SGD' | 'HKD'
  // Other
  | 'ZAR' | 'AED';

interface CurrencyMeta {
  symbol: string;
  label: string;
  region: 'Americas' | 'Europe' | 'Asia & Pacific' | 'Other';
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  // Americas
  USD: { symbol: '$',    label: 'US Dollar',         region: 'Americas'       },
  CAD: { symbol: 'C$',   label: 'Canadian Dollar',   region: 'Americas'       },
  MXN: { symbol: 'MX$',  label: 'Mexican Peso',      region: 'Americas'       },
  BRL: { symbol: 'R$',   label: 'Brazilian Real',    region: 'Americas'       },
  // Europe
  EUR: { symbol: '€',    label: 'Euro',              region: 'Europe'         },
  GBP: { symbol: '£',    label: 'British Pound',     region: 'Europe'         },
  CHF: { symbol: 'Fr.',  label: 'Swiss Franc',       region: 'Europe'         },
  SEK: { symbol: 'kr',   label: 'Swedish Krona',     region: 'Europe'         },
  // Asia & Pacific
  // Note: both CNY and JPY use ¥ visually — the ISO code (not the symbol) is
  // always stored in state and used for all API calls, preventing any collision.
  CNY: { symbol: 'CN¥',  label: 'Chinese Yuan',      region: 'Asia & Pacific' },
  JPY: { symbol: '¥',    label: 'Japanese Yen',      region: 'Asia & Pacific' },
  KRW: { symbol: '₩',    label: 'South Korean Won',  region: 'Asia & Pacific' },
  INR: { symbol: '₹',    label: 'Indian Rupee',      region: 'Asia & Pacific' },
  AUD: { symbol: 'A$',   label: 'Australian Dollar', region: 'Asia & Pacific' },
  SGD: { symbol: 'S$',   label: 'Singapore Dollar',  region: 'Asia & Pacific' },
  HKD: { symbol: 'HK$',  label: 'Hong Kong Dollar',  region: 'Asia & Pacific' },
  // Other
  ZAR: { symbol: 'R',    label: 'South African Rand', region: 'Other'         },
  AED: { symbol: 'د.إ',  label: 'UAE Dirham',         region: 'Other'         },
};

export const CURRENCY_REGIONS = ['Americas', 'Europe', 'Asia & Pacific', 'Other'] as const;
export type CurrencyRegion = typeof CURRENCY_REGIONS[number];

// ─── Source currencies for expense entry ─────────────────────────────────────
//
// Full Frankfurter set plus AED (falls back to FALLBACK_RATES since Frankfurter
// doesn't carry it). Each entry carries a display symbol and region so the
// CurrencySelect component can group and label them consistently.
//
// CNY and JPY both use ¥ visually. We disambiguate with CN¥ / ¥ in the symbol
// field, but the ISO code (not the symbol) is always stored in state and sent
// to the API, so there is zero risk of calculation collision.

const EXPENSE_CURRENCY_META: Record<string, { symbol: string; region: string }> = {
  // Americas
  USD: { symbol: '$',    region: 'Americas' },
  CAD: { symbol: 'C$',   region: 'Americas' },
  MXN: { symbol: 'MX$',  region: 'Americas' },
  BRL: { symbol: 'R$',   region: 'Americas' },
  // Europe
  EUR: { symbol: '€',    region: 'Europe' },
  GBP: { symbol: '£',    region: 'Europe' },
  CHF: { symbol: 'Fr.',  region: 'Europe' },
  SEK: { symbol: 'kr',   region: 'Europe' },
  NOK: { symbol: 'kr',   region: 'Europe' },
  DKK: { symbol: 'kr',   region: 'Europe' },
  ISK: { symbol: 'kr',   region: 'Europe' },
  PLN: { symbol: 'zł',   region: 'Europe' },
  CZK: { symbol: 'Kč',   region: 'Europe' },
  HUF: { symbol: 'Ft',   region: 'Europe' },
  RON: { symbol: 'lei',  region: 'Europe' },
  BGN: { symbol: 'лв',   region: 'Europe' },
  TRY: { symbol: '₺',    region: 'Europe' },
  // Asia & Pacific
  CNY: { symbol: 'CN¥',  region: 'Asia & Pacific' },
  JPY: { symbol: '¥',    region: 'Asia & Pacific' },
  KRW: { symbol: '₩',    region: 'Asia & Pacific' },
  INR: { symbol: '₹',    region: 'Asia & Pacific' },
  AUD: { symbol: 'A$',   region: 'Asia & Pacific' },
  SGD: { symbol: 'S$',   region: 'Asia & Pacific' },
  HKD: { symbol: 'HK$',  region: 'Asia & Pacific' },
  NZD: { symbol: 'NZ$',  region: 'Asia & Pacific' },
  THB: { symbol: '฿',    region: 'Asia & Pacific' },
  MYR: { symbol: 'RM',   region: 'Asia & Pacific' },
  IDR: { symbol: 'Rp',   region: 'Asia & Pacific' },
  PHP: { symbol: '₱',    region: 'Asia & Pacific' },
  // Other
  ZAR: { symbol: 'R',    region: 'Other' },
  ILS: { symbol: '₪',    region: 'Other' },
  AED: { symbol: 'د.إ',  region: 'Other' },
};

export interface ExpenseCurrency {
  code: string;
  label: string;
  symbol: string;
  region: string;
}

export const EXPENSE_CURRENCIES: ExpenseCurrency[] =
  Object.keys(EXPENSE_CURRENCY_META).map(code => {
    let label = code;
    try { label = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? code; }
    catch { /* noop */ }
    const { symbol, region } = EXPENSE_CURRENCY_META[code];
    return { code, label, symbol, region };
  });

// ─── Rates source ─────────────────────────────────────────────────────────────

export type RatesSource = 'live' | 'stale-cache' | 'fallback';

// ─── Exchange rate cache ──────────────────────────────────────────────────────

const RATES_CACHE_KEY  = 'billsplitter_rates_v1';
const RATES_CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 10_000;

interface RatesCache { timestamp: number; rates: Record<string, number> }

function readCachedRates(ignoreTTL = false): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed: RatesCache = JSON.parse(raw);
    if (!ignoreTTL && Date.now() - parsed.timestamp > RATES_CACHE_TTL) return null;
    return parsed.rates;
  } catch { return null; }
}

function writeCachedRates(rates: Record<string, number>) {
  localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), rates }));
}

async function fetchLiveRates(): Promise<Record<string, number>> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.frankfurter.dev/v2/latest', { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { rates: Record<string, number> } = await res.json();
    return { EUR: 1, ...data.rates };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CURRENCY_KEY = 'billsplitter_currency';

function readStoredCurrency(): CurrencyCode {
  const v = localStorage.getItem(CURRENCY_KEY);
  return (v && v in CURRENCIES ? v : 'USD') as CurrencyCode;
}

interface CurrencyCtx {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  /**
   * Format `amount` using the group base currency.
   * Uses Intl.NumberFormat so JPY shows ¥5,000 (no decimals),
   * EUR shows €5.00, etc. — all driven by the ISO code, not the symbol.
   */
  formatPrice: (amount: number) => string;
  symbol: string;
  rates: Record<string, number>;
  ratesLoading: boolean;
  ratesError: string | null;
  ratesSource: RatesSource;
  convert: (amount: number, from: string, to: string) => number;
}

const CurrencyContext = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(readStoredCurrency);

  const [rates, setRates]               = useState<Record<string, number>>(
    readCachedRates() ?? FALLBACK_RATES
  );
  const [ratesLoading, setRatesLoading] = useState<boolean>(!readCachedRates());
  const [ratesError, setRatesError]     = useState<string | null>(null);
  const [ratesSource, setRatesSource]   = useState<RatesSource>(
    readCachedRates() ? 'live' : 'fallback'
  );

  useEffect(() => {
    const fresh = readCachedRates(false);
    if (fresh) {
      setRates(fresh);
      setRatesSource('live');
      setRatesLoading(false);
      return;
    }

    setRatesLoading(true);

    fetchLiveRates()
      .then(live => {
        setRates(live);
        writeCachedRates(live);
        setRatesSource('live');
        setRatesError(null);
      })
      .catch(err => {
        const stale = readCachedRates(true);
        if (stale) {
          setRates(stale);
          setRatesSource('stale-cache');
          setRatesError('Could not reach exchange rate server. Using saved rates.');
        } else {
          setRates(FALLBACK_RATES);
          setRatesSource('fallback');
          setRatesError('No cached rates available. Using approximate offline rates.');
        }
        console.warn('Exchange rate fetch failed:', err);
      })
      .finally(() => setRatesLoading(false));
  }, []);

  function setCurrency(c: CurrencyCode) {
    localStorage.setItem(CURRENCY_KEY, c);
    setCurrencyState(c);
  }

  /**
   * Locale-aware formatting via Intl.NumberFormat.
   * Passing the ISO currency code (not a symbol) lets the browser pick the
   * correct decimal places: JPY → 0, most others → 2.
   */
  function formatPrice(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  function convert(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    const rFrom = rates[from] ?? 1;
    const rTo   = rates[to]   ?? 1;
    return amount * rTo / rFrom;
  }

  return (
    <CurrencyContext.Provider value={{
      currency, setCurrency, formatPrice,
      symbol: CURRENCIES[currency].symbol,
      rates, ratesLoading, ratesError, ratesSource, convert,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyCtx {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used inside CurrencyProvider');
  return ctx;
}
