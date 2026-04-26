import { useEffect, useState } from 'react';
import { PlusCircle, Trash2, CheckCircle2, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { fetchActivityLogs, type ActivityEntry, type ActivityActionType } from '../lib/db';
import { cn } from '../lib/cn';

interface Props {
  groupId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function relativeTime(iso: string, t: TFunc): string {
  const then  = new Date(iso);
  const now   = new Date();
  const diff  = now.getTime() - then.getTime();
  const s     = Math.floor(diff / 1000);

  if (s < 10)  return t('activity.justNow');
  if (s < 60)  return t('activity.secondsAgo', { count: s });

  const m = Math.floor(s / 60);
  if (m < 60)  return t('activity.minutesAgo', { count: m });

  const time = then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  const todayStr     = now.toDateString();
  const yesterdayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString();

  if (then.toDateString() === todayStr)     return t('activity.todayAt', { time });
  if (then.toDateString() === yesterdayStr) return t('activity.yesterdayAt', { time });

  if (diff < 6 * 24 * 60 * 60 * 1000) {
    const day = then.toLocaleDateString([], { weekday: 'short' });
    return t('activity.dayAt', { day, time });
  }

  return then.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '';
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActorAvatar({ name, avatarUrl }: { name: string | null; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name ?? ''} className="w-5 h-5 rounded-full object-cover shrink-0" />
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0 select-none">
      {(name ?? '?')[0].toUpperCase()}
    </span>
  );
}

function PayerChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[11px] font-semibold leading-none">
      {name}
    </span>
  );
}

function SecondaryChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold leading-none">
      {name}
    </span>
  );
}

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

function ActionIcon({ type }: { type: ActivityActionType | null }) {
  if (type === 'EXPENSE_ADDED')   return <PlusCircle   size={11} className="shrink-0 text-violet-500 dark:text-violet-400" />;
  if (type === 'EXPENSE_DELETED') return <Trash2       size={11} className="shrink-0 text-red-400 dark:text-red-500" />;
  if (type === 'SETTLEMENT_MADE') return <CheckCircle2 size={11} className="shrink-0 text-green-500 dark:text-green-400" />;
  return                                 <Activity     size={11} className="shrink-0 text-slate-400 dark:text-slate-500" />;
}

// ─── Row renderer ─────────────────────────────────────────────────────────────

function EntryRow({ entry, t }: { entry: ActivityEntry; t: TFunc }) {
  const actorName = entry.actorProfile?.fullName ?? 'Someone';
  const payerName = entry.participantName;

  const toName = (() => {
    if (entry.actionType !== 'SETTLEMENT_MADE') return null;
    const m = entry.message.match(/→ (.+)$/);
    return m?.[1]?.trim() ?? null;
  })();

  return (
    <li className="flex items-start gap-2.5 py-2.5 border-b border-gray-50 dark:border-slate-800/60 last:border-0">
      <ActorAvatar name={actorName} avatarUrl={entry.actorProfile?.avatarUrl} />

      <div className="flex-1 min-w-0 space-y-1">
        {entry.actionType === 'EXPENSE_ADDED' && (
          <p className="flex items-center gap-1 flex-wrap leading-snug">
            <span className="text-[12px] font-semibold text-gray-800 dark:text-slate-100">
              &ldquo;{entry.message}&rdquo;
            </span>
            <span className="text-[11px] text-gray-400 dark:text-slate-500">
              ({formatAmount(entry.amount)})
            </span>
            <span className="text-[11px] text-gray-500 dark:text-slate-400">{t('activity.paidBy')}</span>
            {payerName
              ? <PayerChip name={payerName} />
              : <span className="text-[11px] text-gray-500 dark:text-slate-400">—</span>
            }
          </p>
        )}

        {entry.actionType === 'EXPENSE_DELETED' && (
          <div className="space-y-0.5">
            <p className="flex items-center gap-1 flex-wrap leading-snug">
              <span className="text-[11px] text-red-500 dark:text-red-400 font-medium">{t('activity.deleted')}</span>
              {entry.isSettled != null && <StatusBadge settled={entry.isSettled} />}
              <span className="text-[11px] text-gray-400 dark:text-slate-500">{t('activity.expense')}</span>
            </p>
            <p className="flex items-center gap-1 flex-wrap leading-snug">
              <span className={cn('text-[12px] font-semibold', 'text-gray-500 dark:text-slate-400 line-through decoration-red-400/70')}>
                &ldquo;{entry.message}&rdquo;
              </span>
              <span className="text-[11px] text-gray-400 dark:text-slate-500">
                ({formatAmount(entry.amount)})
              </span>
              <span className="text-[11px] text-gray-500 dark:text-slate-400">{t('activity.paidBy')}</span>
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
            <span className="text-[11px] text-gray-500 dark:text-slate-400">{t('activity.paid')}</span>
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

        <div className="flex items-center gap-1.5">
          <ActionIcon type={entry.actionType} />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            {t('activity.by')} <span className="font-medium">{actorName}</span>
          </span>
          <span className="text-[10px] text-gray-300 dark:text-slate-600">·</span>
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            {relativeTime(entry.createdAt, t)}
          </span>
        </div>
      </div>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivityLog({ groupId }: Props) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(tk => tk + 1), 30_000);
    return () => clearInterval(id);
  }, []);

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
          {t('activity.title')}
        </h2>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-3">
        {t('activity.lastNActions')}
      </p>

      {loading ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">{t('activity.noActivity')}</p>
      ) : (
        <ul>
          {entries.map(entry => (
            <EntryRow key={entry.id} entry={entry} t={t as TFunc} />
          ))}
        </ul>
      )}
    </div>
  );
}
