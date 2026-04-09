import { useState, useEffect } from 'react';
import { Receipt, Sun, Moon, LogOut, CloudOff } from 'lucide-react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import AuthScreen from './components/AuthScreen';
import type { Expense, Participant } from './types';
import {
  computeBalances,
  computeSelectedDebts,
  simplifyDebts,
  totalSpending,
  round2,
} from './utils/calculations';
import { CurrencyProvider } from './context/CurrencyContext';
import ParticipantInput from './components/ParticipantInput';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import Dashboard from './components/Dashboard';
import SettlementAdvice from './components/SettlementAdvice';
import SelectiveSummary from './components/SelectiveSummary';
import CurrencyDropdown from './components/CurrencyDropdown';
import OfflineBanner from './components/OfflineBanner';
import { cn } from './lib/cn';

function makeId() {
  return Math.random().toString(36).slice(2);
}

// ─── Theme hook ───────────────────────────────────────────────────────────────

function useTheme() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

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

// ─── Convex → frontend type adapters ─────────────────────────────────────────

type ConvexParticipant = { _id: Id<"participants">; _creationTime: number; name: string };
type ConvexExpense     = Omit<Expense, 'id' | 'paidBy' | 'involvedParticipants' | 'splits'> & {
  _id:                  Id<"expenses">;
  _creationTime:        number;
  paidBy:               Id<"participants">;
  involvedParticipants: Id<"participants">[];
  splits: {
    participantId: Id<"participants">;
    share:         number;
    paidAmount:    number;
    isSettled:     boolean;
  }[];
};

function toParticipant(doc: ConvexParticipant): Participant {
  return { id: doc._id as string, name: doc.name };
}

function toExpense(doc: ConvexExpense): Expense {
  return {
    id:                   doc._id as string,
    description:          doc.description,
    totalAmount:          doc.totalAmount,
    sourceAmount:         doc.sourceAmount,
    sourceCurrency:       doc.sourceCurrency,
    lockedRate:           doc.lockedRate,
    paidBy:               doc.paidBy as string,
    splitType:            doc.splitType,
    involvedParticipants: doc.involvedParticipants as string[],
    splits:               doc.splits.map(s => ({
      ...s,
      participantId: s.participantId as string,
    })),
    isHighlighted:   doc.isHighlighted,
    taxPercent:      doc.taxPercent,
    tipSourceAmount: doc.tipSourceAmount,
  };
}

// ─── Guest banner ─────────────────────────────────────────────────────────────

function GuestBanner({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="bg-violet-50 dark:bg-violet-950/40 border-b border-violet-200 dark:border-violet-800/50 px-4 py-2 flex items-center gap-3">
      <CloudOff size={14} className="text-violet-500 dark:text-violet-400 shrink-0" />
      <p className="flex-1 text-xs text-violet-700 dark:text-violet-300">
        <span className="font-semibold">Guest Mode</span> — your progress is not saved.
      </p>
      <button
        type="button"
        onClick={onSignIn}
        className="shrink-0 text-xs font-semibold px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all hover:scale-105 active:scale-95"
      >
        Sign In to Save
      </button>
    </div>
  );
}

// ─── Auth modal ───────────────────────────────────────────────────────────────

function AuthModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent backdrop-blur-lg"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm flex items-center justify-center">
        <AuthScreen onClose={onClose} modal />
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppInner() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { dark, mounted, toggle } = useTheme();
  const { signOut } = useAuthActions();
  const [showAuth, setShowAuth] = useState(false);

  // ── Convex data (returns [] when unauthenticated — backend guards it) ──────
  const rawParticipants = useQuery(api.participants.list);
  const rawExpenses     = useQuery(api.expenses.list);
  const convexParticipants: Participant[] = (rawParticipants ?? []).map(toParticipant);
  const convexExpenses:     Expense[]     = (rawExpenses     ?? []).map(toExpense);
  const convexLoading = isAuthenticated && (rawParticipants === undefined || rawExpenses === undefined);

  // ── Local guest state ─────────────────────────────────────────────────────
  const [localParticipants, setLocalParticipants] = useState<Participant[]>([]);
  const [localExpenses, setLocalExpenses]         = useState<Expense[]>([]);

  // ── Active data — Convex when authenticated, local when guest ─────────────
  const participants = isAuthenticated ? convexParticipants : localParticipants;
  const expenses     = isAuthenticated ? convexExpenses     : localExpenses;

  // ── Convex mutations ───────────────────────────────────────────────────────
  const addParticipantMutation     = useMutation(api.participants.add);
  const removeParticipantMutation  = useMutation(api.participants.remove);
  const addExpenseMutation         = useMutation(api.expenses.add);
  const removeExpenseMutation      = useMutation(api.expenses.remove);
  const toggleHighlightMutation    = useMutation(api.expenses.toggleHighlight);
  const highlightUnsettledMutation = useMutation(api.expenses.highlightUnsettled);
  const applyPaymentMutation       = useMutation(api.expenses.applyPayment);

  // ── Derived data ───────────────────────────────────────────────────────────
  const balances      = computeBalances(participants, expenses);
  const settlements   = simplifyDebts(balances);
  const total         = totalSpending(expenses);
  const highlighted   = expenses.filter(e => e.isHighlighted);
  const selectedDebts = computeSelectedDebts(highlighted);

  // ── Participant handlers ───────────────────────────────────────────────────
  function addParticipant(name: string) {
    if (isAuthenticated) {
      void addParticipantMutation({ name });
    } else {
      setLocalParticipants(prev => [...prev, { id: makeId(), name }]);
    }
  }

  function removeParticipant(id: string) {
    if (Math.abs(round2(balances[id] ?? 0)) > 0.01) return;
    if (isAuthenticated) {
      void removeParticipantMutation({ id: id as Id<"participants"> });
    } else {
      setLocalParticipants(prev => prev.filter(p => p.id !== id));
      setLocalExpenses(prev => prev.filter(e => e.paidBy !== id));
    }
  }

  // ── Expense handlers ───────────────────────────────────────────────────────
  function addExpense(expense: Expense) {
    if (isAuthenticated) {
      void addExpenseMutation({
        description:          expense.description,
        totalAmount:          expense.totalAmount,
        sourceAmount:         expense.sourceAmount,
        sourceCurrency:       expense.sourceCurrency,
        lockedRate:           expense.lockedRate,
        paidBy:               expense.paidBy              as Id<"participants">,
        splitType:            expense.splitType,
        involvedParticipants: expense.involvedParticipants as Id<"participants">[],
        splits:               expense.splits.map(s => ({
          ...s,
          participantId: s.participantId as Id<"participants">,
        })),
        taxPercent:           expense.taxPercent,
        tipSourceAmount:      expense.tipSourceAmount,
      });
    } else {
      setLocalExpenses(prev => [...prev, { ...expense, id: makeId() }]);
    }
  }

  function removeExpense(id: string) {
    if (isAuthenticated) {
      void removeExpenseMutation({ id: id as Id<"expenses"> });
    } else {
      setLocalExpenses(prev => prev.filter(e => e.id !== id));
    }
  }

  function toggleHighlight(id: string) {
    if (isAuthenticated) {
      void toggleHighlightMutation({ id: id as Id<"expenses"> });
    } else {
      setLocalExpenses(prev =>
        prev.map(e => e.id === id ? { ...e, isHighlighted: !e.isHighlighted } : e)
      );
    }
  }

  function selectAllUnsettled() {
    if (isAuthenticated) {
      void highlightUnsettledMutation({});
    } else {
      setLocalExpenses(prev =>
        prev.map(e => ({ ...e, isHighlighted: e.splits.some(s => !s.isSettled) }))
      );
    }
  }

  function applyLocalPayment(
    from: string, to: string, amount: number, highlightedOnly: boolean
  ) {
    setLocalExpenses(prev => {
      let remaining = round2(amount);
      const eligible: { expenseId: string; splitIdx: number; owed: number }[] = [];
      for (const e of prev) {
        if (highlightedOnly && !e.isHighlighted) continue;
        if (e.paidBy !== to) continue;
        e.splits.forEach((s, i) => {
          const owed = round2(s.share - s.paidAmount);
          if (s.participantId === from && owed > 0.01)
            eligible.push({ expenseId: e.id, splitIdx: i, owed });
        });
      }
      eligible.sort((a, b) => a.owed - b.owed);
      const updated: Record<string, Expense['splits']> = {};
      for (const { expenseId, splitIdx } of eligible) {
        if (remaining < 0.01) break;
        const exp = prev.find(e => e.id === expenseId)!;
        if (!updated[expenseId]) updated[expenseId] = exp.splits.map(s => ({ ...s }));
        const split   = updated[expenseId][splitIdx];
        const owed    = round2(split.share - split.paidAmount);
        const paying  = round2(Math.min(remaining, owed));
        remaining     = round2(remaining - paying);
        const newPaid = round2(split.paidAmount + paying);
        updated[expenseId][splitIdx] = { ...split, paidAmount: newPaid, isSettled: newPaid >= split.share - 0.005 };
      }
      return prev.map(e => updated[e.id] ? { ...e, splits: updated[e.id] } : e);
    });
  }

  function settleDebt(from: string, to: string, amount: number) {
    if (isAuthenticated) {
      void applyPaymentMutation({ from: from as Id<"participants">, to: to as Id<"participants">, amount, highlightedOnly: true });
    } else {
      applyLocalPayment(from, to, amount, true);
    }
  }

  function settleGlobal(from: string, to: string, amount: number) {
    if (isAuthenticated) {
      void applyPaymentMutation({ from: from as Id<"participants">, to: to as Id<"participants">, amount, highlightedOnly: false });
    } else {
      applyLocalPayment(from, to, amount, false);
    }
  }

  // ── Loading state: only show spinner during auth session resolution ─────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <svg className="animate-spin h-6 w-6 text-violet-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 bg-violet-600 rounded-xl">
            <Receipt size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 leading-none">
              BillSplitter
            </h1>
            <p className="text-xs text-gray-400 dark:text-slate-500">Split expenses fairly</p>
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

          {isAuthenticated ? (
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
            >
              <LogOut size={18} />
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95',
                'bg-violet-600 hover:bg-violet-500 text-white'
              )}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Guest banner — shown below header when not authenticated */}
      {!isAuthenticated && <GuestBanner onSignIn={() => setShowAuth(true)} />}

      <OfflineBanner />

      {/* Convex data loading shimmer (authenticated users only) */}
      {convexLoading && (
        <div className="max-w-6xl mx-auto px-4 pt-8 flex justify-center">
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading your data…
          </div>
        </div>
      )}

      <main className={convexLoading ? 'invisible' : undefined} aria-hidden={convexLoading}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-5 lg:col-start-1">
              <div className="order-1">
                <ParticipantInput
                  participants={participants}
                  balances={balances}
                  onAdd={addParticipant}
                  onRemove={removeParticipant}
                />
              </div>
              <div className="order-2">
                <ExpenseForm participants={participants} onAdd={addExpense} />
              </div>
              <div className="order-5">
                <ExpenseList
                  expenses={expenses}
                  participants={participants}
                  onRemove={removeExpense}
                  onToggleHighlight={toggleHighlight}
                  onSelectAllUnsettled={selectAllUnsettled}
                />
              </div>
            </div>
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
                />
              </div>
              <div className="order-6">
                <SelectiveSummary
                  selectedDebts={selectedDebts}
                  participants={participants}
                  highlightedCount={highlighted.length}
                  onSettle={settleDebt}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Auth modal — rendered as overlay, dismissible */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <CurrencyProvider>
      <AppInner />
    </CurrencyProvider>
  );
}
