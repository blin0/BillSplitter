import { useState } from 'react';
import { UserPlus, X, Lock } from 'lucide-react';
import type { Participant } from '../types';
import { cn } from '../lib/cn';
import { round2 } from '../utils/calculations';

interface Props {
  participants: Participant[];
  balances: Record<string, number>;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  /** When true, hides add/remove controls (viewer role). */
  readOnly?: boolean;
}

export default function ParticipantInput({ participants, balances, onAdd, onRemove, readOnly = false }: Props) {
  const [input, setInput] = useState('');

  function handleAdd() {
    const name = input.trim();
    if (!name) return;
    if (participants.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
    onAdd(name);
    setInput('');
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">Group Members</h2>

      {!readOnly && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add a person..."
            className="flex-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 px-3 py-2 text-sm transition-colors focus:outline-none hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/80 focus:border-violet-500 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:focus:ring-violet-500/20"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-all hover:scale-105 active:scale-95"
          >
            <UserPlus size={15} />
            Add
          </button>
        </div>
      )}

      {participants.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-2">No members yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {participants.map(p => {
            // round2 prevents floating-point residuals (e.g. 0.0000001) from blocking deletion
            const balance = round2(balances[p.id] ?? 0);
            const locked  = Math.abs(balance) > 0.01;

            return (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/50 text-sm font-medium px-3 py-1.5 rounded-full"
              >
                {p.name}

                {!readOnly && (locked ? (
                  /* ── Locked state: icon + tooltip ── */
                  <span className="relative group flex items-center">
                    <span className="opacity-40 grayscale cursor-not-allowed flex items-center">
                      <Lock size={13} />
                    </span>
                    {/* Tooltip */}
                    <span
                      className={cn(
                        'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30',
                        'w-52 rounded-lg px-3 py-2 text-xs leading-snug shadow-lg',
                        'bg-white dark:bg-slate-800',
                        'text-slate-900 dark:text-slate-100',
                        'border border-slate-200 dark:border-slate-700',
                        'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
                        'whitespace-normal text-center'
                      )}
                    >
                      Cannot remove member with an active balance. Settle all debts first.
                      {/* Arrow — matches tooltip background */}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-slate-800" />
                    </span>
                  </span>
                ) : (
                  /* ── Unlocked state: normal remove button ── */
                  <button
                    onClick={() => onRemove(p.id)}
                    className="hover:text-violet-900 dark:hover:text-violet-100 transition-all hover:scale-110 active:scale-90"
                    aria-label={`Remove ${p.name}`}
                  >
                    <X size={13} />
                  </button>
                ))}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
