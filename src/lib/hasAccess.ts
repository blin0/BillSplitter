/**
 * Feature-gate utility.
 *
 * Usage:
 *   const { subscriptionTier } = useSubscriptionContext();
 *   if (!hasAccess('unlimited_expenses', subscriptionTier)) { ... }
 */

export type Feature =
  | 'unlimited_expenses'   // tier >= 1
  | 'advanced_analytics'   // tier >= 1
  | 'csv_export'           // tier >= 1
  | 'more_groups'          // tier >= 1  (pro: 8, premier: unlimited)
  | 'more_members'         // tier >= 1  (pro: 12, premier: unlimited)
  | 'unlimited_groups'     // tier >= 2
  | 'unlimited_members'    // tier >= 2
  | 'priority_support';    // tier === 2

export function hasAccess(feature: Feature, tier: 0 | 1 | 2 | 3): boolean {
  if (tier === 3) return true;
  switch (feature) {
    case 'unlimited_expenses':  return tier >= 1;
    case 'advanced_analytics':  return tier >= 1;
    case 'csv_export':          return tier >= 1;
    case 'more_groups':         return tier >= 1;
    case 'more_members':        return tier >= 1;
    case 'unlimited_groups':    return tier >= 2;
    case 'unlimited_members':   return tier >= 2;
    case 'priority_support':    return tier === 2;
    default:                    return false;
  }
}

/** Numeric group limit for a given tier. */
export function groupLimit(tier: 0 | 1 | 2 | 3): number | null {
  if (tier === 0) return 3;
  if (tier === 1) return 8;
  return null; // unlimited
}

/** Numeric member-per-group limit for a given tier. */
export function memberLimit(tier: 0 | 1 | 2 | 3): number | null {
  if (tier === 0) return 4;
  if (tier === 1) return 12;
  return null; // unlimited
}

/** Monthly expense limit per tier. null = unlimited. */
export function expenseLimit(tier: 0 | 1 | 2 | 3): number | null {
  if (tier === 0) return 90;
  return null;
}

/** The display name of the next tier above the given one. */
export function nextTierName(tier: 0 | 1 | 2 | 3): string {
  if (tier === 0) return 'Pro';
  return 'Premier';
}
