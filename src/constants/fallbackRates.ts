/**
 * EUR-relative emergency fallback rates (1 EUR = X units).
 * Used only when the Frankfurter API is unreachable and no cached rates exist.
 * Approximate values as of early 2026 — update periodically.
 */
export const FALLBACK_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.05,
  GBP: 0.84,
  JPY: 161.0,
  CNY: 7.60,
  CAD: 1.46,
  AUD: 1.65,
  CHF: 0.94,
  HKD: 8.18,
  KRW: 1490.0,
  SGD: 1.42,
  INR: 89.5,
  MXN: 21.2,
  BRL: 6.25,
  SEK: 11.15,
  NOK: 11.85,
  DKK: 7.46,
  NZD: 1.82,
  THB: 37.5,
  TRY: 36.5,
  ZAR: 19.8,
  AED: 3.86,
  IDR: 17100.0,
  PHP: 62.5,
  MYR: 4.95,
  BGN: 1.96,
  CZK: 25.1,
  HUF: 400.0,
  ILS: 3.85,
  ISK: 149.0,
  PLN: 4.27,
  RON: 4.98,
};
