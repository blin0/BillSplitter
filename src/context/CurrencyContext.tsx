import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { FALLBACK_RATES } from '../constants/fallbackRates';
import { fetchLiveRates } from '../lib/currency';

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

const EXPENSE_CURRENCY_META: Record<string, { symbol: string; region: string }> = {
  USD: { symbol: '$',    region: 'Americas' },
  CAD: { symbol: 'C$',   region: 'Americas' },
  MXN: { symbol: 'MX$',  region: 'Americas' },
  BRL: { symbol: 'R$',   region: 'Americas' },
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

export const RATES_CACHE_KEY = 'billsplitter_rates_v1';
const RATES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface RatesCache {
  timestamp:     number;
  rates:         Record<string, number>;
  previousRates: Record<string, number> | null;
}

function readCachedRates(ignoreTTL = false): RatesCache | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed: RatesCache = JSON.parse(raw);
    if (!ignoreTTL && Date.now() - parsed.timestamp > RATES_CACHE_TTL) return null;
    return parsed;
  } catch { return null; }
}

function writeCachedRates(
  rates:         Record<string, number>,
  previousRates: Record<string, number> | null,
) {
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      rates,
      previousRates,
    } satisfies RatesCache));
  } catch (_) {}
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CURRENCY_KEY = 'billsplitter_currency';

function readStoredCurrency(): CurrencyCode {
  const v = localStorage.getItem(CURRENCY_KEY);
  return (v && v in CURRENCIES ? v : 'USD') as CurrencyCode;
}

interface CurrencyCtx {
  currency:      CurrencyCode;
  setCurrency:   (c: CurrencyCode) => void;
  formatPrice:   (amount: number) => string;
  symbol:        string;
  rates:         Record<string, number>;
  /** Previous day's EUR-relative rates — null until first daily refresh */
  previousRates: Record<string, number> | null;
  ratesLoading:  boolean;
  ratesError:    string | null;
  ratesSource:   RatesSource;
  convert:       (amount: number, from: string, to: string) => number;
}

const CurrencyContext = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(readStoredCurrency);

  const cached = readCachedRates();
  const [rates,         setRates        ] = useState<Record<string, number>>(cached?.rates ?? FALLBACK_RATES);
  const [previousRates, setPreviousRates] = useState<Record<string, number> | null>(cached?.previousRates ?? null);
  const [ratesLoading,  setRatesLoading ] = useState<boolean>(!cached);
  const [ratesError,    setRatesError   ] = useState<string | null>(null);
  const [ratesSource,   setRatesSource  ] = useState<RatesSource>(cached ? 'live' : 'fallback');

  useEffect(() => {
    const fresh = readCachedRates(false);
    if (fresh) {
      setRates(fresh.rates);
      setPreviousRates(fresh.previousRates ?? null);
      setRatesSource('live');
      setRatesLoading(false);
      return;
    }

    setRatesLoading(true);

    fetchLiveRates()
      .then(({ rates: live, previousRates: prev }) => {
        setRates(live);
        setPreviousRates(prev);
        writeCachedRates(live, prev);
        setRatesSource('live');
        setRatesError(null);
      })
      .catch(err => {
        const stale = readCachedRates(true);
        if (stale) {
          setRates(stale.rates);
          setPreviousRates(stale.previousRates ?? null);
          setRatesSource('stale-cache');
          setRatesError('Could not reach exchange rate server. Using saved rates.');
        } else {
          setRates(FALLBACK_RATES);
          setPreviousRates(null);
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
      rates, previousRates, ratesLoading, ratesError, ratesSource, convert,
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
