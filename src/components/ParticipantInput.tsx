import { useState } from 'react';
import { UserPlus, X, Lock, UserCheck, Link2, Link2Off } from 'lucide-react';
import type { Participant } from '../types';
import { cn } from '../lib/cn';
import { round2 } from '../utils/calculations';
import { useTranslation } from 'react-i18next';

interface Props {
  participants:   Participant[];
  balances:       Record<string, number>;
  onAdd:          (name: string) => void;
  onRemove:       (id: string) => void;
  /** When true, hides add/remove controls (viewer role). */
  readOnly?:      boolean;
  /** ID of the named_participant the current user has claimed as "me". */
  linkedMemberId?: string | null;
  /** Called with the participant id the user wants to link as themselves. */
  onLink?:        (memberId: string) => void;
  /** Called to remove the current user's identity link for this group. */
  onUnlink?:      () => void;
  /** When false, the "This is me" feature is unavailable (guest mode). */
  identityEnabled?: boolean;
}

export default function ParticipantInput({
  participants,
  balances,
  onAdd,
  onRemove,
  readOnly = false,
  linkedMemberId = null,
  onLink,
  onUnlink,
  identityEnabled = false,
}: Props) {
  const [input, setInput] = useState('');
  const [pendingLinkId, setPendingLinkId] = useState<string | null>(null);
  const { t } = useTranslation();

  function handleAdd() {
    const name = input.trim();
    if (!name) return;
    if (participants.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
    onAdd(name);
    setInput('');
  }

  function confirmLink() {
    if (!pendingLinkId || !onLink) return;
    onLink(pendingLinkId);
    setPendingLinkId(null);
  }

  const pendingName = participants.find(p => p.id === pendingLinkId)?.name ?? '';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">{t('members.title')}</h2>

      {!readOnly && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            name="participant-name"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={t('members.addPlaceholder')}
            className="flex-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 px-3 py-2 text-sm transition-colors focus:outline-none hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/80 focus:border-violet-500 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:focus:ring-violet-500/20"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-all hover:scale-105 active:scale-95"
          >
            <UserPlus size={15} />
            {t('members.add')}
          </button>
        </div>
      )}

      {participants.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-2">{t('members.noMembers')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {participants.map(p => {
            // round2 prevents floating-point residuals (e.g. 0.0000001) from blocking deletion
            const balance   = round2(balances[p.id] ?? 0);
            const locked    = Math.abs(balance) > 0.01;
            const isLinked  = identityEnabled && linkedMemberId === p.id;

            return (
              <span
                key={p.id}
                className={cn(
                  'inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border',
                  isLinked
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900/50',
                )}
              >
                {isLinked && <UserCheck size={12} className="shrink-0" />}
                {p.name}

                {/* ── "This is me" / "Unlink" button (identity feature) ── */}
                {identityEnabled && (
                  isLinked ? (
                    <button
                      onClick={() => onUnlink?.()}
                      title="Unlink your identity from this member"
                      className="hover:text-emerald-900 dark:hover:text-emerald-100 transition-all hover:scale-110 active:scale-90"
                      aria-label={`Unlink ${p.name}`}
                    >
                      <Link2Off size={12} />
                    </button>
                  ) : linkedMemberId == null ? (
                    <button
                      onClick={() => setPendingLinkId(p.id)}
                      title="This is me"
                      className="opacity-40 hover:opacity-100 transition-all hover:scale-110 active:scale-90"
                      aria-label={`Identify as ${p.name}`}
                    >
                      <Link2 size={12} />
                    </button>
                  ) : null
                )}

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
                      {t('members.cannotRemove')}
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

      {/* ── Confirm-link modal ── */}
      {pendingLinkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                <UserCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                Identify as {pendingName}?
              </h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-6">
              Linking this member will aggregate their spending into your{' '}
              <span className="font-medium text-gray-700 dark:text-slate-300">Personal Analytics</span>.
              You can only link one person per group. You can unlink at any time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingLinkId(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLink}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95"
              >
                Yes, this is me
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
