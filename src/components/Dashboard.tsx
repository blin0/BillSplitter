import { TrendingDown, TrendingUp, Minus, Wallet, Info, Percent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Expense, Participant, Settlement } from '../types';
import { cn } from '../lib/cn';
import { useCurrency } from '../context/CurrencyContext';
import { round2 } from '../utils/calculations';

interface Props {
  participants: Participant[];
  balances: Record<string, number>;
  totalSpending: number;
  settlements: Settlement[];
  expenses: Expense[];
}

// ── Category detection ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: { key: string; words: string[] }[] = [
  { key: 'food',      words: ['dinner','lunch','breakfast','coffee','drinks','bar','restaurant','cafe','food','meal','snack','pizza','sushi','burger','wine','beer','tea','boba'] },
  { key: 'transport', words: ['taxi','uber','lyft','rideshare','gas','fuel','bus','train','metro','flight','car','parking','toll'] },
  { key: 'living',    words: ['rent','utilities','electric','water','internet','wifi','grocery','groceries','supermarket','household'] },
  { key: 'fun',       words: ['movie','cinema','concert','ticket','show','event','museum','park','game','sport','gym','bowling'] },
  { key: 'travel',    words: ['hotel','airbnb','hostel','flight','trip','travel','vacation','tour','entrance'] },
  { key: 'shopping',  words: ['shopping','clothes','amazon','gift','present','store','mall'] },
];

function categorise(description: string): string {
  const lower = description.toLowerCase();
  for (const { key, words } of CATEGORY_KEYWORDS) {
    if (words.some(w => lower.includes(w))) return key;
  }
  return 'other';
}

function topCategories(expenses: Expense[]): { key: string; pct: number }[] {
  if (expenses.length === 0) return [];
  const totals: Record<string, number> = {};
  let grand = 0;
  for (const e of expenses) {
    const cat = categorise(e.description);
    totals[cat] = round2((totals[cat] ?? 0) + e.totalAmount);
    grand = round2(grand + e.totalAmount);
  }
  if (grand === 0) return [];
  return Object.entries(totals)
    .map(([key, amt]) => ({ key, pct: Math.round((amt / grand) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);
}

// ── Tax tracked computation ───────────────────────────────────────────────────

function computeTaxTracked(expenses: Expense[]): { totalTax: number; count: number } {
  let totalTax = 0;
  let count    = 0;
  for (const e of expenses) {
    if (!e.taxPercent || e.taxPercent <= 0) continue;
    const tipBase  = e.tipSourceAmount != null ? round2(e.tipSourceAmount * e.lockedRate) : 0;
    const taxable  = round2(e.totalAmount - tipBase);
    const taxAmt   = round2(taxable * e.taxPercent / (100 + e.taxPercent));
    totalTax = round2(totalTax + taxAmt);
    count++;
  }
  return { totalTax, count };
}

// ── Tooltip surface ───────────────────────────────────────────────────────────

const TOOLTIP_BASE = [
  'absolute z-30 w-56 rounded-xl border shadow-2xl shadow-black/10',
  'bg-white dark:bg-slate-900',
  'border-slate-200 dark:border-slate-700',
  'text-slate-700 dark:text-slate-100 text-xs leading-snug',
  'pointer-events-none',
  // fade + slide in
  'opacity-0 group-hover:opacity-100',
  'translate-y-1 group-hover:translate-y-0',
  'transition-all duration-200 ease-out',
].join(' ');

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard({ participants, balances, totalSpending, settlements, expenses }: Props) {
  const { formatPrice } = useCurrency();
  const { t } = useTranslation();

  function nameOf(id: string) {
    return participants.find(p => p.id === id)?.name ?? id;
  }

  const cats       = topCategories(expenses);
  const taxTracked = computeTaxTracked(expenses);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">{t('dashboard.title')}</h2>

      {/* ── Total spending card ── */}
      <div className="relative group mb-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/30 cursor-help">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/60 rounded-lg">
            <Wallet size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-violet-500 dark:text-violet-400 font-medium uppercase tracking-wide">{t('dashboard.totalSpending')}</p>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{formatPrice(totalSpending)}</p>
          </div>
          <Info size={14} className="text-violet-400 dark:text-violet-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Spending tooltip — category breakdown */}
        {cats.length > 0 && (
          <div className={cn(TOOLTIP_BASE, 'right-0 top-full mt-2 p-3')}>
            <p className="font-semibold text-slate-900 dark:text-slate-200 mb-2">{t('dashboard.topCategories')}</p>
            <div className="space-y-1.5">
              {cats.map(c => (
                <div key={c.key}>
                  <div className="flex justify-between text-slate-900 dark:text-slate-300 mb-0.5">
                    <span>{t(`dashboard.cat.${c.key}`)}</span>
                    <span className="font-semibold">{c.pct}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-600"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Tax Tracked bento card ── */}
      {taxTracked.count > 0 && (
        <div className="flex items-center gap-3 p-3.5 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
          <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-lg shrink-0">
            <Percent size={14} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{t('dashboard.taxTracked')}</p>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{formatPrice(taxTracked.totalTax)}</p>
          </div>
          <p className="text-[11px] text-emerald-500 dark:text-emerald-500 shrink-0 text-right leading-snug">
            {t('dashboard.across')}<br />{taxTracked.count} {t(taxTracked.count !== 1 ? 'dashboard.expense_other' : 'dashboard.expense_one')}
          </p>
        </div>
      )}

      {/* ── Per-participant balance rows ── */}
      {participants.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-2">{t('dashboard.noMembers')}</p>
      ) : (
        <div className="space-y-1.5">
          {participants.map((p, idx) => {
            const bal    = round2(balances[p.id] ?? 0);
            const isOwed = bal > 0.01;
            const owes   = bal < -0.01;
            const isLast = idx >= participants.length - 2; // flip tooltip up for bottom rows

            // Who this person owes (they are `from` in a settlement)
            const owesTo = settlements.filter(s => s.from === p.id);
            // Who owes this person (they are `to` in a settlement)
            const owedBy = settlements.filter(s => s.to === p.id);

            const smartText = isOwed
              ? t('dashboard.isOwed',      { name: p.name, amount: formatPrice(bal) })
              : owes
                ? t('dashboard.needsToPay', { name: p.name, amount: formatPrice(Math.abs(bal)) })
                : t('dashboard.allSettled', { name: p.name });

            return (
              <div
                key={p.id}
                className="relative group flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-transparent dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-help"
              >
                {/* Left: avatar + name */}
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    isOwed ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                           : owes ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                           : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                  )}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{nameOf(p.id)}</span>
                </div>

                {/* Right: amount + icon */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {isOwed ? (
                      <TrendingUp size={14} className="text-green-500 dark:text-green-400" />
                    ) : owes ? (
                      <TrendingDown size={14} className="text-red-500 dark:text-red-400" />
                    ) : (
                      <Minus size={14} className="text-gray-400 dark:text-slate-500" />
                    )}
                    <span className={cn(
                      'text-sm font-semibold',
                      isOwed ? 'text-green-600 dark:text-green-400'
                             : owes ? 'text-red-500 dark:text-red-400'
                             : 'text-gray-400 dark:text-slate-500'
                    )}>
                      {isOwed ? '+' : ''}{formatPrice(Math.abs(bal))}
                    </span>
                  </div>
                  <Info
                    size={13}
                    className="text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  />
                </div>

                {/* ── Balance tooltip ── */}
                <div className={cn(
                  TOOLTIP_BASE,
                  'right-0 p-3',
                  isLast ? 'bottom-full mb-2' : 'top-full mt-2'
                )}>
                  {/* Header */}
                  <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{p.name}{t('dashboard.balanceDetails')}</p>

                  {/* Owes section */}
                  {owesTo.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-red-400 font-semibold mb-1">{t('dashboard.owes')}</p>
                      {owesTo.map(s => (
                        <div key={s.to} className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>→ {nameOf(s.to)}</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">{formatPrice(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Owed-by section */}
                  {owedBy.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-green-400 font-semibold mb-1">{t('dashboard.owedBy')}</p>
                      {owedBy.map(s => (
                        <div key={s.from} className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>← {nameOf(s.from)}</span>
                          <span className="font-semibold text-emerald-600 dark:text-green-400">{formatPrice(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Divider + smart net line */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
                    <p className={cn(
                      'text-[11px] leading-snug',
                      isOwed ? 'text-emerald-600 dark:text-green-300' : owes ? 'text-red-600 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'
                    )}>
                      {smartText}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
