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
    // Unique name per effect invocation so StrictMode's double-mount never hits
    // the "already subscribed" error on the same channel name.
    const channelName = `profile-subscription-${Math.random().toString(36).slice(2)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setState({ isPro: false, subscriptionStatus: null, priceId: null, loading: false });
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('is_pro, subscription_status, price_id')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      if (data) {
        setState({
          isPro:              data.is_pro              ?? false,
          subscriptionStatus: data.subscription_status ?? null,
          priceId:            data.price_id            ?? null,
          loading:            false,
        });
      } else {
        setState(s => ({ ...s, loading: false }));
      }

      if (cancelled) return;

      // Realtime: update UI the moment Stripe webhook fires.
      // Assigned to the outer `channel` ref so the effect cleanup can remove it.
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            if (cancelled) return;
            const r = payload.new as { is_pro: boolean; subscription_status: string | null; price_id: string | null };
            setState({
              isPro:              r.is_pro              ?? false,
              subscriptionStatus: r.subscription_status ?? null,
              priceId:            r.price_id            ?? null,
              loading:            false,
            });
          },
        )
        .subscribe();
    }

    load();

    // This is the cleanup React actually uses — it runs on unmount and on
    // StrictMode's synthetic unmount, so the channel is always removed.
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
