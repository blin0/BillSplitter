import { useState, useEffect } from 'react';
import { Receipt, Sun, Moon } from 'lucide-react';
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
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light');
      } catch (_) { /* blocked in some private-browsing contexts */ }
      return next;
    });
  }

  return { dark, mounted, toggle };
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppInner() {
  const [participants, setParticipants] = useState<Participant[]>(() =>
    loadJson<Participant[]>('billsplitter_participants', [])
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    loadJson<Expense[]>('billsplitter_expenses', [])
  );
  const { dark, mounted, toggle } = useTheme();

  // Persist on every change
  useEffect(() => {
    try { localStorage.setItem('billsplitter_participants', JSON.stringify(participants)); } catch (_) {}
  }, [participants]);

  useEffect(() => {
    try { localStorage.setItem('billsplitter_expenses', JSON.stringify(expenses)); } catch (_) {}
  }, [expenses]);

  // ── Participant handlers ───────────────────────────────────────────────────
  function addParticipant(name: string) {
    setParticipants(prev => [...prev, { id: makeId(), name }]);
  }

  function removeParticipant(id: string) {
    // Safety guard: round2 prevents tiny floating-point residuals from blocking valid deletions
    if (Math.abs(round2(balances[id] ?? 0)) > 0.01) return;
    setParticipants(prev => prev.filter(p => p.id !== id));
    setExpenses(prev => prev.filter(e => e.paidBy !== id));
  }

  // ── Expense handlers ───────────────────────────────────────────────────────
  function addExpense(expense: Expense) {
    setExpenses(prev => [...prev, expense]);
  }

  function removeExpense(id: string) {
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  function toggleHighlight(id: string) {
    setExpenses(prev =>
      prev.map(e => e.id === id ? { ...e, isHighlighted: !e.isHighlighted } : e)
    );
  }

  function selectAllUnsettled() {
    setExpenses(prev =>
      prev.map(e => ({
        ...e,
        isHighlighted: e.splits.some(s => !s.isSettled),
      }))
    );
  }

  /**
   * Pure helper: distribute `paymentAmount` from `from` to `to` across expenses.
   * When `highlightedOnly` is true only highlighted expenses are touched (selective panel).
   * When false, all expenses are eligible (global settlement).
   */
  function applyPayment(
    expenses: Expense[],
    from: string,
    to: string,
    paymentAmount: number,
    highlightedOnly: boolean,
  ): Expense[] {
    let remaining = round2(paymentAmount);

    if (highlightedOnly) {
      // ── Selective path: "smallest outstanding first" greedy strategy ──────
      // Collect references to all eligible splits across highlighted expenses,
      // sorted ascending by outstanding amount so partial payments clear the
      // maximum number of individual line items.
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
      // Sort ascending — smallest debt first
      eligible.sort((a, b) => a.owed - b.owed);

      // Build a mutable map of updated splits keyed by expenseId
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
          isSettled: newPaid >= split.share - 0.005,
        };
      }

      return expenses.map(e =>
        updated[e.id] ? { ...e, splits: updated[e.id] } : e
      );
    }

    // ── Global path: insertion-order traversal (unchanged) ───────────────
    return expenses.map(expense => {
      if (expense.paidBy !== to || remaining < 0.01) return expense;
      const splits = expense.splits.map(split => {
        if (split.participantId !== from || split.isSettled || remaining < 0.01) return split;
        const owed       = round2(split.share - split.paidAmount);
        if (owed < 0.01) return split;
        const applying   = round2(Math.min(remaining, owed));
        remaining        = round2(remaining - applying);
        const newPaid    = round2(split.paidAmount + applying);
        const newSettled = newPaid >= split.share - 0.005;
        return { ...split, paidAmount: newPaid, isSettled: newSettled };
      });
      return { ...expense, splits };
    });
  }

  /** Selective: only touches highlighted expenses. */
  function settleDebt(from: string, to: string, paymentAmount: number) {
    setExpenses(prev => applyPayment(prev, from, to, paymentAmount, true));
  }

  /** Global: wipes the full net debt across all expenses regardless of highlight. */
  function settleGlobal(from: string, to: string, paymentAmount: number) {
    setExpenses(prev => applyPayment(prev, from, to, paymentAmount, false));
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const balances        = computeBalances(participants, expenses);
  const settlements     = simplifyDebts(balances);
  const total           = totalSpending(expenses);
  const highlighted     = expenses.filter(e => e.isHighlighted);
  const selectedDebts   = computeSelectedDebts(highlighted);

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
        </div>
      </header>

      <OfflineBanner />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/*
          Desktop (lg): 2 columns
            Left:  Members → Add Expense → Expenses
            Right: Summary → Settlement Advice → Selected Settlement

          Mobile (single column) logical order via `order-`:
            1 Members, 2 Add Expense, 3 Summary, 4 Settlement Advice,
            5 Expenses, 6 Selected Settlement
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Left column ── */}
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
              <ExpenseForm
                participants={participants}
                onAdd={addExpense}
              />
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
            {/* Settlement Advice — middle-right (below Summary) */}
            <div className="order-4">
              <SettlementAdvice
                settlements={settlements}
                participants={participants}
                onSettle={settleGlobal}
              />
            </div>
            {/* Selected Settlement — bottom-right (across from Expenses) */}
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
      </main>
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
