import { useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, X } from 'lucide-react';
import type { Participant, Settlement } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { cn } from '../lib/cn';

interface Props {
  settlements: Settlement[];
  participants: Participant[];
  onSettle: (from: string, to: string, amount: number) => void;
  readOnly?: boolean;
}

export default function SettlementAdvice({ settlements, participants, onSettle, readOnly = false }: Props) {
  const { formatPrice } = useCurrency();

  // Key of row currently awaiting confirmation: `${from}:${to}`
  const [confirming, setConfirming] = useState<string | null>(null);
  // Key of row that just got settled — shows green flash before disappearing
  const [settled, setSettled] = useState<string | null>(null);

  function nameOf(id: string) {
    return participants.find(p => p.id === id)?.name ?? id;
  }

  function confirmSettle(s: Settlement) {
    const key = `${s.from}:${s.to}`;
    setConfirming(null);
    setSettled(key);
    onSettle(s.from, s.to, s.amount);
    // Clear the flash after the CSS transition completes
    setTimeout(() => setSettled(null), 600);
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">Settlement Advice</h2>

      {settlements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-gray-400 dark:text-slate-500">
          <CheckCircle2 size={32} className="text-green-400 dark:text-green-500" />
          <p className="text-sm">Everyone is settled up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {settlements.map(s => {
            const key        = `${s.from}:${s.to}`;
            const isConfirming = confirming === key;
            const isSettled  = settled === key;

            return (
              <div key={key} className="rounded-xl border border-amber-100 dark:border-amber-900/40 overflow-hidden">
                {/* ── Debt row ── */}
                <div className={cn(
                  'flex items-center gap-3 p-3.5 transition-colors duration-500',
                  isSettled
                    ? 'bg-green-50 dark:bg-green-950/30'
                    : 'bg-amber-50 dark:bg-amber-950/30'
                )}>
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate min-w-0">
                    {nameOf(s.from)}
                  </span>
                  <ArrowRight size={15} className={cn(
                    'shrink-0 transition-colors duration-500',
                    isSettled ? 'text-green-500 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'
                  )} />
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate min-w-0 flex-1">
                    {nameOf(s.to)}
                  </span>
                  <span className={cn(
                    'text-sm font-bold px-2.5 py-1 rounded-lg shrink-0 transition-colors duration-500',
                    isSettled
                      ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50'
                      : 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50'
                  )}>
                    {formatPrice(s.amount)}
                  </span>

                  {!isConfirming && !isSettled && !readOnly && (
                    <button
                      onClick={() => setConfirming(key)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all hover:brightness-110 hover:shadow-lg hover:shadow-amber-500/20 hover:scale-105 active:scale-95 shrink-0"
                    >
                      <CreditCard size={12} />
                      Settle
                    </button>
                  )}

                  {isSettled && (
                    <CheckCircle2 size={16} className="text-green-500 dark:text-green-400 shrink-0" />
                  )}
                </div>

                {/* ── Confirmation banner ── */}
                {isConfirming && !readOnly && (
                  <div className="flex items-start gap-3 px-3.5 py-3 bg-white dark:bg-slate-800 border-t border-amber-100 dark:border-amber-900/40">
                    <p className="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-snug">
                      Confirm{' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{nameOf(s.from)}</span>
                      {' '}pays{' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{nameOf(s.to)}</span>
                      {' '}{formatPrice(s.amount)}? This will mark all shared bills between them as settled.
                    </p>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => confirmSettle(s)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-amber-500/20 hover:scale-105 active:scale-95"
                      >
                        <CheckCircle2 size={12} />
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all hover:scale-105 active:scale-95"
                      >
                        <X size={13} />
                      </button>
                    </div>
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
