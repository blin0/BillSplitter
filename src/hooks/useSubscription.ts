import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SubscriptionState {
  isPro:              boolean;
  subscriptionStatus: string | null;
  priceId:            string | null;
  loading:            boolean;
}

/**
 * Reads the current user's subscription state directly from the `profiles` table.
 * Subscribes to realtime changes so the UI updates immediately after a webhook
 * fires and Supabase updates the row.
 */
export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    isPro:              false,
    subscriptionStatus: null,
    priceId:            null,
    loading:            true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState({ isPro: false, subscriptionStatus: null, priceId: null, loading: false });
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('is_pro, subscription_status, price_id')
        .eq('id', user.id)
        .single();

      if (!cancelled && data) {
        setState({
          isPro:              data.is_pro              ?? false,
          subscriptionStatus: data.subscription_status ?? null,
          priceId:            data.price_id            ?? null,
          loading:            false,
        });
      } else if (!cancelled) {
        setState(s => ({ ...s, loading: false }));
      }

      // Realtime: update UI the moment Stripe webhook fires
      const channel = supabase
        .channel('profile-subscription')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            const r = payload.new as { is_pro: boolean; subscription_status: string | null; price_id: string | null };
            setState({
              isPro:              r.is_pro              ?? false,
              subscriptionStatus: r.subscription_status ?? null,
              priceId:            r.price_id            ?? null,
              loading:            false,
            });
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
