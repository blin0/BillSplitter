import { useState, type FormEvent } from 'react';
import { Plus, Hash, Loader2, Users, Lock, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createGroup, joinGroupByCode, fetchOwnGroupCount, type GroupInfo } from '../lib/db';
import { useSubscription } from '../hooks/useSubscription';

const FREE_TIER_GROUP_LIMIT = 3;

interface Props {
  /** Called after successfully creating a group. */
  onCreated:  (group: GroupInfo) => void;
  /** Called after successfully joining a group. */
  onJoined:   (group: GroupInfo) => void;
  /** Called when the user hits the free-tier limit — parent should open the upgrade modal. */
  onUpgrade?: () => void;
}

export default function GroupActions({ onCreated, onJoined, onUpgrade }: Props) {
  const { t } = useTranslation();
  const subscription = useSubscription();

  // ── Create state ───────────────────────────────────────────────────────────
  const [createName,    setCreateName   ] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError,   setCreateError  ] = useState<string | null>(null);
  const [blocked,       setBlocked      ] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreateError(null);
    setBlocked(false);
    setCreateLoading(true);

    // ── Free-tier gate: max 3 owned groups ──────────────────────────────────
    if (!subscription.isPro) {
      const { data: count } = await fetchOwnGroupCount();
      if ((count ?? 0) >= FREE_TIER_GROUP_LIMIT) {
        setCreateLoading(false);
        setBlocked(true);
        return;
      }
    }

    const { data, error } = await createGroup(name);
    setCreateLoading(false);
    if (error || !data) {
      setCreateError(error ?? t('common.error'));
    } else {
      setCreateName('');
      onCreated(data);
    }
  }

  // ── Join state ─────────────────────────────────────────────────────────────
  const [joinCode,    setJoinCode   ] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError,   setJoinError  ] = useState<string | null>(null);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError(t('sidebar.errorCodeLength'));
      return;
    }
    setJoinError(null);
    setJoinLoading(true);
    const { data, error } = await joinGroupByCode(code);
    setJoinLoading(false);
    if (error || !data) {
      setJoinError(error ?? t('common.error'));
    } else {
      setJoinCode('');
      onJoined(data);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Create a group ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-violet-100 dark:bg-violet-900/40 rounded-lg">
            <Plus size={14} className="text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {t('groupActions.createTitle')}
          </h3>
        </div>

        {/* ── Upgrade gate ── */}
        {blocked ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-3.5 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Lock size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                  {t('sidebar.freePlanLimit')}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {t('sidebar.freePlanDesc', { limit: FREE_TIER_GROUP_LIMIT })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setBlocked(false); onUpgrade?.(); }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 text-white text-sm font-semibold rounded-xl py-2 transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
            >
              <Sparkles size={13} />
              {t('sidebar.upgradeProBtn')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-2.5">
            <input
              type="text"
              name="group-name"
              required
              placeholder={t('sidebar.groupNamePlaceholder')}
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              maxLength={60}
              className="w-full px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 transition-colors hover:border-violet-400 dark:hover:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            {createError && (
              <p className="text-xs text-red-500 dark:text-red-400">{createError}</p>
            )}
            <button
              type="submit"
              disabled={createLoading || !createName.trim() || subscription.loading}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl py-2 transition-colors"
            >
              {createLoading
                ? <><Loader2 size={14} className="animate-spin" /> {t('sidebar.creating')}</>
                : t('groups.createGroup')}
            </button>
          </form>
        )}
      </div>

      {/* ── Join a group ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
            <Users size={14} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {t('groupActions.joinTitle')}
          </h3>
        </div>

        <form onSubmit={handleJoin} className="space-y-2.5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 transition-colors hover:border-violet-400 dark:hover:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent">
            <Hash size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
            <input
              type="text"
              name="invite-code"
              placeholder={t('sidebar.codePlaceholder')}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none font-mono tracking-widest uppercase"
            />
          </div>
          {joinError && (
            <p className="text-xs text-red-500 dark:text-red-400">{joinError}</p>
          )}
          <button
            type="submit"
            disabled={joinLoading || joinCode.trim().length !== 6}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl py-2 transition-colors"
          >
            {joinLoading
              ? <><Loader2 size={14} className="animate-spin" /> {t('sidebar.joining')}</>
              : t('groups.joinGroup')}
          </button>
        </form>
      </div>

    </div>
  );
}
