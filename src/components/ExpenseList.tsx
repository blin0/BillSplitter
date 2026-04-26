import { useState } from 'react';
import { Trash2, Info, CheckCircle2, MousePointerClick, ListChecks, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  function nameOf(id: string) {
    return participants.find(p => p.id === id)?.name ?? id;
  }

  function isFullySettled(e: Expense) {
    return e.splits.every(s => s.isSettled);
  }

  function settledCount(e: Expense) {
    return e.splits.filter(s => s.isSettled).length;
  }

  const unsettled = [...expenses].filter(e => !isFullySettled(e)).reverse();
  const settled   = [...expenses].filter(e => isFullySettled(e)).reverse();
  const sorted    = [...unsettled, ...settled];

  const hasUnsettled = unsettled.length > 0;

  const q = query.trim().toLowerCase();
  const visible = q
    ? sorted.filter(e =>
        e.description.toLowerCase().includes(q) ||
        nameOf(e.paidBy).toLowerCase().includes(q) ||
        e.involvedParticipants.some(id => nameOf(id).toLowerCase().includes(q))
      )
    : sorted;

  if (expenses.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2">{t('expenseList.title')}</h2>
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">{t('expenseList.noExpenses')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">{t('expenseList.title')}</h2>
        {hasUnsettled && (
          <button
            onClick={onSelectAllUnsettled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800 transition-all hover:scale-105 active:scale-95"
          >
            <ListChecks size={13} />
            {t('expenseList.selectAllUnsettled')}
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
        <input
          type="text"
          name="expense-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('expenseList.searchPlaceholder')}
          className="w-full pl-8 pr-8 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500 focus:border-transparent transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {!hasUnsettled && expenses.length > 0 && !query && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/40">
          <CheckCircle2 size={14} className="text-green-500 dark:text-green-400 shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-300 font-medium">{t('expenseList.allSettled')}</p>
        </div>
      )}

      {hasUnsettled && !query && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 mb-3">
          <MousePointerClick size={12} />
          {t('expenseList.clickToSelect')}
        </p>
      )}

      {visible.length === 0 && q && (
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">
          {t('expenseList.noMatch', { query })}
        </p>
      )}

      <div className="space-y-2">
        {visible.map(e => {
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
                        {t('settlement.settled')}
                      </span>
                    )}
                    {isPartial && (
                      <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                        {t('expenseList.partialPaid', { count: partialCount, total: totalSplits })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {t('expenseList.paidBy')}{' '}
                    <span className="text-violet-600 dark:text-violet-400 font-medium">{nameOf(e.paidBy)}</span>
                    {' · '}
                    <span>
                      {e.splitType === 'equally' ? t('expenseList.equalSplit') : t('expenseList.manualSplit')}
                    </span>
                    {' · '}
                    <span>{e.involvedParticipants.map(nameOf).join(', ')}</span>
                  </p>
                  {(e.taxPercent || e.tipSourceAmount) && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {e.sourceAmount} {e.sourceCurrency} {t('expenseList.subtotal')}
                      {e.taxPercent ? <span> · <span className="text-amber-500 dark:text-amber-400">{e.taxPercent}% {t('expense.tax')}</span></span> : null}
                      {e.tipSourceAmount ? <span> · <span className="text-teal-500 dark:text-teal-400">{e.tipSourceAmount} {e.sourceCurrency} {t('expense.tip')}</span></span> : null}
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
                          <p className="font-semibold mb-0.5">{t('expenseList.rateLockedTitle')}</p>
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
