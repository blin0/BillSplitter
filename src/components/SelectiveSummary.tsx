import { useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, X, Check, Highlighter } from 'lucide-react';
import type { Participant, Settlement } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { cn } from '../lib/cn';
import { round2 } from '../utils/calculations';

interface Props {
  selectedDebts: Settlement[];
  participants: Participant[];
  highlightedCount: number;
  onSettle: (from: string, to: string, amount: number) => void;
}

export default function SelectiveSummary({
  selectedDebts,
  participants,
  highlightedCount,
  onSettle,
}: Props) {
  const { formatPrice } = useCurrency();

  // Which row is open for partial-payment input: key = `${from}:${to}`
  const [settling, setSettling] = useState<{ key: string; input: string } | null>(null);

  function nameOf(id: string) {
    return participants.find(p => p.id === id)?.name ?? id;
  }

  function openSettle(from: string, to: string, fullAmount: number) {
    setSettling({ key: `${from}:${to}`, input: String(fullAmount) });
  }

  function confirmSettle(from: string, to: string) {
    if (!settling) return;
    const amount = round2(parseFloat(settling.input) || 0);
    if (amount <= 0) { setSettling(null); return; }
    onSettle(from, to, amount);
    setSettling(null);
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Highlighter size={16} className="text-violet-500 dark:text-violet-400 shrink-0" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">Selected Settlement</h2>
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
        {highlightedCount === 0
          ? 'Click expenses to select them for settlement.'
          : `Based on ${highlightedCount} selected expense${highlightedCount !== 1 ? 's' : ''}.`}
      </p>

      {highlightedCount === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-gray-300 dark:text-slate-600">
          <Highlighter size={28} />
          <p className="text-sm text-gray-400 dark:text-slate-500">No expenses selected</p>
        </div>
      ) : selectedDebts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <CheckCircle2 size={28} className="text-green-400 dark:text-green-500" />
          <p className="text-sm text-gray-400 dark:text-slate-500">All selected expenses are settled!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedDebts.map(s => {
            const key = `${s.from}:${s.to}`;
            const isOpen = settling?.key === key;
            const inputVal = isOpen ? settling!.input : '';
            const parsedInput = round2(parseFloat(inputVal) || 0);
            const isPartial = parsedInput > 0 && parsedInput < s.amount;

            return (
              <div key={key} className="rounded-xl border border-violet-100 dark:border-violet-900/40 overflow-hidden">
                {/* Debt row */}
                <div className="flex items-center gap-3 p-3.5 bg-violet-50 dark:bg-violet-950/20">
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate min-w-0">
                    {nameOf(s.from)}
                  </span>
                  <ArrowRight size={14} className="text-violet-400 dark:text-violet-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate min-w-0 flex-1">
                    {nameOf(s.to)}
                  </span>
                  <span className="text-sm font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/50 px-2.5 py-1 rounded-lg shrink-0">
                    {formatPrice(s.amount)}
                  </span>
                  {!isOpen && (
                    <button
                      onClick={() => openSettle(s.from, s.to, s.amount)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-600 text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-violet-500/20 hover:scale-105 active:scale-95 shrink-0"
                    >
                      <CreditCard size={12} />
                      Settle
                    </button>
                  )}
                </div>

                {/* Partial payment input */}
                {isOpen && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border-t border-violet-100 dark:border-violet-900/40">
                    <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Amount:</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={s.amount}
                      value={settling!.input}
                      onChange={ev => setSettling(prev => prev ? { ...prev, input: ev.target.value } : null)}
                      autoFocus
                      className="flex-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500"
                    />
                    {isPartial && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0 font-medium">partial</span>
                    )}
                    <button
                      onClick={() => confirmSettle(s.from, s.to)}
                      disabled={parsedInput <= 0}
                      className={cn(
                        'p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95',
                        parsedInput > 0
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                      )}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setSettling(null)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all hover:scale-105 active:scale-95"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
