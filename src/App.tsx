import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Receipt, Sun, Moon, LogOut, Loader2, Menu, Users, EyeOff, UserX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import { applyLangToDOM, LANG_STORAGE_KEY } from './lib/i18n';
import { supabase } from './lib/supabase';
import type { Expense, Participant } from './types';
import {
  computeBalances,
  computeSelectedDebts,
  simplifyDebts,
  totalSpending,
  round2,
} from './utils/calculations';
import { CurrencyProvider, useCurrency, type CurrencyCode, CURRENCIES } from './context/CurrencyContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider, useSubscriptionContext } from './context/SubscriptionContext';
import { expenseLimit } from './lib/hasAccess';
import FeedbackDashboard from './pages/FeedbackDashboard';
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
import ActivityLog from './components/ActivityLog';
import ExpenseModal from './components/ExpenseModal';
import FeedbackButton from './components/FeedbackButton';
import OnboardingTour, { useOnboardingTour } from './components/OnboardingTour';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import Landing from './pages/Landing';
import ProtectedRoute from './components/ProtectedRoute';
import ResetPassword from './pages/ResetPassword';
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
  logActivity,
  fetchOwnProfile,
  fetchMemberLink,
  setMemberLink,
  deleteMemberLink,
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
  // Read directly from the DOM so the initial value is always correct — no
  // useEffect delay, no stale-closure risk, no SSR concern (this is a pure SPA).
  const [dark, setDark] = useState<boolean>(() =>
    document.documentElement.classList.contains('dark'),
  );

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch (_) {}
    setDark(next);
  }

  return { dark, toggle };
}

// ─── UserAvatar ───────────────────────────────────────────────────────────────
// Shows the user's profile picture, falling back to a coloured initial circle
// if the URL is absent or the image fails to load.

interface UserAvatarProps {
  src:      string | null;
  initial:  string;
  onClick?: () => void;
  size?:    'sm' | 'md';
}

function UserAvatar({ src, initial, onClick, size = 'sm' }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';

  const sharedCls = `${dim} rounded-full shrink-0 select-none transition-all hover:ring-2 hover:ring-violet-400/60 hover:ring-offset-1 dark:hover:ring-offset-slate-900`;

  if (src && !imgError) {
    return (
      <button type="button" onClick={onClick} className={sharedCls}>
        <img
          src={src}
          alt={initial}
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover border border-slate-200 dark:border-slate-700"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sharedCls} bg-violet-600 flex items-center justify-center text-white text-xs font-semibold`}
    >
      {initial}
    </button>
  );
}

// ─── GroupRouteSync ───────────────────────────────────────────────────────────
// Rendered inside the /group/:groupId route — syncs the URL param → activeGroupId.

interface GroupRouteSyncProps {
  groups:        GroupInfo[];
  activeGroupId: string | null;
  groupsLoading: boolean;
  onSync:        (id: string) => void;
}

function GroupRouteSync({ groups, activeGroupId, groupsLoading, onSync }: GroupRouteSyncProps) {
  const { groupId } = useParams<{ groupId: string }>();

  useEffect(() => {
    if (!groupId || groupsLoading) return;
    if (groups.some(g => g.id === groupId) && groupId !== activeGroupId) {
      onSync(groupId);
    }
  }, [groupId, groups, groupsLoading, activeGroupId, onSync]);

  return null;
}

// ─── AppInner ─────────────────────────────────────────────────────────────────

function AppInner() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { dark, toggle } = useTheme();
  const { setCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const subscription = useSubscriptionContext();
  const location = useLocation();
  const [showSignIn,           setShowSignIn          ] = useState(false);
  const [sidebarOpen,          setSidebarOpen         ] = useState(false);
  const [showExpenseModal,     setShowExpenseModal    ] = useState(false);
  const [desktopExpenseModal,  setDesktopExpenseModal ] = useState(() =>
    loadJson<boolean>('billsplitter_desktop_modal', false)
  );
  const [profileAvatar,        setProfileAvatar       ] = useState<string | null>(null);
  const [profileDisplayName,   setProfileDisplayName  ] = useState<string | null>(null);

  function handleDesktopModalChange(val: boolean) {
    setDesktopExpenseModal(val);
    try { localStorage.setItem('billsplitter_desktop_modal', JSON.stringify(val)); } catch (_) {}
  }

  const isProfilePage   = location.pathname === '/profile';
  const isAnalyticsPage = location.pathname.startsWith('/analytics');
  const isFeedbackPage  = location.pathname === '/feedback';

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
  // Identity: which named_participant the current user has claimed as "me" in the active group
  const [linkedMemberId, setLinkedMemberId] = useState<string | null>(null);

  // Realtime sync — keep all group members in lockstep
  useGroupSync(
    user ? activeGroupId : null,
    setDbParticipants,
    setDbExpenses,
  );

  // Sync profile data (currency, avatar, display name, language) on sign-in; clear on sign-out
  useEffect(() => {
    if (!user) {
      setProfileAvatar(null);
      setProfileDisplayName(null);
      return;
    }
    fetchOwnProfile().then(({ data }) => {
      if (!data) return;
      if (data.defaultCurrency in CURRENCIES) {
        setCurrency(data.defaultCurrency as CurrencyCode);
      }
      // Seed default tax rate into localStorage so ExpenseForm can read it instantly
      try { localStorage.setItem(`bsp_tax_${user.id}`, String(data.defaultTaxRate ?? 0)); } catch (_) {}
      // Sync language preference from profile (overrides browser-detected lang)
      if (data.languagePreference && data.languagePreference !== i18n.language) {
        void i18n.changeLanguage(data.languagePreference);
        try { localStorage.setItem(LANG_STORAGE_KEY, data.languagePreference); } catch (_) {}
        applyLangToDOM(data.languagePreference);
      }
      // Profile table avatar takes priority; fall back to OAuth metadata avatar
      setProfileAvatar(data.avatarUrl ?? user.user_metadata?.avatar_url ?? null);
      // Profile table fullName is the user-chosen display name ("nickname")
      setProfileDisplayName(data.fullName ?? null);
    });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Prefer the group from the URL (if we're on /group/:id), then localStorage
        const urlMatch = location.pathname.match(/^\/group\/([^/]+)/);
        const urlGroupId = urlMatch?.[1] ?? null;
        const fromUrl    = urlGroupId ? list.find(g => g.id === urlGroupId) : null;
        const saved      = loadActiveGroup();
        const restore    = fromUrl ?? list.find(g => g.id === saved);
        setActiveGroupId((restore ?? list[0]).id);
      } else {
        setActiveGroupId(null);
      }
      setGroupsLoading(false);
    });

    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Channel: current user's membership changes (removed, role change)
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

          // Navigate away from the removed group
          if (activeGroupId === removedGroupId) {
            const nextId = remaining[0]?.id ?? null;
            navigate(nextId ? `/group/${nextId}` : '/dashboard', { replace: true });
          }
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

          const promoted  = (ROLE_RANK[newRole] ?? 0) > (ROLE_RANK[oldRole] ?? 0);
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
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

          const name     = profile?.full_name ?? 'Someone';
          const noticeId = makeId();
          setJoinNotices(prev => [...prev, { id: noticeId, text: `${name} has joined ${groupName}` }]);
          setTimeout(() => {
            setJoinNotices(prev => prev.filter(n => n.id !== noticeId));
          }, 8000);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load participants + expenses + identity link when active group changes
  useEffect(() => {
    if (!activeGroupId) {
      setDbParticipants([]);
      setDbExpenses([]);
      setLinkedMemberId(null);
      return;
    }

    let cancelled = false;
    setDataLoading(true);

    Promise.all([
      fetchParticipants(activeGroupId),
      fetchExpenses(activeGroupId),
      fetchMemberLink(activeGroupId),
    ]).then(([pResult, eResult, linkResult]) => {
      if (cancelled) return;
      if (pResult.data)    setDbParticipants(pResult.data);
      if (eResult.data)    setDbExpenses(eResult.data);
      setLinkedMemberId(linkResult.data ?? null);
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

  // ── Expense limit gate ────────────────────────────────────────────────────
  const monthlyExpenseLimit = expenseLimit(subscription.subscriptionTier);
  const monthlyExpenseCount = (() => {
    if (monthlyExpenseLimit === null) return 0;
    const now = new Date();
    return expenses.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  })();
  const expenseLimitReached = monthlyExpenseLimit !== null && monthlyExpenseCount >= monthlyExpenseLimit;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Never fire while the user is typing in a form field
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        || (document.activeElement as HTMLElement | null)?.isContentEditable;
      if (isEditing) return;

      if (e.key === 'n' || e.key === 'N') {
        // Only open when a group (or guest mode) is active and user can add expenses
        const hasNoGroups = isSignedIn && !groupsLoading && groups.length === 0;
        if (!isProfilePage && !(isSignedIn && isViewer) && !hasNoGroups) {
          e.preventDefault();
          setShowExpenseModal(true);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (showExpenseModal) { setShowExpenseModal(false); return; }
        if (showSignIn)       { setShowSignIn(false);       return; }
        // Clear any highlighted/selected expenses
        setExpenses(prev => prev.map(ex => ({ ...ex, isHighlighted: false })));
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isProfilePage, isSignedIn, isViewer, groupsLoading, groups, showExpenseModal, showSignIn, setExpenses]);

  // ── Identity link handlers ─────────────────────────────────────────────────

  async function handleLink(memberId: string) {
    if (!activeGroupId) return;
    const { error } = await setMemberLink(activeGroupId, memberId);
    if (!error) setLinkedMemberId(memberId);
  }

  async function handleUnlink() {
    if (!activeGroupId) return;
    const { error } = await deleteMemberLink(activeGroupId);
    if (!error) setLinkedMemberId(null);
  }

  // ── Group management ───────────────────────────────────────────────────────

  const handleGroupSyncRef = useRef<(id: string) => void>(() => {});

  function handleSelectGroup(id: string) {
    setActiveGroupId(id);
    saveActiveGroup(id);
    setSidebarOpen(false);
    navigate(`/group/${id}`);
  }

  function handleOpenAnalytics() {
    navigate('/analytics');
  }

  function handleGroupAdded(group: GroupInfo) {
    setGroups(prev => {
      if (prev.find(g => g.id === group.id)) return prev;
      return [...prev, group];
    });
    handleSelectGroup(group.id);
  }

  function handleGroupRenamed(groupId: string, newName: string) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
  }

  function handleGroupLeft(groupId: string) {
    const remaining = groups.filter(g => g.id !== groupId);
    setGroups(remaining);
    if (activeGroupId === groupId) {
      const next = remaining[0]?.id ?? null;
      setActiveGroupId(next);
      if (next) {
        saveActiveGroup(next);
        navigate(`/group/${next}`, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
      setDbParticipants([]);
      setDbExpenses([]);
    }
  }

  function handleGroupDeleted(groupId: string) {
    handleGroupLeft(groupId);
  }

  function handleGroupTaxRateChanged(groupId: string, rate: number | null) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, defaultTaxRate: rate } : g));
  }

  // Keep a stable ref so GroupRouteSync can call it without re-subscribing
  handleGroupSyncRef.current = (id: string) => {
    setActiveGroupId(id);
    saveActiveGroup(id);
  };
  const stableGroupSync = useCallback((id: string) => handleGroupSyncRef.current(id), []);

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
      void logActivity({
        groupId:       activeGroupId,
        actionType:    'EXPENSE_ADDED',
        expenseId:     newId,
        amount:        expense.totalAmount,
        participantId: expense.paidBy,
        isSettled:     false,
        message:       expense.description,
      });
    } else {
      setGuestExpenses(prev => [...prev, expense]);
    }
  }

  async function removeExpense(id: string) {
    if (isSignedIn) {
      const found = dbExpenses.find(e => e.id === id);
      const { error } = await deleteExpense(id);
      if (error) return;
      setDbExpenses(prev => prev.filter(e => e.id !== id));
      if (activeGroupId && found) {
        const wasSettled = found.splits.length > 0 && found.splits.every(s => s.isSettled);
        void logActivity({
          groupId:       activeGroupId,
          actionType:    'EXPENSE_DELETED',
          expenseId:     null,
          amount:        found.totalAmount,
          participantId: found.paidBy,
          isSettled:     wasSettled,
          message:       found.description,
        });
      }
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

  function nameOf(id: string) {
    return participants.find(p => p.id === id)?.name ?? id;
  }

  function settleDebt(from: string, to: string, amount: number) {
    setExpenses(prev => {
      const next = applyPayment(prev, from, to, amount, true);
      syncSettlement(next, prev);
      return next;
    });
    if (isSignedIn && activeGroupId) {
      void logActivity({
        groupId:       activeGroupId,
        actionType:    'SETTLEMENT_MADE',
        amount,
        participantId: from,
        message:       `settled for ${nameOf(from)} → ${nameOf(to)}`,
      });
    }
  }

  function settleGlobal(from: string, to: string, amount: number) {
    setExpenses(prev => {
      const next = applyPayment(prev, from, to, amount, false);
      syncSettlement(next, prev);
      return next;
    });
    if (isSignedIn && activeGroupId) {
      void logActivity({
        groupId:       activeGroupId,
        actionType:    'SETTLEMENT_MADE',
        amount,
        participantId: from,
        message:       `settled for ${nameOf(from)} → ${nameOf(to)}`,
      });
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const balances      = computeBalances(participants, expenses);
  const settlements   = simplifyDebts(balances);
  const total         = totalSpending(expenses);
  const highlighted   = expenses.filter(e => e.isHighlighted);
  const selectedDebts = computeSelectedDebts(highlighted);

  const noGroups = isSignedIn && !groupsLoading && groups.length === 0;

  // ── Onboarding tour — must be called before any early return (Rules of Hooks)
  const tourReady = !authLoading && !isProfilePage && !noGroups && (!isSignedIn || (!!activeGroupId && !dbLoading));
  const { show: showTour, dismiss: dismissTour } = useOnboardingTour(tourReady);

  // ── Auth-loading spinner ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-500" />
      </div>
    );
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex w-full max-w-full [overflow-x:clip] min-h-[100dvh] bg-gray-50 dark:bg-slate-950">

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
          onGroupLeft={handleGroupLeft}
          onGroupDeleted={handleGroupDeleted}
          onOpenProfile={() => navigate('/profile')}
          onOpenAnalytics={handleOpenAnalytics}
          onOpenFeedback={() => navigate('/feedback')}
          onGroupTaxRateChanged={handleGroupTaxRateChanged}
        />
      )}

      {/* Main area — one deliberate scroll container (h-[100dvh] overflow-y-auto)
          so iOS Safari has an unambiguous target and applies full momentum scroll
          from the very first touch. overflow-x-hidden is safe here because both
          axes are set explicitly, preventing the CSS spec's asymmetric-overflow
          promotion (hidden+visible → hidden+auto) that would create a nested
          scroll container.                                                      */}
      <div
        className={isSignedIn
          ? 'flex-1 min-w-0 w-full max-w-full lg:ml-64 h-[100dvh] overflow-x-hidden overflow-y-auto'
          : 'flex-1 min-w-0 w-full max-w-full h-[100dvh] overflow-x-hidden overflow-y-auto'
        }
        style={{ touchAction: 'pan-y' }}
      >

        {/* ── Unified header — always visible ── */}
        <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 min-w-0">

            {/* Mobile sidebar toggle (signed-in only) */}
            {isSignedIn && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={t('nav.openGroups')}
              >
                <Menu size={20} />
              </button>
            )}

            {/* Logo + title — clicking back on the profile page goes to dashboard */}
            <div
              className={`flex items-center gap-2 flex-1 min-w-0${
                isProfilePage && isSignedIn
                  ? ' cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors -ml-1 px-1 py-0.5'
                  : ''
              }`}
              onClick={isProfilePage && isSignedIn ? () => navigate(-1) : undefined}
              role={isProfilePage && isSignedIn ? 'button' : undefined}
              tabIndex={isProfilePage && isSignedIn ? 0 : undefined}
              onKeyDown={isProfilePage && isSignedIn
                ? (e) => { if (e.key === 'Enter' || e.key === ' ') navigate(-1); }
                : undefined}
              aria-label={isProfilePage && isSignedIn ? 'Back to dashboard' : undefined}
            >
              <img src="/favicon.svg" alt="Axiom Splits" className="w-9 h-9 shrink-0" />

              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 leading-none">
                  Axiom Splits
                </h1>
                {isProfilePage && isSignedIn ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('nav.profile')}</p>
                ) : isSignedIn && activeGroupId ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                    {groups.find(g => g.id === activeGroupId)?.name ?? ''}
                  </p>
                ) : !isSignedIn ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('nav.tagline')}</p>
                ) : null}
              </div>
            </div>

            {/* Right-side controls — shrink-0 prevents any wrapping */}
            <div className="flex items-center gap-2 shrink-0">
              <CurrencyDropdown />

              <LanguageSwitcher variant="dark" />

              <button
                onClick={toggle}
                aria-label={dark ? t('nav.lightMode') : t('nav.darkMode')}
                className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {isSignedIn ? (
                <div className="flex items-center gap-2">
                  <UserAvatar
                    src={profileAvatar}
                    initial={(profileDisplayName ?? user.user_metadata?.full_name ?? 'U')[0].toUpperCase()}
                    onClick={() => navigate('/profile')}
                  />
                  <button
                    onClick={() => navigate('/profile')}
                    className="hidden sm:flex items-center text-sm text-gray-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors max-w-[140px] truncate"
                  >
                    <span className="truncate">
                      {profileDisplayName || user.user_metadata?.full_name || 'User'}
                    </span>
                  </button>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <LogOut size={15} />
                    <span className="hidden sm:inline">{t('nav.signOut')}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignIn(true)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors"
                >
                  {t('nav.signIn')}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── Routes — handles redirects, group-param sync, and profile page ── */}
        <Routes>
          {/* Sync /group/:groupId URL param → activeGroupId state */}
          <Route path="/group/:groupId" element={
            <GroupRouteSync
              groups={groups}
              activeGroupId={activeGroupId}
              groupsLoading={groupsLoading}
              onSync={stableGroupSync}
            />
          } />

          {/* Protected profile page */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile
                authEmail={user?.email ?? null}
                authName={user?.user_metadata?.full_name ?? null}
                userId={user?.id ?? null}
                desktopExpenseModal={desktopExpenseModal}
                onDesktopExpenseModalChange={handleDesktopModalChange}
              />
            </ProtectedRoute>
          } />

          {/* Analytics page */}
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Analytics groups={groups} currentUserId={user?.id ?? null} />
            </ProtectedRoute>
          } />

          {/* Developer feedback dashboard */}
          <Route path="/feedback" element={
            <ProtectedRoute>
              <FeedbackDashboard />
            </ProtectedRoute>
          } />
        </Routes>

        {/* ── Dashboard content — visible for all non-profile/non-analytics routes ── */}
        {!isProfilePage && !isAnalyticsPage && !isFeedbackPage && (<>

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

          {/* ── No-groups welcome state ── */}
          {noGroups && (
            <div className="flex items-center justify-center min-h-[calc(100dvh-73px)] px-4 py-12">
              <div className="w-full max-w-md">

                {/* Hero icon + headline */}
                <div className="text-center mb-8">
                  <div className="relative inline-flex mb-5">
                    <div className="absolute inset-0 rounded-3xl bg-violet-500/20 blur-xl" />
                    <div className="relative inline-flex p-5 rounded-3xl bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800/50">
                      <Users size={36} className="text-violet-500 dark:text-violet-400" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    Welcome to Axiom Splits
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Create a group for your trip, household, or any shared expense — or join one with an invite code.
                  </p>
                </div>

                {/* Feature hints */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { icon: '💱', label: '30+ currencies' },
                    { icon: '⚡', label: 'Smart Settle' },
                    { icon: '🔄', label: 'Real-time sync' },
                  ].map(f => (
                    <div key={f.label} className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/50">
                      <span className="text-xl">{f.icon}</span>
                      <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 text-center leading-tight">{f.label}</span>
                    </div>
                  ))}
                </div>

                {/* Group actions */}
                <GroupActions
                  onCreated={handleGroupAdded}
                  onJoined={handleGroupAdded}
                  onUpgrade={() => navigate('/profile')}
                />
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
                  <div className="order-1" data-tour="members">
                    <ParticipantInput
                      participants={participants}
                      balances={balances}
                      onAdd={addParticipant}
                      onRemove={removeParticipant}
                      readOnly={isSignedIn && isViewer}
                      linkedMemberId={linkedMemberId}
                      onLink={handleLink}
                      onUnlink={handleUnlink}
                      identityEnabled={isSignedIn}
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
                    ) : desktopExpenseModal ? (
                      /* Modal mode (or mobile): show the dashed button */
                      <button
                        data-tour="add-expense"
                        onClick={() => setShowExpenseModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800/60 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:border-violet-400 dark:hover:border-violet-600 transition-all group"
                      >
                        <Receipt size={16} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Add Expense</span>
                        <kbd className="ml-1 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-violet-200 dark:border-violet-800 text-[10px] font-mono text-violet-400 dark:text-violet-500">N</kbd>
                      </button>
                    ) : (
                      /* Inline mode (default on desktop) */
                      <>
                        {/* Desktop: inline form */}
                        <div className="hidden lg:block" data-tour="add-expense">
                          <ExpenseForm participants={participants} onAdd={addExpense} groupId={activeGroupId ?? undefined} groupTaxRate={groups.find(g => g.id === activeGroupId)?.defaultTaxRate} limitReached={expenseLimitReached} monthlyCount={monthlyExpenseCount} monthlyLimit={monthlyExpenseLimit} onUpgrade={() => navigate('/profile')} />
                        </div>
                        {/* Mobile: dashed button → modal */}
                        <button
                          data-tour="add-expense"
                          onClick={() => setShowExpenseModal(true)}
                          className="lg:hidden w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800/60 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:border-violet-400 dark:hover:border-violet-600 transition-all group"
                        >
                          <Receipt size={16} className="group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">Add Expense</span>
                        </button>
                      </>
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
                  <div className="order-4" data-tour="settlement">
                    <SettlementAdvice
                      settlements={settlements}
                      participants={participants}
                      onSettle={settleGlobal}
                      readOnly={isSignedIn && isViewer}
                      groupId={activeGroupId ?? undefined}
                      groupName={groups.find(g => g.id === activeGroupId)?.name}
                    />
                  </div>
                  <div className="order-6">
                    <SelectiveSummary
                      selectedDebts={selectedDebts}
                      participants={participants}
                      highlightedCount={highlighted.length}
                      onSettle={settleDebt}
                      readOnly={isSignedIn && isViewer}
                      groupId={activeGroupId ?? undefined}
                      groupName={groups.find(g => g.id === activeGroupId)?.name}
                    />
                  </div>
                  {isSignedIn && activeGroupId && (
                    <div className="order-7">
                      <ActivityLog groupId={activeGroupId} />
                    </div>
                  )}
                </div>
              </div>
            </main>
          )}
        </>)}
      </div>

      {showTour && (
        <OnboardingTour
          onDone={dismissTour}
          showSignupStep={!isSignedIn}
          onSignUp={() => setShowSignIn(true)}
        />
      )}

      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}

      <ExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        participants={participants}
        onAdd={addExpense}
        groupId={activeGroupId ?? undefined}
        groupTaxRate={groups.find(g => g.id === activeGroupId)?.defaultTaxRate}
        limitReached={expenseLimitReached}
        monthlyCount={monthlyExpenseCount}
        monthlyLimit={monthlyExpenseLimit}
        onUpgrade={() => { setShowExpenseModal(false); navigate('/profile'); }}
      />

      {!isProfilePage && !isFeedbackPage && <FeedbackButton />}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/*" element={
            <CurrencyProvider>
              <AppInner />
            </CurrencyProvider>
          } />
        </Routes>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
