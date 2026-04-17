// ─── Stripe price IDs ─────────────────────────────────────────────────────────
// Re-run product setup if these need updating:
//   Plus Monthly  → https://dashboard.stripe.com/test/prices/price_1TMtU0C9TAB0tHUmM3j9y3hY
//   Lifetime      → https://dashboard.stripe.com/test/prices/price_1TMtrYC9TAB0tHUmEzwElXdA

export const STRIPE_PRICES = {
  /** $4.99 / month — recurring subscription */
  PLUS_MONTHLY: 'price_1TMtU0C9TAB0tHUmM3j9y3hY',
  /** $49.00 — one-time lifetime purchase */
  LIFETIME:     'price_1TMtrYC9TAB0tHUmEzwElXdA',
} as const;

export type StripePriceId = typeof STRIPE_PRICES[keyof typeof STRIPE_PRICES];

/** True if a price ID is a one-time (non-recurring) purchase */
export function isLifetimePrice(priceId: string): boolean {
  return priceId === STRIPE_PRICES.LIFETIME;
}
