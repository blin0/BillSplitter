/**
 * db.ts — Supabase service layer for BillSplitter
 *
 * All functions return { data, error } pairs.
 * Mapping between frontend types (src/types.ts) and DB rows lives here.
 */

import { supabase } from './supabase';
import type { Expense, Participant, Split } from '../types';
import type { Json } from '../types/supabase';

// ─── Shared result wrapper ────────────────────────────────────────────────────

interface DbResult<T> {
  data:  T | null;
  error: string | null;
}

/** Shape stored in expenses.metadata */
interface ExpenseMetadata {
  sourceAmount:         number;
  sourceCurrency:       string;
  lockedRate:           number;
  splitType:            'equally' | 'exact';
  involvedParticipants: string[];
  taxPercent?:          number;
  tipSourceAmount?:     number;
}

// ─── Group info (used by sidebar / group list) ────────────────────────────────

export interface GroupInfo {
  id:       string;
  name:     string;
  joinCode: string;
  role:     'admin' | 'editor' | 'viewer';
}

export interface GroupMemberInfo {
  userId:   string;
  role:     'admin' | 'editor' | 'viewer';
  fullName: string | null;
  email:    string | null;
}

// ─── Groups ───────────────────────────────────────────────────────────────────

/** Fetch all groups the current user belongs to. */
export async function fetchUserGroups(): Promise<DbResult<GroupInfo[]>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  const { data, error } = await supabase
    .from('members')
    .select('role, groups(id, name, join_code)')
    .eq('user_id', user.id);

  if (error) return { data: null, error: error.message };

  const ROLE_RANK: Record<string, number> = { admin: 3, editor: 2, viewer: 1 };

  // Deduplicate by group ID, keeping the highest-privilege role row.
  const seen = new Map<string, GroupInfo>();
  for (const row of data ?? []) {
    if (!row.groups) continue;
    const g = row.groups as { id: string; name: string; join_code: string };
    const role = row.role as 'admin' | 'editor' | 'viewer';
    const existing = seen.get(g.id);
    if (!existing || (ROLE_RANK[role] ?? 0) > (ROLE_RANK[existing.role] ?? 0)) {
      seen.set(g.id, { id: g.id, name: g.name, joinCode: g.join_code, role });
    }
  }

  return { data: Array.from(seen.values()), error: null };
}

/** Create a new group; the DB trigger adds the caller as 'admin'. */
export async function createGroup(name: string): Promise<DbResult<GroupInfo>> {
  const { data, error } = await supabase
    .rpc('create_group', { p_name: name });

  if (error) return { data: null, error: error.message };

  const row = (data as { id: string; name: string; join_code: string }[])[0];
  if (!row) return { data: null, error: 'No data returned from create_group' };

  return {
    data: {
      id:       row.id,
      name:     row.name,
      joinCode: row.join_code,
      role:     'admin',
    },
    error: null,
  };
}

/** Admin-only: rename a group. */
export async function updateGroupName(groupId: string, name: string): Promise<DbResult<void>> {
  const { error } = await supabase
    .from('groups')
    .update({ name })
    .eq('id', groupId);
  return { data: null, error: error?.message ?? null };
}

/** Join a group by its 6-char code; returns the group info. */
export async function joinGroupByCode(code: string): Promise<DbResult<GroupInfo>> {
  const { data: groupId, error } = await supabase
    .rpc('join_group_by_code', { code });

  if (error) {
    const msg = error.message.includes('invalid_code')
      ? 'No group found with that code. Check for typos.'
      : error.message;
    return { data: null, error: msg };
  }

  // Fetch group details + the caller's actual role — must filter by user_id too,
  // otherwise .single() fails when multiple members are in the same group.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const { data: memberRow, error: mErr } = await supabase
    .from('members')
    .select('role, groups(id, name, join_code)')
    .eq('group_id', groupId as string)
    .eq('user_id', user.id)
    .single();

  if (mErr) return { data: null, error: mErr.message };

  const g = memberRow.groups as { id: string; name: string; join_code: string };
  return {
    data: {
      id:       g.id,
      name:     g.name,
      joinCode: g.join_code,
      role:     memberRow.role as 'admin' | 'editor' | 'viewer',
    },
    error: null,
  };
}

/** Fetch all members of a group with their profile info — admin only in practice. */
export async function fetchGroupMembers(groupId: string): Promise<DbResult<GroupMemberInfo[]>> {
  // Fetch member rows first
  const { data: memberRows, error } = await supabase
    .from('members')
    .select('role, user_id')
    .eq('group_id', groupId);

  if (error) return { data: null, error: error.message };

  const userIds = (memberRows ?? []).map(r => r.user_id);

  // Fetch profiles separately (no FK on members → profiles in PostgREST schema cache)
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  const profileMap = new Map<string, string | null>(
    (profileRows ?? []).map(p => [p.id, p.full_name])
  );

  const members: GroupMemberInfo[] = (memberRows ?? []).map(row => ({
    userId:   row.user_id,
    role:     row.role as 'admin' | 'editor' | 'viewer',
    fullName: profileMap.get(row.user_id) ?? null,
    email:    null,
  }));

  return { data: members, error: null };
}

/** Admin-only: remove a member from a group. */
export async function removeMember(
  groupId:      string,
  targetUserId: string,
): Promise<DbResult<void>> {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetUserId);
  return { data: null, error: error?.message ?? null };
}

/** Admin-only: change a member's role in a group. */
export async function updateMemberRole(
  groupId:      string,
  targetUserId: string,
  newRole:      'admin' | 'editor' | 'viewer',
): Promise<DbResult<void>> {
  const { error } = await supabase.rpc('update_member_role', {
    p_group_id:        groupId,
    p_target_user_id:  targetUserId,
    p_new_role:        newRole,
  });
  return { data: null, error: error?.message ?? null };
}

// ─── Named participants ───────────────────────────────────────────────────────

export async function fetchParticipants(groupId: string): Promise<DbResult<Participant[]>> {
  const { data, error } = await supabase
    .from('named_participants')
    .select('id, name')
    .eq('group_id', groupId)
    .order('created_at');

  if (error) return { data: null, error: error.message };

  return {
    data: (data ?? []).map(row => ({ id: row.id, name: row.name })),
    error: null,
  };
}

export async function insertParticipant(
  groupId: string,
  name: string,
): Promise<DbResult<Participant>> {
  const { data, error } = await supabase
    .from('named_participants')
    .insert({ group_id: groupId, name })
    .select('id, name')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: { id: data.id, name: data.name }, error: null };
}

export async function deleteParticipant(participantId: string): Promise<DbResult<void>> {
  const { error } = await supabase
    .from('named_participants')
    .delete()
    .eq('id', participantId);

  return { data: null, error: error?.message ?? null };
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function fetchExpenses(groupId: string): Promise<DbResult<Expense[]>> {
  const { data: rows, error } = await supabase
    .from('expenses')
    .select(`
      id,
      description,
      total_amount,
      payer_participant_id,
      metadata,
      created_at,
      splits ( id, participant_id, amount_owed, paid_amount, is_paid )
    `)
    .eq('group_id', groupId)
    .order('created_at');

  if (error) return { data: null, error: error.message };

  const expenses: Expense[] = (rows ?? []).map(row => {
    const meta = (row.metadata ?? {}) as Partial<ExpenseMetadata>;

    type SplitRow = { id: string; participant_id: string | null; amount_owed: number; paid_amount: number; is_paid: boolean | null };
    const splits: Split[] = ((row.splits as unknown as SplitRow[]) ?? []).map(s => ({
      participantId: s.participant_id ?? '',
      share:         Number(s.amount_owed),
      paidAmount:    Number(s.paid_amount ?? 0),
      isSettled:     s.is_paid ?? false,
    }));

    return {
      id:                   row.id,
      description:          row.description,
      totalAmount:          Number(row.total_amount),
      sourceAmount:         meta.sourceAmount         ?? Number(row.total_amount),
      sourceCurrency:       meta.sourceCurrency        ?? 'USD',
      lockedRate:           meta.lockedRate            ?? 1,
      paidBy:               row.payer_participant_id  ?? '',
      splitType:            meta.splitType             ?? 'equally',
      involvedParticipants: meta.involvedParticipants  ?? splits.map(s => s.participantId),
      splits,
      isHighlighted:        false,
      taxPercent:           meta.taxPercent,
      tipSourceAmount:      meta.tipSourceAmount,
    };
  });

  return { data: expenses, error: null };
}

export async function insertExpense(
  groupId: string,
  expense: Expense,
): Promise<DbResult<string>> {
  const metadata: ExpenseMetadata = {
    sourceAmount:         expense.sourceAmount,
    sourceCurrency:       expense.sourceCurrency,
    lockedRate:           expense.lockedRate,
    splitType:            expense.splitType,
    involvedParticipants: expense.involvedParticipants,
    taxPercent:           expense.taxPercent,
    tipSourceAmount:      expense.tipSourceAmount,
  };

  const splits = expense.splits.map(s => ({
    participant_id: s.participantId,
    amount_owed:    s.share,
  }));

  const { data, error } = await supabase.rpc('add_expense_with_splits', {
    p_group_id:             groupId,
    p_description:          expense.description,
    p_total_amount:         expense.totalAmount,
    p_payer_participant_id: expense.paidBy,
    p_splits:               splits as unknown as Json,
    p_metadata:             metadata as unknown as Json,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as string, error: null };
}

/** Fetch a single expense with its splits — used by Realtime INSERT handlers. */
export async function fetchExpenseById(expenseId: string): Promise<DbResult<Expense>> {
  const { data: row, error } = await supabase
    .from('expenses')
    .select(`
      id, description, total_amount, payer_participant_id, metadata, created_at,
      splits ( id, participant_id, amount_owed, paid_amount, is_paid )
    `)
    .eq('id', expenseId)
    .single();

  if (error) return { data: null, error: error.message };

  const meta = (row.metadata ?? {}) as Partial<ExpenseMetadata>;
  type SplitRow = { id: string; participant_id: string | null; amount_owed: number; paid_amount: number; is_paid: boolean | null };
  const splits: Split[] = ((row.splits as unknown as SplitRow[]) ?? []).map(s => ({
    participantId: s.participant_id ?? '',
    share:         Number(s.amount_owed),
    paidAmount:    Number(s.paid_amount ?? 0),
    isSettled:     s.is_paid ?? false,
  }));

  return {
    data: {
      id:                   row.id,
      description:          row.description,
      totalAmount:          Number(row.total_amount),
      sourceAmount:         meta.sourceAmount         ?? Number(row.total_amount),
      sourceCurrency:       meta.sourceCurrency        ?? 'USD',
      lockedRate:           meta.lockedRate            ?? 1,
      paidBy:               row.payer_participant_id  ?? '',
      splitType:            meta.splitType             ?? 'equally',
      involvedParticipants: meta.involvedParticipants  ?? splits.map(s => s.participantId),
      splits,
      isHighlighted:        false,
      taxPercent:           meta.taxPercent,
      tipSourceAmount:      meta.tipSourceAmount,
    },
    error: null,
  };
}

export async function deleteExpense(expenseId: string): Promise<DbResult<void>> {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId);

  return { data: null, error: error?.message ?? null };
}

// ─── Splits ───────────────────────────────────────────────────────────────────

/** Sync paid_amount / is_paid changes for an expense's splits back to the DB. */
export async function syncSplitsForExpense(
  expenseId: string,
  splits: Split[],
): Promise<DbResult<void>> {
  const { data: dbSplits, error: fetchErr } = await supabase
    .from('splits')
    .select('id, participant_id')
    .eq('expense_id', expenseId);

  if (fetchErr) return { data: null, error: fetchErr.message };

  const idMap = new Map<string, string>(
    (dbSplits ?? []).map(s => [s.participant_id ?? '', s.id]),
  );

  const toUpdate = splits.filter(s => idMap.has(s.participantId));
  if (toUpdate.length === 0) return { data: null, error: null };

  const results = await Promise.all(
    toUpdate.map(s =>
      supabase
        .from('splits')
        .update({ paid_amount: s.paidAmount, is_paid: s.isSettled })
        .eq('id', idMap.get(s.participantId)!)
    )
  );

  const firstError = results.find(r => r.error)?.error;
  return { data: null, error: firstError?.message ?? null };
}
