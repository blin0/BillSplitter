import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../lib/supabase';
import { fetchExpenseById } from '../lib/db';
import type { Expense, Participant } from '../types';

/**
 * Subscribes to Supabase Realtime changes for the active group so that all
 * group members see each other's adds/deletes/settlements in real time.
 *
 * Handles:
 *   - named_participants  INSERT / DELETE  (filtered by group_id)
 *   - expenses            INSERT / DELETE  (filtered by group_id)
 *   - splits              UPDATE           (settlement sync across members)
 *
 * Deduplication: own mutations are already applied optimistically to local
 * state, so incoming events are skipped when the ID is already present.
 */
export function useGroupSync(
  activeGroupId:   string | null,
  setParticipants: Dispatch<SetStateAction<Participant[]>>,
  setExpenses:     Dispatch<SetStateAction<Expense[]>>,
) {
  useEffect(() => {
    if (!activeGroupId) return;

    const channel = supabase
      .channel(`group-sync:${activeGroupId}`)

      // ── Participants ──────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'named_participants', filter: `group_id=eq.${activeGroupId}` },
        (payload) => {
          const p = payload.new as { id: string; name: string };
          setParticipants(prev =>
            prev.find(x => x.id === p.id) ? prev : [...prev, { id: p.id, name: p.name }]
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'named_participants', filter: `group_id=eq.${activeGroupId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setParticipants(prev => prev.filter(p => p.id !== id));
        },
      )

      // ── Expenses ──────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expenses', filter: `group_id=eq.${activeGroupId}` },
        (payload) => {
          const id = (payload.new as { id?: string }).id;
          if (!id) return;
          // Fetch the full row (with splits) then add if not already present.
          fetchExpenseById(id).then(({ data }) => {
            if (!data) return;
            setExpenses(prev =>
              prev.find(e => e.id === data.id) ? prev : [...prev, data]
            );
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'expenses', filter: `group_id=eq.${activeGroupId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setExpenses(prev => prev.filter(e => e.id !== id));
        },
      )

      // ── Splits (settlements) ──────────────────────────────────────────────
      // No group_id on splits — filter client-side by matching expense_id.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'splits' },
        (payload) => {
          const s = payload.new as {
            expense_id:    string;
            participant_id: string;
            paid_amount:   number;
            is_paid:       boolean;
          };
          setExpenses(prev =>
            prev.map(expense => {
              if (expense.id !== s.expense_id) return expense;
              return {
                ...expense,
                splits: expense.splits.map(split =>
                  split.participantId === s.participant_id
                    ? { ...split, paidAmount: s.paid_amount, isSettled: s.is_paid }
                    : split
                ),
              };
            })
          );
        },
      )

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeGroupId, setParticipants, setExpenses]);
}
