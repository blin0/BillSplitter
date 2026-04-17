import { useEffect, useState } from 'react';
import { PlusCircle, Trash2, CheckCircle2, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchActivityLogs, type ActivityEntry, type ActivityActionType } from '../lib/db';
import { cn } from '../lib/cn';

interface Props {
  groupId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '';
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Small auth-user avatar. */
function ActorAvatar({
  name,
  avatarUrl,
}: {
  name: string | null;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? ''}
        className="w-5 h-5 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0 select-none">
      {(name ?? '?')[0].toUpperCase()}
    </span>
  );
}

/**
 * Highlighted payer/member name chip — violet to match the dashboard avatar color.
 * Uses the same violet palette as the participant chips elsewhere in the app.
 */
function PayerChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[11px] font-semibold leading-none">
      {name}
    </span>
  );
}

/** Settlement "to" name — subtle slate chip so it doesn't compete with payer. */
function SecondaryChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold leading-none">
      {name}
    </span>
  );
}

/** Settled / Unsettled status badge. */
function StatusBadge({ settled }: { settled: boolean }) {
  return settled ? (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold leading-none">
      <CheckCircle2 size={9} />
      settled
    </span>
  ) : (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold leading-none">
      unsettled
    </span>
  );
}

/** Action icon. */
function ActionIcon({ type }: { type: ActivityActionType | null }) {
  if (type === 'EXPENSE_ADDED')
    return <PlusCircle   size={11} className="shrink-0 text-violet-500 dark:text-violet-400" />;
  if (type === 'EXPENSE_DELETED')
    return <Trash2       size={11} className="shrink-0 text-red-400 dark:text-red-500" />;
  if (type === 'SETTLEMENT_MADE')
    return <CheckCircle2 size={11} className="shrink-0 text-green-500 dark:text-green-400" />;
  return   <Activity    size={11} className="shrink-0 text-slate-400 dark:text-slate-500" />;
}

// ─── Row renderer ─────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: ActivityEntry }) {
  const actorName  = entry.actorProfile?.fullName ?? 'Someone';
  const payerName  = entry.participantName;

  // For settlements: parse "to" name from message "settled for Brian → Alice"
  const toName = (() => {
    if (entry.actionType !== 'SETTLEMENT_MADE') return null;
    const m = entry.message.match(/→ (.+)$/);
    return m?.[1]?.trim() ?? null;
  })();

  return (
    <li className="flex items-start gap-2.5 py-2.5 border-b border-gray-50 dark:border-slate-800/60 last:border-0">

      {/* Auth-user avatar */}
      <ActorAvatar name={actorName} avatarUrl={entry.actorProfile?.avatarUrl} />

      <div className="flex-1 min-w-0 space-y-1">

        {/* ── Primary line: expense-focused story ── */}
        {entry.actionType === 'EXPENSE_ADDED' && (
          <p className="flex items-center gap-1 flex-wrap leading-snug">
            <span className="text-[12px] font-semibold text-gray-800 dark:text-slate-100">
              &ldquo;{entry.message}&rdquo;
            </span>
            <span className="text-[11px] text-gray-400 dark:text-slate-500">
              ({formatAmount(entry.amount)})
            </span>
            <span className="text-[11px] text-gray-500 dark:text-slate-400">paid by</span>
            {payerName
              ? <PayerChip name={payerName} />
              : <span className="text-[11px] text-gray-500 dark:text-slate-400">—</span>
            }
          </p>
        )}

        {entry.actionType === 'EXPENSE_DELETED' && (
          <div className="space-y-0.5">
            <p className="flex items-center gap-1 flex-wrap leading-snug">
              <span className="text-[11px] text-red-500 dark:text-red-400 font-medium">Deleted</span>
              {entry.isSettled != null && <StatusBadge settled={entry.isSettled} />}
              <span className="text-[11px] text-gray-400 dark:text-slate-500">expense:</span>
            </p>
            <p className="flex items-center gap-1 flex-wrap leading-snug">
              <span className={cn(
                'text-[12px] font-semibold',
                'text-gray-500 dark:text-slate-400 line-through decoration-red-400/70',
              )}>
                &ldquo;{entry.message}&rdquo;
              </span>
              <span className="text-[11px] text-gray-400 dark:text-slate-500">
                ({formatAmount(entry.amount)})
              </span>
              <span className="text-[11px] text-gray-500 dark:text-slate-400">paid by</span>
              {payerName
                ? <PayerChip name={payerName} />
                : <span className="text-[11px] text-gray-500 dark:text-slate-400">—</span>
              }
            </p>
          </div>
        )}

        {entry.actionType === 'SETTLEMENT_MADE' && (
          <p className="flex items-center gap-1 flex-wrap leading-snug">
            {payerName && <PayerChip name={payerName} />}
            <span className="text-[11px] text-gray-500 dark:text-slate-400">paid</span>
            {toName && <SecondaryChip name={toName} />}
            {entry.amount != null && (
              <span className="text-[11px] font-bold text-green-600 dark:text-green-400">
                {formatAmount(entry.amount)}
              </span>
            )}
          </p>
        )}

        {!entry.actionType && (
          <p className="text-[11px] text-gray-600 dark:text-slate-300">{entry.message}</p>
        )}

        {/* ── Secondary line: who triggered it + timestamp ── */}
        <div className="flex items-center gap-1.5">
          <ActionIcon type={entry.actionType} />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            by <span className="font-medium">{actorName}</span>
          </span>
          <span className="text-[10px] text-gray-300 dark:text-slate-600">·</span>
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            {relativeTime(entry.createdAt)}
          </span>
        </div>

      </div>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivityLog({ groupId }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActivityLogs(groupId).then(({ data }) => {
      if (cancelled) return;
      setEntries(data ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [groupId]);

  useEffect(() => {
    const channel = supabase
      .channel(`activity-log:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `group_id=eq.${groupId}` },
        () => {
          fetchActivityLogs(groupId).then(({ data }) => {
            if (data) setEntries(data);
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-0.5">
        <Activity size={15} className="text-violet-500 dark:text-violet-400 shrink-0" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100 tracking-wide">
          Activity
        </h2>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-3">
        Last 10 actions in this group
      </p>

      {loading ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">No activity yet.</p>
      ) : (
        <ul>
          {entries.map(entry => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
