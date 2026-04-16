import { Trash2, Info, CheckCircle2, MousePointerClick, ListChecks } from 'lucide-react';
import type { Expense, Participant } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { round2 } from '../utils/calculations';
import { cn } from '../lib/cn';

interface Props {
  expenses: Expense[];
  participants: Participant[];
  onRemove: (id: string) => void;
  onToggleHighlight: (id: string) => void;
  onSelectAllUnsettled: () => void;
  readOnly?: boolean;
}

export default function ExpenseList({
  expenses,
  participants,
  onRemove,
  onToggleHighlight,
  onSelectAllUnsettled,
  readOnly = false,
}: Props) {
  const { formatPrice, currency } = useCurrency();

  function nameOf(id: string) {
    return participants.find(p => p.id === id)?.name ?? id;
  }

  function isFullySettled(e: Expense) {
    return e.splits.every(s => s.isSettled);
  }

  function settledCount(e: Expense) {
    return e.splits.filter(s => s.isSettled).length;
  }

  // Unsettled/partial on top (newest first), fully settled at bottom (newest first)
  const unsettled = [...expenses].filter(e => !isFullySettled(e)).reverse();
  const settled   = [...expenses].filter(e => isFullySettled(e)).reverse();
  const sorted    = [...unsettled, ...settled];

  const hasUnsettled = unsettled.length > 0;

  if (expenses.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2">Expenses</h2>
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">No expenses yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">Expenses</h2>
        {hasUnsettled && (
          <button
            onClick={onSelectAllUnsettled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800 transition-all hover:scale-105 active:scale-95"
          >
            <ListChecks size={13} />
            Select All Unsettled
          </button>
        )}
      </div>

      {!hasUnsettled && expenses.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/40">
          <CheckCircle2 size={14} className="text-green-500 dark:text-green-400 shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-300 font-medium">All expenses are settled!</p>
        </div>
      )}

      {hasUnsettled && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 mb-3">
          <MousePointerClick size={12} />
          Click a card to select it for settlement
        </p>
      )}

      <div className="space-y-2">
        {sorted.map(e => {
          const fullySettled = isFullySettled(e);
          const isForeign    = e.sourceCurrency !== currency;
          const invertedRate = e.lockedRate > 0 ? round2(1 / e.lockedRate) : 0;
          const partialCount = settledCount(e);
          const totalSplits  = e.splits.length;
          const isPartial    = !fullySettled && partialCount > 0;

          return (
            <div
              key={e.id}
              onClick={() => !fullySettled && onToggleHighlight(e.id)}
              className={cn(
                'p-3 rounded-xl border transition-all',
                fullySettled
                  ? 'opacity-60 bg-gray-50 dark:bg-slate-800/30 border-gray-100 dark:border-slate-700/40 cursor-default'
                  : e.isHighlighted
                    ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-500 dark:border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.2)] cursor-pointer'
                    : 'bg-gray-50 dark:bg-slate-800/50 border-transparent dark:border-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer hover:border-gray-200 dark:hover:border-slate-600'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn(
                      'text-sm font-medium truncate',
                      fullySettled ? 'text-gray-500 dark:text-slate-400' : 'text-gray-800 dark:text-slate-200'
                    )}>
                      {e.description}
                    </p>
                    {fullySettled && (
                      <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={11} />
                        Settled
                      </span>
                    )}
                    {isPartial && (
                      <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                        {partialCount}/{totalSplits} paid
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Paid by{' '}
                    <span className="text-violet-600 dark:text-violet-400 font-medium">{nameOf(e.paidBy)}</span>
                    {' · '}
                    <span className="capitalize">
                      {e.splitType === 'equally' ? 'equal split' : 'manual split'}
                    </span>
                    {' · '}
                    <span>{e.involvedParticipants.map(nameOf).join(', ')}</span>
                  </p>
                  {/* Tax / tip breakdown line */}
                  {(e.taxPercent || e.tipSourceAmount) && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {e.sourceAmount} {e.sourceCurrency} subtotal
                      {e.taxPercent ? <span> · <span className="text-amber-500 dark:text-amber-400">{e.taxPercent}% tax</span></span> : null}
                      {e.tipSourceAmount ? <span> · <span className="text-teal-500 dark:text-teal-400">{e.tipSourceAmount} {e.sourceCurrency} tip</span></span> : null}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <div className="text-right">
                    <span className={cn(
                      'text-sm font-semibold',
                      fullySettled ? 'text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'
                    )}>
                      {formatPrice(e.totalAmount)}
                    </span>
                    {isForeign && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {e.sourceAmount} {e.sourceCurrency}
                      </p>
                    )}
                  </div>

                  {isForeign && (
                    <div className="relative group" onClick={ev => ev.stopPropagation()}>
                      <Info size={14} className="text-blue-400 dark:text-blue-500 cursor-help shrink-0" />
                      <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-20 pointer-events-none">
                        <div className="bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                          <p className="font-semibold mb-0.5">Rate locked at save time</p>
                          <p>1 {currency} = {invertedRate} {e.sourceCurrency}</p>
                          <p>1 {e.sourceCurrency} = {e.lockedRate.toFixed(6)} {currency}</p>
                        </div>
                        <div className="w-2 h-2 bg-gray-900 dark:bg-slate-700 rotate-45 ml-auto mr-1 -mt-1" />
                      </div>
                    </div>
                  )}

                  {!readOnly && (
                    <button
                      onClick={ev => { ev.stopPropagation(); onRemove(e.id); }}
                      className="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110 active:scale-90"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
