/**
 * db.ts — Supabase service layer for Axiom Splits
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
  id:             string;
  name:           string;
  joinCode:       string;
  role:           'admin' | 'editor' | 'viewer';
  defaultTaxRate: number | null;
}

export interface GroupMemberInfo {
  userId:   string;
  role:     'admin' | 'editor' | 'viewer';
  fullName: string | null;
  email:    string | null;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface OwnProfile {
  id:                 string;
  fullName:           string | null;
  avatarUrl:          string | null;
  venmoHandle:        string | null;
  cashappHandle:      string | null;
  zelleHandle:        string | null;
  defaultCurrency:    string;
  defaultTaxRate:     number;
  showEmail:          boolean;
  showActivity:       boolean;
  languagePreference: string | null;
  // Stripe / subscription
  stripeCustomerId:   string | null;
  subscriptionStatus: string | null;
  isPro:              boolean;
  priceId:            string | null;
}

export interface MemberProfile {
  userId:        string;
  fullName:      string | null;
  avatarUrl:     string | null;
  venmoHandle:   string | null;
  cashappHandle: string | null;
  zelleHandle:   string | null;
}

export async function fetchOwnProfile(): Promise<DbResult<OwnProfile>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, venmo_handle, cashapp_handle, zelle_handle, default_currency, default_tax_rate, show_email, show_activity, language_preference, stripe_customer_id, subscription_status, is_pro, price_id')
    .eq('id', user.id)
    .single();

  if (error) return { data: null, error: error.message };

  return {
    data: {
      id:                 data.id,
      fullName:           data.full_name,
      avatarUrl:          data.avatar_url,
      venmoHandle:        data.venmo_handle,
      cashappHandle:      data.cashapp_handle,
      zelleHandle:        data.zelle_handle ?? null,
      defaultCurrency:    data.default_currency ?? 'USD',
      defaultTaxRate:     Number(data.default_tax_rate ?? 0),
      showEmail:          data.show_email  ?? true,
      showActivity:       data.show_activity ?? true,
      languagePreference: data.language_preference ?? null,
      stripeCustomerId:   data.stripe_customer_id ?? null,
      subscriptionStatus: data.subscription_status ?? null,
      isPro:              data.is_pro ?? false,
      priceId:            data.price_id ?? null,
    },
    error: null,
  };
}

export async function updateOwnProfile(updates: {
  fullName?:            string | null;
  avatarUrl?:           string | null;
  venmoHandle?:         string | null;
  cashappHandle?:       string | null;
  zelleHandle?:         string | null;
  defaultCurrency?:     string;
  defaultTaxRate?:      number;
  showEmail?:           boolean;
  showActivity?:        boolean;
  languagePreference?:  string | null;
}): Promise<DbResult<void>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const { error } = await supabase
    .from('profiles')
    .update({
      ...(updates.fullName        !== undefined && { full_name:        updates.fullName        }),
      ...(updates.avatarUrl       !== undefined && { avatar_url:       updates.avatarUrl       }),
      ...(updates.venmoHandle     !== undefined && { venmo_handle:     updates.venmoHandle     }),
      ...(updates.cashappHandle   !== undefined && { cashapp_handle:   updates.cashappHandle   }),
      ...(updates.zelleHandle     !== undefined && { zelle_handle:     updates.zelleHandle     }),
      ...(updates.defaultCurrency !== undefined && { default_currency: updates.defaultCurrency }),
      ...(updates.defaultTaxRate  !== undefined && { default_tax_rate: updates.defaultTaxRate  }),
      ...(updates.showEmail            !== undefined && { show_email:           updates.showEmail            }),
      ...(updates.showActivity         !== undefined && { show_activity:        updates.showActivity         }),
      ...(updates.languagePreference   !== undefined && { language_preference:  updates.languagePreference   }),
    })
    .eq('id', user.id);

  return { data: null, error: error?.message ?? null };
}

/**
 * Fetch profiles for all *invited* (authenticated) members of a group.
 * Only returns rows from the `members` table joined with `profiles` —
 * ghost participants added via named_participants are never included.
 * Used by SettleModal's Smart Settle section.
 */
export async function fetchInvitedMemberProfiles(groupId: string): Promise<DbResult<MemberProfile[]>> {
  const { data: memberRows, error } = await supabase
    .from('members')
    .select('user_id')
    .eq('group_id', groupId);

  if (error) return { data: null, error: error.message };

  const userIds = (memberRows ?? []).map(r => r.user_id);
  if (userIds.length === 0) return { data: [], error: null };

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, venmo_handle, cashapp_handle, zelle_handle')
    .in('id', userIds);

  if (pErr) return { data: null, error: pErr.message };

  return {
    data: (profiles ?? []).map(p => ({
      userId:        p.id,
      fullName:      p.full_name,
      avatarUrl:     p.avatar_url ?? null,
      venmoHandle:   p.venmo_handle,
      cashappHandle: p.cashapp_handle,
      zelleHandle:   p.zelle_handle ?? null,
    })),
    error: null,
  };
}

export interface OwnStats {
  groupCount:   number;
  expenseCount: number;
}

// ─── Stripe / subscription ────────────────────────────────────────────────────

/** Kick off a Stripe Checkout session. Returns the redirect URL. */
export async function createCheckoutSession(priceId: string): Promise<DbResult<string>> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { price_id: priceId },
  });

  if (error) return { data: null, error: error.message ?? 'Checkout failed' };
  if (!data?.url) return { data: null, error: 'No checkout URL returned' };

  return { data: data.url as string, error: null };
}

/** Count how many groups the current user owns (role = admin). Used for free-tier gate. */
export async function fetchOwnGroupCount(): Promise<DbResult<number>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: 0, error: null };

  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'admin');

  return { data: count ?? 0, error: error?.message ?? null };
}

/** Count authenticated members in a group. Used for member-limit gate. */
export async function fetchGroupMemberCount(groupId: string): Promise<DbResult<number>> {
  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId);
  return { data: count ?? 0, error: error?.message ?? null };
}

/** Permanently delete the current user's auth account and all their data. */
export async function deleteOwnAccount(): Promise<DbResult<void>> {
  const { error } = await supabase.rpc('delete_own_account');
  return { data: null, error: error?.message ?? null };
}

/** Fetch profile-page stats for the current user. */
export async function fetchOwnStats(): Promise<DbResult<OwnStats>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: { groupCount: 0, expenseCount: 0 }, error: null };

  const [groupRes, expenseRes] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('actor_id', user.id)
      .eq('action_type', 'EXPENSE_ADDED'),
  ]);

  return {
    data: {
      groupCount:   groupRes.count   ?? 0,
      expenseCount: expenseRes.count ?? 0,
    },
    error: groupRes.error?.message ?? expenseRes.error?.message ?? null,
  };
}

// ─── Groups ───────────────────────────────────────────────────────────────────

/** Fetch all groups the current user belongs to. */
export async function fetchUserGroups(): Promise<DbResult<GroupInfo[]>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  const { data, error } = await supabase
    .from('members')
    .select('role, groups(id, name, join_code, default_tax_rate)')
    .eq('user_id', user.id);

  if (error) return { data: null, error: error.message };

  const ROLE_RANK: Record<string, number> = { admin: 3, editor: 2, viewer: 1 };

  // Deduplicate by group ID, keeping the highest-privilege role row.
  const seen = new Map<string, GroupInfo>();
  for (const row of data ?? []) {
    if (!row.groups) continue;
    const g = row.groups as { id: string; name: string; join_code: string; default_tax_rate: number | null };
    const role = row.role as 'admin' | 'editor' | 'viewer';
    const existing = seen.get(g.id);
    if (!existing || (ROLE_RANK[role] ?? 0) > (ROLE_RANK[existing.role] ?? 0)) {
      seen.set(g.id, { id: g.id, name: g.name, joinCode: g.join_code, role, defaultTaxRate: g.default_tax_rate ?? null });
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
      id:             row.id,
      name:           row.name,
      joinCode:       row.join_code,
      role:           'admin',
      defaultTaxRate: null,
    },
    error: null,
  };
}

/**
 * Leave a group. Throws a user-readable error if the caller is the sole admin.
 * The user's name stays on all historical expenses so the math remains intact.
 */
export async function leaveGroup(groupId: string): Promise<DbResult<void>> {
  const { error } = await supabase.rpc('leave_group', { p_group_id: groupId });
  if (error) {
    const msg = error.message.includes('sole_admin')
      ? 'You are the only admin. Transfer ownership to another member before leaving.'
      : error.message.includes('not_a_member')
      ? 'You are not a member of this group.'
      : error.message;
    return { data: null, error: msg };
  }
  return { data: null, error: null };
}

/**
 * Admin-only hard delete. Permanently removes all group data for every member.
 */
export async function deleteGroupPermanently(groupId: string): Promise<DbResult<void>> {
  const { error } = await supabase.rpc('delete_group_permanently', { p_group_id: groupId });
  if (error) {
    const msg = error.message.includes('not_admin')
      ? 'Only admins can delete a group.'
      : error.message;
    return { data: null, error: msg };
  }
  return { data: null, error: null };
}

/** Admin-only: rename a group. */
export async function updateGroupName(groupId: string, name: string): Promise<DbResult<void>> {
  const { error } = await supabase
    .from('groups')
    .update({ name })
    .eq('id', groupId);
  return { data: null, error: error?.message ?? null };
}

/** Admin-only: update a group's default tax rate. Pass null to clear. */
export async function updateGroupTaxRate(groupId: string, rate: number | null): Promise<DbResult<void>> {
  const { error } = await supabase
    .from('groups')
    .update({ default_tax_rate: rate })
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
    .select('role, groups(id, name, join_code, default_tax_rate)')
    .eq('group_id', groupId as string)
    .eq('user_id', user.id)
    .single();

  if (mErr) return { data: null, error: mErr.message };

  const g = memberRow.groups as { id: string; name: string; join_code: string; default_tax_rate: number | null };
  return {
    data: {
      id:             g.id,
      name:           g.name,
      joinCode:       g.join_code,
      role:           memberRow.role as 'admin' | 'editor' | 'viewer',
      defaultTaxRate: g.default_tax_rate ?? null,
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
    const meta  = (row.metadata ?? {}) as Partial<ExpenseMetadata>;
    const payer = row.payer_participant_id ?? '';

    type SplitRow = { id: string; participant_id: string | null; amount_owed: number; paid_amount: number; is_paid: boolean | null };
    const splits: Split[] = ((row.splits as unknown as SplitRow[]) ?? []).map(s => {
      const isPayer = (s.participant_id ?? '') === payer;
      return {
        participantId: s.participant_id ?? '',
        share:         Number(s.amount_owed),
        // Payer's own share is always settled — they funded the full bill upfront.
        paidAmount:    isPayer ? Number(s.amount_owed) : Number(s.paid_amount ?? 0),
        isSettled:     isPayer ? true                  : (s.is_paid ?? false),
      };
    });

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
      date:                 row.created_at as string | undefined,
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

  const meta  = (row.metadata ?? {}) as Partial<ExpenseMetadata>;
  const payer = row.payer_participant_id ?? '';
  type SplitRow = { id: string; participant_id: string | null; amount_owed: number; paid_amount: number; is_paid: boolean | null };
  const splits: Split[] = ((row.splits as unknown as SplitRow[]) ?? []).map(s => {
    const isPayer = (s.participant_id ?? '') === payer;
    return {
      participantId: s.participant_id ?? '',
      share:         Number(s.amount_owed),
      paidAmount:    isPayer ? Number(s.amount_owed) : Number(s.paid_amount ?? 0),
      isSettled:     isPayer ? true                  : (s.is_paid ?? false),
    };
  });

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

// ─── Activity log ─────────────────────────────────────────────────────────────

export type ActivityActionType = 'EXPENSE_ADDED' | 'EXPENSE_DELETED' | 'SETTLEMENT_MADE';

export interface ActivityProfile {
  id:        string;
  fullName:  string | null;
  avatarUrl: string | null;
}

export interface ActivityEntry {
  id:              string;
  actionType:      ActivityActionType | null;
  /** For expenses: the description text. For settlements: omitted. */
  message:         string;
  actorId:         string | null;
  targetId:        string | null;
  expenseId:       string | null;
  participantId:   string | null;
  /** Named participant (payer for expenses, debtor for settlements) */
  participantName: string | null;
  amount:          number | null;
  /** null = n/a (e.g. settlement), true = all splits settled, false = unsettled */
  isSettled:       boolean | null;
  createdAt:       string;
  actorProfile?:   ActivityProfile | null;
  targetProfile?:  ActivityProfile | null;
}

export interface LogActivityParams {
  groupId:        string;
  /** For expenses, store the expense description. For settlements, a short verb phrase. */
  message:        string;
  actionType:     ActivityActionType;
  expenseId?:     string | null;
  targetId?:      string | null;
  amount?:        number | null;
  participantId?: string | null;
  isSettled?:     boolean | null;
}

export async function fetchActivityLogs(groupId: string): Promise<DbResult<ActivityEntry[]>> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, actor_id, target_id, expense_id, amount, action_type, message, created_at, participant_id, is_settled')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return { data: null, error: error.message };

  const rows = data ?? [];

  // Batch-fetch auth profiles for actor/target
  const profileIds = [...new Set(
    rows.flatMap(r => [r.actor_id, r.target_id]).filter((id): id is string => !!id)
  )];
  const profileMap = new Map<string, ActivityProfile>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', profileIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { id: p.id, fullName: p.full_name, avatarUrl: p.avatar_url });
    }
  }

  // Batch-fetch named participant names
  const participantIds = [...new Set(
    rows.map(r => r.participant_id).filter((id): id is string => !!id)
  )];
  const participantNameMap = new Map<string, string>();
  if (participantIds.length > 0) {
    const { data: parts } = await supabase
      .from('named_participants')
      .select('id, name')
      .in('id', participantIds);
    for (const p of parts ?? []) {
      participantNameMap.set(p.id, p.name);
    }
  }

  return {
    data: rows.map(row => ({
      id:              row.id,
      actionType:      (row.action_type as ActivityActionType | null) ?? null,
      message:         row.message,
      actorId:         row.actor_id,
      targetId:        row.target_id,
      expenseId:       row.expense_id,
      participantId:   row.participant_id,
      participantName: row.participant_id ? (participantNameMap.get(row.participant_id) ?? null) : null,
      amount:          row.amount != null ? Number(row.amount) : null,
      isSettled:       row.is_settled ?? null,
      createdAt:       row.created_at,
      actorProfile:    row.actor_id  ? (profileMap.get(row.actor_id)  ?? null) : null,
      targetProfile:   row.target_id ? (profileMap.get(row.target_id) ?? null) : null,
    })),
    error: null,
  };
}

/** Fire-and-forget; errors are intentionally swallowed so they never break the primary action. */
export async function logActivity(params: LogActivityParams): Promise<void> {
  await supabase.rpc('log_activity', {
    p_group_id:       params.groupId,
    p_message:        params.message,
    p_action_type:    params.actionType,
    p_expense_id:     params.expenseId     ?? null,
    p_target_id:      params.targetId      ?? null,
    p_amount:         params.amount        ?? null,
    p_participant_id: params.participantId ?? null,
    p_is_settled:     params.isSettled     ?? null,
  });
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

// ─── User–member identity links ───────────────────────────────────────────────

/**
 * Returns the named_participant id that the current user has claimed as "me"
 * in the given group, or null if no link exists yet.
 */
export async function fetchMemberLink(groupId: string): Promise<DbResult<string | null>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('user_member_links')
    .select('member_id')
    .eq('user_id', user.id)
    .eq('group_id', groupId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: (data as { member_id: string } | null)?.member_id ?? null, error: null };
}

/**
 * Upsert: link the current user to a named_participant in a group.
 * Replaces any existing link (unique constraint on user_id + group_id).
 */
export async function setMemberLink(groupId: string, memberId: string): Promise<DbResult<void>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_member_links')
    .upsert(
      { user_id: user.id, group_id: groupId, member_id: memberId },
      { onConflict: 'user_id,group_id' },
    );

  return { data: null, error: error?.message ?? null };
}

/** Remove the current user's identity link for a group (unlinking). */
export async function deleteMemberLink(groupId: string): Promise<DbResult<void>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_member_links')
    .delete()
    .eq('user_id', user.id)
    .eq('group_id', groupId);

  return { data: null, error: error?.message ?? null };
}

/**
 * Fetch all expenses across all groups where the current user's linked member
 * appears in the splits. Used by the personal analytics view.
 */
export interface PersonalExpense {
  groupId:     string;
  groupName:   string;
  memberId:    string;
  memberName:  string;
  expense:     Expense;
}

export interface PersonalData {
  items:            PersonalExpense[];
  /** Maps named_participant.id → name for every participant in all linked groups. */
  participantNames: Record<string, string>;
}

export async function fetchPersonalExpenses(): Promise<DbResult<PersonalData>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: { items: [], participantNames: {} }, error: null };

  // Fetch all links for the current user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLinks, error: linksErr } = await (supabase as any)
    .from('user_member_links')
    .select('group_id, member_id')
    .eq('user_id', user.id);

  if (linksErr) return { data: null, error: linksErr.message };
  const links = (rawLinks ?? []) as { group_id: string; member_id: string }[];
  if (links.length === 0) return { data: { items: [], participantNames: {} }, error: null };

  const groupIds  = links.map(l => l.group_id);
  const memberIds = links.map(l => l.member_id);

  // Fetch group names
  const { data: groupRows, error: groupErr } = await supabase
    .from('groups')
    .select('id, name')
    .in('id', groupIds);
  if (groupErr) return { data: null, error: groupErr.message };
  const groupNameMap = new Map((groupRows ?? []).map(g => [g.id, g.name]));

  // Fetch ALL named_participants for all linked groups (needed for debt-flow peer name resolution)
  const { data: memberRows, error: memberErr } = await supabase
    .from('named_participants')
    .select('id, name, group_id')
    .in('group_id', groupIds);
  if (memberErr) return { data: null, error: memberErr.message };

  // participantNames: id → name (across all linked groups, used in the UI)
  const participantNames: Record<string, string> = {};
  for (const m of memberRows ?? []) participantNames[m.id] = m.name;

  // memberNameMap: only the "me" participants (subset of participantNames)
  const memberNameMap = new Map(
    (memberRows ?? []).filter(m => memberIds.includes(m.id)).map(m => [m.id, m.name])
  );

  // Build link lookup: group_id → member_id
  const linkMap = new Map(links.map(l => [l.group_id, l.member_id]));

  // Fetch all expenses for those groups, then filter to those involving the linked member
  const results: PersonalExpense[] = [];
  for (const groupId of groupIds) {
    const memberId = linkMap.get(groupId)!;
    const { data: expRows, error: expErr } = await supabase
      .from('expenses')
      .select(`
        id, description, total_amount, payer_participant_id, metadata, created_at,
        splits ( id, participant_id, amount_owed, paid_amount, is_paid )
      `)
      .eq('group_id', groupId)
      .order('created_at');

    if (expErr) continue;

    type SplitRow = { id: string; participant_id: string | null; amount_owed: number; paid_amount: number; is_paid: boolean | null };
    for (const row of expRows ?? []) {
      const meta = (row.metadata ?? {}) as Partial<ExpenseMetadata>;
      const payer = row.payer_participant_id ?? '';
      const rawSplits = (row.splits as unknown as SplitRow[]) ?? [];

      // Only include expenses where the linked member has a split
      if (!rawSplits.some(s => s.participant_id === memberId)) continue;

      const splits: Split[] = rawSplits.map(s => {
        const isPayer = (s.participant_id ?? '') === payer;
        return {
          participantId: s.participant_id ?? '',
          share:         Number(s.amount_owed),
          paidAmount:    isPayer ? Number(s.amount_owed) : Number(s.paid_amount ?? 0),
          isSettled:     isPayer ? true                  : (s.is_paid ?? false),
        };
      });

      results.push({
        groupId,
        groupName:  groupNameMap.get(groupId)  ?? groupId,
        memberId,
        memberName: memberNameMap.get(memberId) ?? memberId,
        expense: {
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
          date:                 row.created_at as string | undefined,
        },
      });
    }
  }

  return { data: { items: results, participantNames }, error: null };
}

/**
 * Fetch personal expenses for a single calendar month, bounded by local-timezone
 * midnight so the calendar keys (derived from getDate/getMonth) stay consistent
 * with what the user sees in their timezone.
 */
export async function fetchPersonalCalendarMonth(year: number, month: number): Promise<DbResult<PersonalExpense[]>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  // Local-timezone month boundaries → converted to UTC for the Supabase filter
  const startUtc = new Date(year, month, 1).toISOString();
  const endUtc   = new Date(year, month + 1, 1).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLinks, error: linksErr } = await (supabase as any)
    .from('user_member_links')
    .select('group_id, member_id')
    .eq('user_id', user.id);

  if (linksErr) return { data: null, error: linksErr.message };
  const links = (rawLinks ?? []) as { group_id: string; member_id: string }[];
  if (links.length === 0) return { data: [], error: null };

  const groupIds  = links.map(l => l.group_id);
  const memberIds = links.map(l => l.member_id);
  const linkMap   = new Map(links.map(l => [l.group_id, l.member_id]));

  const { data: groupRows } = await supabase.from('groups').select('id, name').in('id', groupIds);
  const groupNameMap = new Map((groupRows ?? []).map(g => [g.id, g.name]));

  const { data: memberRows } = await supabase
    .from('named_participants').select('id, name').in('id', memberIds);
  const memberNameMap = new Map((memberRows ?? []).map(m => [m.id, m.name]));

  const results: PersonalExpense[] = [];

  for (const groupId of groupIds) {
    const memberId = linkMap.get(groupId)!;
    const { data: expRows, error: expErr } = await supabase
      .from('expenses')
      .select(`
        id, description, total_amount, payer_participant_id, metadata, created_at,
        splits ( id, participant_id, amount_owed, paid_amount, is_paid )
      `)
      .eq('group_id', groupId)
      .gte('created_at', startUtc)
      .lt('created_at', endUtc)
      .order('created_at');

    if (expErr) continue;

    type SplitRow = { id: string; participant_id: string | null; amount_owed: number; paid_amount: number; is_paid: boolean | null };
    for (const row of expRows ?? []) {
      const meta      = (row.metadata ?? {}) as Partial<ExpenseMetadata>;
      const payer     = row.payer_participant_id ?? '';
      const rawSplits = (row.splits as unknown as SplitRow[]) ?? [];

      if (!rawSplits.some(s => s.participant_id === memberId)) continue;

      const splits: Split[] = rawSplits.map(s => {
        const isPayer = (s.participant_id ?? '') === payer;
        return {
          participantId: s.participant_id ?? '',
          share:         Number(s.amount_owed),
          paidAmount:    isPayer ? Number(s.amount_owed) : Number(s.paid_amount ?? 0),
          isSettled:     isPayer ? true                  : (s.is_paid ?? false),
        };
      });

      results.push({
        groupId,
        groupName:  groupNameMap.get(groupId)  ?? groupId,
        memberId,
        memberName: memberNameMap.get(memberId) ?? memberId,
        expense: {
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
          date:                 row.created_at as string | undefined,
        },
      });
    }
  }

  return { data: results, error: null };
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface FeedbackPayload {
  userId:   string | null;
  email:    string | null;
  category: string;
  message:  string;
}

export interface FeedbackRow {
  id:         string;
  user_id:    string | null;
  email:      string | null;
  message:    string;
  category:   'bug' | 'feature' | 'general';
  created_at: string;
}

export async function fetchAllFeedback(): Promise<DbResult<FeedbackRow[]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('feedback')
    .select('id, user_id, email, message, category, created_at')
    .order('created_at', { ascending: false });
  return { data: data ?? null, error: error?.message ?? null };
}

export async function submitFeedback(payload: FeedbackPayload): Promise<DbResult<void>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('feedback')
    .insert({
      user_id:  payload.userId,
      email:    payload.email,
      category: payload.category,
      message:  payload.message,
    });

  return { data: null, error: error?.message ?? null };
}
