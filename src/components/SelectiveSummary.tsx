import { useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, Highlighter } from 'lucide-react';
import type { Participant, Settlement } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import SettleModal from './SettleModal';

interface Props {
  selectedDebts:    Settlement[];
  participants:     Participant[];
  highlightedCount: number;
  onSettle:         (from: string, to: string, amount: number) => void;
  readOnly?:        boolean;
  groupId?:         string;
  groupName?:       string;
}

export default function SelectiveSummary({
  selectedDebts,
  participants,
  highlightedCount,
  onSettle,
  readOnly  = false,
  groupId,
  groupName,
}: Props) {
  const { formatPrice } = useCurrency();

  type SettlingState = { from: string; to: string; amount: number };
  const [settling, setSettling] = useState<SettlingState | null>(null);

  function nameOf(id: string) {
    return participants.find(p => p.id === id)?.name ?? id;
  }

  function confirmSettle(from: string, to: string, amount: number) {
    onSettle(from, to, amount);
    setSettling(null);
  }

  return (
    <>
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

              return (
                <div key={key} className="rounded-xl border border-violet-100 dark:border-violet-900/40 overflow-hidden">
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
                    {!readOnly && (
                      <button
                        onClick={() => setSettling({ from: s.from, to: s.to, amount: s.amount })}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-600 text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-violet-500/20 hover:scale-105 active:scale-95 shrink-0"
                      >
                        <CreditCard size={12} />
                        Settle
                      </button>
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
          allowPartial={true}
          groupId={groupId}
          groupName={groupName}
          onConfirm={amt => confirmSettle(settling.from, settling.to, amt)}
          onCancel={() => setSettling(null)}
        />
      )}
    </>
  );
}
