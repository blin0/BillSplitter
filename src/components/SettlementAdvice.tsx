import { useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard } from 'lucide-react';
import type { Participant, Settlement } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { cn } from '../lib/cn';
import SettleModal from './SettleModal';
import { useTranslation } from 'react-i18next';

interface Props {
  settlements:  Settlement[];
  participants: Participant[];
  onSettle:     (from: string, to: string, amount: number) => void;
  readOnly?:    boolean;
  groupId?:     string;
  groupName?:   string;
}

export default function SettlementAdvice({
  settlements,
  participants,
  onSettle,
  readOnly  = false,
  groupId,
  groupName,
}: Props) {
  const { formatPrice } = useCurrency();
  const { t } = useTranslation();

  type SettlingState = { from: string; to: string; amount: number };
  const [settling, setSettling] = useState<SettlingState | null>(null);
  const [settled,  setSettled ] = useState<string | null>(null);

  function nameOf(id: string) {
    return participants.find(p => p.id === id)?.name ?? id;
  }

  function confirmSettle(from: string, to: string, amount: number) {
    const key = `${from}:${to}`;
    setSettling(null);
    setSettled(key);
    onSettle(from, to, amount);
    setTimeout(() => setSettled(null), 600);
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">{t('settlement.adviceTitle')}</h2>

        {settlements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-gray-400 dark:text-slate-500">
            <CheckCircle2 size={32} className="text-green-400 dark:text-green-500" />
            <p className="text-sm">{t('settlement.allSettledUp')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {settlements.map(s => {
              const key       = `${s.from}:${s.to}`;
              const isSettled = settled === key;

              return (
                <div key={key} className="rounded-xl border border-amber-100 dark:border-amber-900/40 overflow-hidden">
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

                    {!isSettled && !readOnly && (
                      <button
                        onClick={() => setSettling({ from: s.from, to: s.to, amount: s.amount })}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all hover:brightness-110 hover:shadow-lg hover:shadow-amber-500/20 hover:scale-105 active:scale-95 shrink-0"
                      >
                        <CreditCard size={12} />
                        {t('settlement.settle')}
                      </button>
                    )}

                    {isSettled && (
                      <CheckCircle2 size={16} className="text-green-500 dark:text-green-400 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settle modal */}
      {settling && (
        <SettleModal
          fromName={nameOf(settling.from)}
          toName={nameOf(settling.to)}
          amount={settling.amount}
          allowPartial={false}
          groupId={groupId}
          groupName={groupName}
          onConfirm={amt => confirmSettle(settling.from, settling.to, amt)}
          onCancel={() => setSettling(null)}
        />
      )}
    </>
  );
}
