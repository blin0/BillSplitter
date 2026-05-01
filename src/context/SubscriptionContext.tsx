import { createContext, useContext, useState, type ReactNode } from 'react';
import { useSubscription, type SubscriptionState } from '../hooks/useSubscription';

export interface SubscriptionContextValue extends SubscriptionState {
  /** The real DB tier — never changes with preview. */
  actualTier: 0 | 1 | 2 | 3;
  /** Which tier a dev is currently simulating; null = full dev access. */
  previewTier: 0 | 1 | 2 | null;
  /** Only meaningful when actualTier === 3. */
  setPreviewTier: (tier: 0 | 1 | 2 | null) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const DEV_PREVIEW_KEY = 'billsplitter_dev_preview_tier';

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const subscription = useSubscription();

  const [previewTier, setPreviewTierState] = useState<0 | 1 | 2 | null>(() => {
    const stored = localStorage.getItem(DEV_PREVIEW_KEY);
    if (stored !== null) {
      const n = parseInt(stored, 10);
      if (n >= 0 && n <= 2) return n as 0 | 1 | 2;
    }
    return null;
  });

  function setPreviewTier(tier: 0 | 1 | 2 | null) {
    setPreviewTierState(tier);
    if (tier === null) localStorage.removeItem(DEV_PREVIEW_KEY);
    else localStorage.setItem(DEV_PREVIEW_KEY, String(tier));
  }

  const actualTier = subscription.subscriptionTier;
  const effectiveTier: 0 | 1 | 2 | 3 =
    actualTier === 3 && previewTier !== null ? previewTier : actualTier;

  const value: SubscriptionContextValue = {
    ...subscription,
    subscriptionTier: effectiveTier,
    actualTier,
    previewTier,
    setPreviewTier,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscriptionContext must be used inside <SubscriptionProvider>');
  return ctx;
}
