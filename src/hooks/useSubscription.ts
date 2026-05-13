import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SubscriptionState {
  /** 0 = Free, 1 = Pro, 2 = Premier, 3 = Developer/Internal */
  subscriptionTier:   0 | 1 | 2 | 3;
  subscriptionStatus: string | null;
  priceId:            string | null;
  /** True when subscription is scheduled to cancel at period end. */
  cancelAtPeriodEnd:  boolean;
  /** ISO timestamp of when the current billing period ends. */
  currentPeriodEnd:   string | null;
  /** Derived convenience — true when tier >= 1. */
  isPro:              boolean;
  loading:            boolean;
}

/**
 * Reads subscription state from `profiles` and subscribes to real-time
 * postgres_changes so the UI updates the instant a Stripe webhook fires
 * or the row is edited directly in the Supabase Table Editor.
 *
 * Prefer consuming via SubscriptionContext rather than calling this hook
 * directly — the context calls it once at the root and fans the result out.
 */
export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    subscriptionTier:   0,
    subscriptionStatus: null,
    priceId:            null,
    cancelAtPeriodEnd:  false,
    currentPeriodEnd:   null,
    isPro:              false,
    loading:            true,
  });

  useEffect(() => {
    let cancelled = false;
    const channelName = `profile-sub-${Math.random().toString(36).slice(2)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    function applyRow(r: {
      subscription_tier:   number | null;
      subscription_status: string | null;
      price_id:            string | null;
      cancel_at_period_end?: boolean | null;
      current_period_end?:   string | null;
    }) {
      const tier = (Math.min(Math.max(r.subscription_tier ?? 0, 0), 3)) as 0 | 1 | 2 | 3;
      setState({
        subscriptionTier:   tier,
        subscriptionStatus: r.subscription_status   ?? null,
        priceId:            r.price_id              ?? null,
        cancelAtPeriodEnd:  r.cancel_at_period_end  ?? false,
        currentPeriodEnd:   r.current_period_end    ?? null,
        isPro:              tier >= 1,
        loading:            false,
      });
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setState({ subscriptionTier: 0, subscriptionStatus: null, priceId: null, cancelAtPeriodEnd: false, currentPeriodEnd: null, isPro: false, loading: false });
        return;
      }

      const result = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, price_id, cancel_at_period_end, current_period_end')
        .eq('id', user.id)
        .single();
      const data = result.data as {
        subscription_tier:   number | null;
        subscription_status: string | null;
        price_id:            string | null;
        cancel_at_period_end?: boolean | null;
        current_period_end?:   string | null;
      } | null;

      if (cancelled) return;
      if (data) applyRow(data);
      else setState(s => ({ ...s, loading: false }));
      if (cancelled) return;

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            if (!cancelled) applyRow(payload.new as {
              subscription_tier:   number | null;
              subscription_status: string | null;
              price_id:            string | null;
              cancel_at_period_end?: boolean | null;
              current_period_end?:   string | null;
            });
          },
        )
        .subscribe();
    }

    load();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
