// ─── Stripe price IDs ─────────────────────────────────────────────────────────
// Create / update prices in the Stripe dashboard, then paste the IDs here.
// Monthly prices are live; yearly + Premier prices are placeholders — create
// them in Stripe before going to production.

export const STRIPE_PRICES = {
  // ── Pro tier ────────────────────────────────────────────────────────────────
  /** $4.99 / month — recurring */
  PRO_MONTHLY:     'price_1TNVMrC9TAB0tHUmoVFlADZc',
  /** $47.88 / year — recurring */
  PRO_YEARLY:      'price_1TNVMsC9TAB0tHUmxKRJu7tt',

  // ── Premier tier ────────────────────────────────────────────────────────────
  /** $9.99 / month — recurring */
  PREMIER_MONTHLY: 'price_1TNVMuC9TAB0tHUmbvgTBlyU',
  /** $95.88 / year — recurring */
  PREMIER_YEARLY:  'price_1TNVN1C9TAB0tHUmDcVLt4ve',

  // ── Legacy aliases (kept for backwards compat with webhook handler) ─────────
  /** @deprecated use PRO_MONTHLY */
  PLUS_MONTHLY: 'price_1TNVMrC9TAB0tHUmoVFlADZc',
  /** $49.00 — one-time lifetime purchase */
  LIFETIME:     'price_1TMtrYC9TAB0tHUmEzwElXdA',
} as const;

export type StripePriceId = typeof STRIPE_PRICES[keyof typeof STRIPE_PRICES];

/** All price IDs that belong to the Pro tier */
export const PRO_PRICE_IDS: string[] = [
  STRIPE_PRICES.PRO_MONTHLY,
  STRIPE_PRICES.PRO_YEARLY,
  STRIPE_PRICES.PLUS_MONTHLY,   // legacy
  STRIPE_PRICES.LIFETIME,       // legacy lifetime = Pro
];

/** All price IDs that belong to the Premier tier */
export const PREMIER_PRICE_IDS: string[] = [
  STRIPE_PRICES.PREMIER_MONTHLY,
  STRIPE_PRICES.PREMIER_YEARLY,
];

/** True if a price ID is a one-time (non-recurring) purchase */
export function isLifetimePrice(priceId: string): boolean {
  return priceId === STRIPE_PRICES.LIFETIME;
}

/** Return which tier a price ID belongs to */
export function tierForPrice(priceId: string | null): 'free' | 'pro' | 'premier' {
  if (!priceId) return 'free';
  if (PREMIER_PRICE_IDS.includes(priceId)) return 'premier';
  if (PRO_PRICE_IDS.includes(priceId))     return 'pro';
  return 'free';
}
