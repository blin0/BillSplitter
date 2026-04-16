import { useState, useEffect, useCallback } from 'react';
import { Receipt, Sun, Moon, LogOut, Loader2, Menu, Users, EyeOff, UserX, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Expense, Participant } from './types';
import {
  computeBalances,
  computeSelectedDebts,
  simplifyDebts,
  totalSpending,
  round2,
} from './utils/calculations';
import { CurrencyProvider } from './context/CurrencyContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ParticipantInput from './components/ParticipantInput';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import Dashboard from './components/Dashboard';
import SettlementAdvice from './components/SettlementAdvice';
import SelectiveSummary from './components/SelectiveSummary';
import CurrencyDropdown from './components/CurrencyDropdown';
import OfflineBanner from './components/OfflineBanner';
import SignInModal from './components/SignInModal';
import GroupSidebar from './components/GroupSidebar';
import GroupActions from './components/GroupActions';
import { useGroupSync } from './hooks/useGroupSync';
import {
  fetchUserGroups,
  fetchParticipants,
  insertParticipant,
  deleteParticipant,
  fetchExpenses,
  insertExpense,
  deleteExpense,
  syncSplitsForExpense,
  type GroupInfo,
} from './lib/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveActiveGroup(id: string) {
  try { localStorage.setItem('billsplitter_active_group', id); } catch (_) {}
}

function loadActiveGroup(): string | null {
  try { return localStorage.getItem('billsplitter_active_group'); } catch { return null; }
}

// ─── Theme hook ───────────────────────────────────────────────────────────────

function useTheme() {
  const [mounted, setMounted] = useState(false);
  const [dark,    setDark   ] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle() {
    setDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch (_) {}
      return next;
    });
  }

  return { dark, mounted, toggle };
}

// ─── AppInner ─────────────────────────────────────────────────────────────────

function AppInner() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { dark, mounted, toggle } = useTheme();
  const [showSignIn,  setShowSignIn ] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Guest state (localStorage) ─────────────────────────────────────────────
  const [guestParticipants, setGuestParticipants] = useState<Participant[]>(() =>
    loadJson<Participant[]>('billsplitter_participants', [])
  );
  const [guestExpenses, setGuestExpenses] = useState<Expense[]>(() =>
    loadJson<Expense[]>('billsplitter_expenses', [])
  );

  useEffect(() => {
    if (user) return;
    try { localStorage.setItem('billsplitter_participants', JSON.stringify(guestParticipants)); } catch (_) {}
  }, [guestParticipants, user]);

  useEffect(() => {
    if (user) return;
    try { localStorage.setItem('billsplitter_expenses', JSON.stringify(guestExpenses)); } catch (_) {}
  }, [guestExpenses, user]);

  // ── Signed-in state (Supabase) ─────────────────────────────────────────────
  const [groups,         setGroups        ] = useState<GroupInfo[]>([]);
  const [activeGroupId,  setActiveGroupId ] = useState<string | null>(null);
  const [dbParticipants, setDbParticipants] = useState<Participant[]>([]);
  const [dbExpenses,     setDbExpenses    ] = useState<Expense[]>([]);
  const [groupsLoading,  setGroupsLoading ] = useState(false);
  const [dataLoading,    setDataLoading   ] = useState(false);
  const [removedNotice,  setRemovedNotice ] = useState<string | null>(null);
  const [joinNotices,    setJoinNotices   ] = useState<{ id: string; text: string }[]>([]);
  const [roleNotices,    setRoleNotices   ] = useState<{ id: string; text: string; promoted: boolean }[]>([]);

  // Realtime sync — keep all group members in lockstep
  useGroupSync(
    user ? activeGroupId : null,
    setDbParticipants,
    setDbExpenses,
  );

  // Load all groups when user signs in
  useEffect(() => {
    if (!user) {
      setGroups([]);
      setActiveGroupId(null);
      setDbParticipants([]);
      setDbExpenses([]);
      return;
    }

    let cancelled = false;
    setGroupsLoading(true);

    fetchUserGroups().then(({ data }) => {
      if (cancelled) return;
      const list = data ?? [];
      setGroups(list);
      if (list.length > 0) {
        const saved   = loadActiveGroup();
        const restore = list.find(g => g.id === saved);
        setActiveGroupId((restore ?? list[0]).id);
      } else {
        setActiveGroupId(null);
      }
      setGroupsLoading(false);
    });

    return () => { cancelled = true; };
  }, [user?.id]); // only re-run when the actual user ID changes, not on token refresh

  // Unified channel for all changes to the current user's own membership rows.
  // Server-side filter (user_id=eq.${user.id}) is evaluated against the OLD row
  // for DELETE events (requires REPLICA IDENTITY FULL, which is set). This avoids
  // the RLS timing problem where is_group_member() returns false post-deletion and
  // silently drops events on unfiltered subscriptions.
  useEffect(() => {
    if (!user) return;

    const ROLE_RANK: Record<string, number> = { admin: 3, editor: 2, viewer: 1 };

    const channel = supabase
      .channel(`member-self:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const notification = payload.new as {
            type: string;
            payload: { group_id: string; group_name: string };
          };
          if (notification.type !== 'removed_from_group') return;

          const { group_id: removedGroupId, group_name: removedName } = notification.payload;

          let remaining: typeof groups = [];
          setGroups(prev => {
            remaining = prev.filter(g => g.id !== removedGroupId);
            return remaining;
          });
          setRemovedNotice(removedName);
          setActiveGroupId(prev => {
            if (prev !== removedGroupId) return prev;
            return remaining[0]?.id ?? null;
          });
          setDbParticipants([]);
          setDbExpenses([]);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'members', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated  = payload.new as { group_id: string; role: string };
          const previous = payload.old as { role: string };

          const newRole = updated.role as 'admin' | 'editor' | 'viewer';
          const oldRole = previous.role;

          setGroups(prev => prev.map(g =>
            g.id === updated.group_id ? { ...g, role: newRole } : g
          ));

          if (!oldRole || newRole === oldRole) return;

          const promoted = (ROLE_RANK[newRole] ?? 0) > (ROLE_RANK[oldRole] ?? 0);
          const roleLabel = newRole.charAt(0).toUpperCase() + newRole.slice(1);
          const noticeId  = makeId();

          setRoleNotices(prev => [...prev, {
            id: noticeId,
            text: `You have been ${promoted ? 'promoted' : 'demoted'} to ${roleLabel}`,
            promoted,
          }]);
          setTimeout(() => {
            setRoleNotices(prev => prev.filter(n => n.id !== noticeId));
          }, 8000);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Notify existing members when someone new joins the active group
  useEffect(() => {
    if (!user || !activeGroupId) return;

    const groupName = groups.find(g => g.id === activeGroupId)?.name ?? 'the group';

    const channel = supabase
      .channel(`member-joins:${activeGroupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'members', filter: `group_id=eq.${activeGroupId}` },
        async (payload) => {
          const newMember = payload.new as { user_id: string };
          if (newMember.user_id === user.id) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newMember.user_id)
            .single();

          const name = profile?.full_name ?? 'Someone';
          const noticeId = makeId();
          setJoinNotices(prev => [...prev, {
            id:   noticeId,
            text: `${name} has joined ${groupName}`,
          }]);
          setTimeout(() => {
            setJoinNotices(prev => prev.filter(n => n.id !== noticeId));
          }, 8000);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeGroupId]);

  // Load participants + expenses when active group changes
  useEffect(() => {
    if (!activeGroupId) {
      setDbParticipants([]);
      setDbExpenses([]);
      return;
    }

    let cancelled = false;
    setDataLoading(true);

    Promise.all([
      fetchParticipants(activeGroupId),
      fetchExpenses(activeGroupId),
    ]).then(([pResult, eResult]) => {
      if (cancelled) return;
      if (pResult.data) setDbParticipants(pResult.data);
      if (eResult.data) setDbExpenses(eResult.data);
      setDataLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeGroupId]);

  // ── Active state (whichever mode is live) ──────────────────────────────────
  const isSignedIn      = !!user;
  const participants    = isSignedIn ? dbParticipants : guestParticipants;
  const expenses        = isSignedIn ? dbExpenses     : guestExpenses;
  const setExpenses     = isSignedIn ? setDbExpenses  : setGuestExpenses;
  const dbLoading       = groupsLoading || dataLoading;
  const activeGroupRole = groups.find(g => g.id === activeGroupId)?.role ?? null;
  const isViewer        = activeGroupRole === 'viewer';

  // ── Group management ───────────────────────────────────────────────────────

  function handleSelectGroup(id: string) {
    setActiveGroupId(id);
    saveActiveGroup(id);
    setSidebarOpen(false);
  }

  function handleGroupAdded(group: GroupInfo) {
    setGroups(prev => {
      if (prev.find(g => g.id === group.id)) return prev; // already in list (re-join)
      return [...prev, group];
    });
    handleSelectGroup(group.id);
  }

  function handleGroupRenamed(groupId: string, newName: string) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
  }

  // ── Participant handlers ───────────────────────────────────────────────────

  async function addParticipant(name: string) {
    if (isSignedIn && activeGroupId) {
      const { data: p, error } = await insertParticipant(activeGroupId, name);
      if (error || !p) return;
      setDbParticipants(prev => [...prev, p]);
    } else {
      setGuestParticipants(prev => [...prev, { id: makeId(), name }]);
    }
  }

  async function removeParticipant(id: string) {
    if (Math.abs(round2(balances[id] ?? 0)) > 0.01) return;
    if (isSignedIn) {
      const { error } = await deleteParticipant(id);
      if (error) return;
      setDbParticipants(prev => prev.filter(p => p.id !== id));
      setDbExpenses(prev => prev.filter(e => e.paidBy !== id));
    } else {
      setGuestParticipants(prev => prev.filter(p => p.id !== id));
      setGuestExpenses(prev => prev.filter(e => e.paidBy !== id));
    }
  }

  // ── Expense handlers ───────────────────────────────────────────────────────

  async function addExpense(expense: Expense) {
    if (isSignedIn && activeGroupId) {
      const { data: newId, error } = await insertExpense(activeGroupId, expense);
      if (error || !newId) return;
      setDbExpenses(prev => [...prev, { ...expense, id: newId }]);
    } else {
      setGuestExpenses(prev => [...prev, expense]);
    }
  }

  async function removeExpense(id: string) {
    if (isSignedIn) {
      const { error } = await deleteExpense(id);
      if (error) return;
      setDbExpenses(prev => prev.filter(e => e.id !== id));
    } else {
      setGuestExpenses(prev => prev.filter(e => e.id !== id));
    }
  }

  function toggleHighlight(id: string) {
    setExpenses(prev =>
      prev.map(e => e.id === id ? { ...e, isHighlighted: !e.isHighlighted } : e)
    );
  }

  function selectAllUnsettled() {
    setExpenses(prev =>
      prev.map(e => ({ ...e, isHighlighted: e.splits.some(s => !s.isSettled) }))
    );
  }

  // ── Payment helpers ────────────────────────────────────────────────────────

  function applyPayment(
    expenses: Expense[],
    from: string,
    to: string,
    paymentAmount: number,
    highlightedOnly: boolean,
  ): Expense[] {
    let remaining = round2(paymentAmount);

    if (highlightedOnly) {
      type SplitRef = { expenseId: string; splitIdx: number; owed: number };
      const eligible: SplitRef[] = [];
      for (const expense of expenses) {
        if (!expense.isHighlighted || expense.paidBy !== to) continue;
        expense.splits.forEach((split, idx) => {
          if (split.participantId !== from || split.isSettled) return;
          const owed = round2(split.share - split.paidAmount);
          if (owed >= 0.01) eligible.push({ expenseId: expense.id, splitIdx: idx, owed });
        });
      }
      eligible.sort((a, b) => a.owed - b.owed);

      const updated: Record<string, Expense['splits']> = {};
      for (const { expenseId, splitIdx } of eligible) {
        if (remaining < 0.01) break;
        const expense = expenses.find(e => e.id === expenseId)!;
        if (!updated[expenseId]) updated[expenseId] = expense.splits.map(s => ({ ...s }));
        const split    = updated[expenseId][splitIdx];
        const owed     = round2(split.share - split.paidAmount);
        const applying = round2(Math.min(remaining, owed));
        remaining      = round2(remaining - applying);
        const newPaid  = round2(split.paidAmount + applying);
        updated[expenseId][splitIdx] = {
          ...split,
          paidAmount: newPaid,
          isSettled:  newPaid >= split.share - 0.005,
        };
      }
      return expenses.map(e => updated[e.id] ? { ...e, splits: updated[e.id] } : e);
    }

    return expenses.map(expense => {
      if (expense.paidBy !== to || remaining < 0.01) return expense;
      const splits = expense.splits.map(split => {
        if (split.participantId !== from || split.isSettled || remaining < 0.01) return split;
        const owed     = round2(split.share - split.paidAmount);
        if (owed < 0.01) return split;
        const applying = round2(Math.min(remaining, owed));
        remaining      = round2(remaining - applying);
        const newPaid  = round2(split.paidAmount + applying);
        return { ...split, paidAmount: newPaid, isSettled: newPaid >= split.share - 0.005 };
      });
      return { ...expense, splits };
    });
  }

  const syncSettlement = useCallback(async (updated: Expense[], prev: Expense[]) => {
    if (!isSignedIn) return;
    const changed = updated.filter((e, i) => e.splits !== prev[i]?.splits);
    await Promise.all(changed.map(e => syncSplitsForExpense(e.id, e.splits)));
  }, [isSignedIn]);

  function settleDebt(from: string, to: string, amount: number) {
    setExpenses(prev => {
      const next = applyPayment(prev, from, to, amount, true);
      syncSettlement(next, prev);
      return next;
    });
  }

  function settleGlobal(from: string, to: string, amount: number) {
    setExpenses(prev => {
      const next = applyPayment(prev, from, to, amount, false);
      syncSettlement(next, prev);
      return next;
    });
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const balances      = computeBalances(participants, expenses);
  const settlements   = simplifyDebts(balances);
  const total         = totalSpending(expenses);
  const highlighted   = expenses.filter(e => e.isHighlighted);
  const selectedDebts = computeSelectedDebts(highlighted);

  // ── Auth-loading spinner ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-500" />
      </div>
    );
  }

  // ── Signed-in: no groups yet → show create/join prompt ────────────────────
  const noGroups = isSignedIn && !groupsLoading && groups.length === 0;

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">

      {/* Sidebar — only when signed in */}
      {isSignedIn && (
        <GroupSidebar
          groups={groups}
          activeGroupId={activeGroupId}
          currentUserId={user?.id ?? null}
          onSelect={handleSelectGroup}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onGroupAdded={handleGroupAdded}
          onGroupRenamed={handleGroupRenamed}
        />
      )}

      {/* Main area */}
      <div className={isSignedIn ? 'flex-1 min-w-0 lg:ml-64' : 'flex-1 min-w-0'}>

        {/* ── Header ── */}
        <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">

            {/* Mobile sidebar toggle (signed-in only) */}
            {isSignedIn && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Open groups"
              >
                <Menu size={20} />
              </button>
            )}

            <div className="p-2 bg-violet-600 rounded-xl">
              <Receipt size={20} className="text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 leading-none">
                BillSplitter
              </h1>
              {/* Active group name on desktop when signed in */}
              {isSignedIn && activeGroupId && (
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                  {groups.find(g => g.id === activeGroupId)?.name ?? ''}
                </p>
              )}
              {!isSignedIn && (
                <p className="text-xs text-gray-400 dark:text-slate-500">Split expenses fairly</p>
              )}
            </div>

            <CurrencyDropdown />

            <button
              onClick={toggle}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
            >
              {mounted
                ? dark ? <Sun size={18} /> : <Moon size={18} />
                : <span className="w-[18px] h-[18px] block" />}
            </button>

            {isSignedIn ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-semibold shrink-0 select-none">
                  {(user.user_metadata?.full_name ?? user.email ?? '?')[0].toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm text-gray-700 dark:text-slate-300 max-w-[120px] truncate">
                  {user.user_metadata?.full_name ?? user.email}
                </span>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <LogOut size={15} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSignIn(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        <OfflineBanner />

        {/* ── Member-joined + role-change notices ── */}
        {(joinNotices.length > 0 || roleNotices.length > 0) && (
          <div className="flex flex-col gap-2 px-4 pt-3">
            {joinNotices.map(notice => (
              <div
                key={notice.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="flex-1 text-sm text-emerald-800 dark:text-emerald-300">{notice.text}</p>
                <button
                  onClick={() => setJoinNotices(prev => prev.filter(n => n.id !== notice.id))}
                  className="shrink-0 p-0.5 rounded text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {roleNotices.map(notice => (
              <div
                key={notice.id}
                className={notice.promoted
                  ? 'flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50'
                  : 'flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50'
                }
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${notice.promoted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <p className={`flex-1 text-sm ${notice.promoted ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {notice.text}
                </p>
                <button
                  onClick={() => setRoleNotices(prev => prev.filter(n => n.id !== notice.id))}
                  className={`shrink-0 p-0.5 rounded transition-colors ${notice.promoted ? 'text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200' : 'text-amber-500 hover:text-amber-700 dark:hover:text-amber-200'}`}
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Removed-from-group toast ── */}
        {removedNotice && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg max-w-sm w-[calc(100%-2rem)] bg-gray-900 dark:bg-slate-700 text-white">
            <div className="shrink-0 p-1.5 rounded-lg bg-red-500/20">
              <UserX size={15} className="text-red-400" />
            </div>
            <p className="flex-1 text-sm leading-snug">
              You were removed from{' '}
              <span className="font-semibold">{removedNotice}</span>.
            </p>
            <button
              onClick={() => setRemovedNotice(null)}
              className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── No-groups prompt ── */}
        {noGroups && (
          <div className="flex items-center justify-center min-h-[calc(100vh-73px)] px-4">
            <div className="w-full max-w-sm">
              <div className="text-center mb-6">
                <div className="inline-flex p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/20 mb-4">
                  <Users size={32} className="text-violet-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                  Welcome to BillSplitter
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Create a group to get started, or join one with a code.
                </p>
              </div>
              <GroupActions onCreated={handleGroupAdded} onJoined={handleGroupAdded} />
            </div>
          </div>
        )}

        {/* ── Loading spinner (data fetch for active group) ── */}
        {isSignedIn && dbLoading && !noGroups && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-violet-500" />
          </div>
        )}

        {/* ── Main app content ── */}
        {(!isSignedIn || (activeGroupId && !dbLoading)) && !noGroups && (
          <main className="max-w-6xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* ── Left column ── */}
              <div className="space-y-5 lg:col-start-1">
                <div className="order-1">
                  <ParticipantInput
                    participants={participants}
                    balances={balances}
                    onAdd={addParticipant}
                    onRemove={removeParticipant}
                    readOnly={isSignedIn && isViewer}
                  />
                </div>
                <div className="order-2">
                  {isSignedIn && isViewer ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 shrink-0">
                        <EyeOff size={18} className="text-gray-400 dark:text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-0.5">
                          View-only access
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 leading-snug">
                          You can see all expenses but cannot add or delete them. Ask a group admin or editor to change your role.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ExpenseForm
                      participants={participants}
                      onAdd={addExpense}
                    />
                  )}
                </div>
                <div className="order-5">
                  <ExpenseList
                    expenses={expenses}
                    participants={participants}
                    onRemove={removeExpense}
                    onToggleHighlight={toggleHighlight}
                    onSelectAllUnsettled={selectAllUnsettled}
                    readOnly={isSignedIn && isViewer}
                  />
                </div>
              </div>

              {/* ── Right column ── */}
              <div className="space-y-5 lg:col-start-2">
                <div className="order-3">
                  <Dashboard
                    participants={participants}
                    balances={balances}
                    totalSpending={total}
                    settlements={settlements}
                    expenses={expenses}
                  />
                </div>
                <div className="order-4">
                  <SettlementAdvice
                    settlements={settlements}
                    participants={participants}
                    onSettle={settleGlobal}
                    readOnly={isSignedIn && isViewer}
                  />
                </div>
                <div className="order-6">
                  <SelectiveSummary
                    selectedDebts={selectedDebts}
                    participants={participants}
                    highlightedCount={highlighted.length}
                    onSettle={settleDebt}
                    readOnly={isSignedIn && isViewer}
                  />
                </div>
              </div>
            </div>
          </main>
        )}
      </div>

      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <AppInner />
      </CurrencyProvider>
    </AuthProvider>
  );
}
