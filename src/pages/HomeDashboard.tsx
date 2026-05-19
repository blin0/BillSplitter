import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Plus, Users, TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ArrowDownLeft, Activity,
} from 'lucide-react';
import {
  PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { GroupIconDisplay } from '../lib/groupIcons';
import { fetchPersonalExpenses, type GroupInfo, type PersonalData, type PersonalExpense } from '../lib/db';
import { useCurrency } from '../context/CurrencyContext';
import { cn } from '../lib/cn';
import { round2 } from '../utils/calculations';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATS = ['Dining', 'Coffee', 'Groceries', 'Travel', 'Bills', 'Misc'] as const;
type Cat = typeof CATS[number];

const SLICE_COLORS: Record<string, string> = {
  Dining:    '#8b5cf6',
  Coffee:    '#7c3aed',
  Groceries: '#a78bfa',
  Travel:    '#6d28d9',
  Bills:     '#c4b5fd',
  Misc:      '#4c1d95',
  Tax:       '#06b6d4',
  Tip:       '#f59e0b',
};

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500',  'bg-rose-500', 'bg-cyan-500',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categorize(desc: string): Cat {
  const d = desc.toLowerCase();
  if (/dinner|lunch|breakfast|restaurant|sushi|pizza|burger|ramen|food|eat|meal|dine|tavern|grill/.test(d)) return 'Dining';
  if (/coffee|starbucks|latte|espresso|cafe|boba|tea|brew/.test(d)) return 'Coffee';
  if (/grocer|supermarket|market|costco|walmart|trader joe|whole food|safeway|aldi/.test(d)) return 'Groceries';
  if (/uber|lyft|taxi|flight|hotel|airbnb|train|bus|transit|gas|parking|toll|transport/.test(d)) return 'Travel';
  if (/rent|util|electric|water|internet|phone|insurance|bill|subscription|netflix|spotify/.test(d)) return 'Bills';
  return 'Misc';
}

function computeGroupBalances(data: PersonalData): Record<string, number> {
  const result: Record<string, number> = {};
  for (const { groupId, memberId, expense } of data.items) {
    if (result[groupId] === undefined) result[groupId] = 0;
    for (const split of expense.splits) {
      const owed = round2(Math.max(0, split.share - split.paidAmount));
      if (owed < 0.01) continue;
      if (expense.paidBy === memberId) result[groupId] = round2(result[groupId] + owed);
      if (split.participantId === memberId) result[groupId] = round2(result[groupId] - owed);
    }
  }
  return result;
}

interface GroupDebt {
  participantId: string;
  name:          string;
  amount:        number; // positive = they owe me, negative = I owe them
}

function computeGroupDebts(data: PersonalData, groupId: string): GroupDebt[] {
  const anchor = data.items.find(i => i.groupId === groupId);
  if (!anchor) return [];
  const memberId   = anchor.memberId;
  const groupItems = data.items.filter(i => i.groupId === groupId);
  const net: Record<string, number> = {};

  for (const { expense } of groupItems) {
    for (const split of expense.splits) {
      const owed = round2(Math.max(0, split.share - split.paidAmount));
      if (owed < 0.01) continue;
      if (expense.paidBy === memberId && split.participantId !== memberId) {
        net[split.participantId] = round2((net[split.participantId] ?? 0) + owed);
      }
      if (expense.paidBy !== memberId && split.participantId === memberId) {
        net[expense.paidBy] = round2((net[expense.paidBy] ?? 0) - owed);
      }
    }
  }

  return Object.entries(net)
    .filter(([, amount]) => Math.abs(amount) >= 0.01)
    .map(([participantId, amount]) => ({
      participantId,
      name:   data.participantNames[participantId] ?? '—',
      amount,
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function getRecentActivity(data: PersonalData): PersonalExpense[] {
  return [...data.items]
    .filter(i => i.expense.date)
    .sort((a, b) =>
      new Date(b.expense.date!).getTime() - new Date(a.expense.date!).getTime()
    )
    .reduce<PersonalExpense[]>((acc, item) => {
      // deduplicate by expense id across groups
      if (!acc.find(x => x.expense.id === item.expense.id)) acc.push(item);
      return acc;
    }, [])
    .slice(0, 3);
}

function getCategoryData(data: PersonalData): { slices: { category: string; amount: number; color: string }[]; grand: number } {
  const totals: Record<Cat, number> = { Dining: 0, Coffee: 0, Groceries: 0, Travel: 0, Bills: 0, Misc: 0 };
  let taxTotal = 0, tipTotal = 0, grand = 0;
  for (const { expense: e } of data.items) {
    const eTax = e.taxPercent      ? e.totalAmount * (e.taxPercent / (100 + e.taxPercent)) : 0;
    const eTip = e.tipSourceAmount ? e.tipSourceAmount * e.lockedRate : 0;
    const base = round2(e.totalAmount - eTax - eTip);
    const cat  = categorize(e.description);
    totals[cat] = round2(totals[cat] + base);
    taxTotal    = round2(taxTotal + eTax);
    tipTotal    = round2(tipTotal + eTip);
    grand       = round2(grand + e.totalAmount);
  }
  const slices: { category: string; amount: number; color: string }[] = CATS
    .map(cat => ({ category: cat as string, amount: totals[cat], color: SLICE_COLORS[cat] }))
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (taxTotal > 0) slices.push({ category: 'Tax', amount: taxTotal, color: SLICE_COLORS.Tax });
  if (tipTotal > 0) slices.push({ category: 'Tip', amount: tipTotal, color: SLICE_COLORS.Tip });
  return { slices, grand };
}

function getPersonalVelocityData(data: PersonalData): { chartData: { day: string; amount: number }[]; curr: number; velocity: number | null } {
  const now = Date.now(), DAY = 86_400_000;
  const daily: Record<string, number> = {};
  let curr = 0, prev = 0;

  for (const { memberId, expense } of data.items) {
    if (!expense.date) continue;
    const share = expense.splits.find(s => s.participantId === memberId)?.share ?? 0;
    if (share <= 0) continue;
    const age = now - new Date(expense.date).getTime();
    if (age <= 30 * DAY) {
      const key = new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daily[key] = round2((daily[key] ?? 0) + share);
      curr = round2(curr + share);
    } else if (age <= 60 * DAY) {
      prev = round2(prev + share);
    }
  }

  const chartData: { day: string; amount: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(now - i * DAY);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    chartData.push({ day: key, amount: daily[key] ?? 0 });
  }

  return { chartData, curr, velocity: prev > 0 ? round2(((curr - prev) / prev) * 100) : null };
}

function relativeDate(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay === 0) return 'Today';
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7)   return `${diffDay}d ago`;
  if (diffDay < 30)  return `${Math.floor(diffDay / 7)}w ago`;
  return `${Math.floor(diffDay / 30)}mo ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InitialAvatar({ name }: { name: string }) {
  const initial  = (name.trim()[0] ?? '?').toUpperCase();
  const colorCls = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0', colorCls)}>
      {initial}
    </span>
  );
}

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() =>
    document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const cardVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.28, ease: 'easeOut' as const },
  }),
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  groups:           GroupInfo[];
  groupsLoading:    boolean;
  onSelectGroup:    (id: string) => void;
  onOpenOnboarding: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeDashboard({ groups, groupsLoading, onSelectGroup, onOpenOnboarding }: Props) {
  const { formatPrice } = useCurrency();
  const isDark = useIsDark();
  const [personalData,    setPersonalData   ] = useState<PersonalData | null>(null);
  const [loadingPersonal, setLoadingPersonal] = useState(true);

  useEffect(() => {
    fetchPersonalExpenses().then(({ data }) => {
      setPersonalData(data);
      setLoadingPersonal(false);
    });
  }, []);

  const groupBalances = useMemo(
    () => (personalData ? computeGroupBalances(personalData) : {}),
    [personalData],
  );

  const { slices, grand } = useMemo(
    () => (personalData ? getCategoryData(personalData) : { slices: [], grand: 0 }),
    [personalData],
  );

  const { chartData: velocityChartData, curr: velocityCurr, velocity } = useMemo(
    () => (personalData ? getPersonalVelocityData(personalData) : { chartData: [], curr: 0, velocity: null }),
    [personalData],
  );

  const recentActivity = useMemo(
    () => (personalData ? getRecentActivity(personalData) : []),
    [personalData],
  );

  const { totalOwedToMe, totalIOwe } = useMemo(() => {
    let owed = 0, iOwe = 0;
    for (const b of Object.values(groupBalances)) {
      if (b > 0.01)  owed  = round2(owed  + b);
      if (b < -0.01) iOwe  = round2(iOwe  - b);
    }
    return { totalOwedToMe: owed, totalIOwe: iOwe };
  }, [groupBalances]);

  const velocityIsUp = velocity !== null && velocity > 0;
  const isLoading    = groupsLoading || loadingPersonal;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-73px)]">
        <Loader2 size={28} className="animate-spin text-violet-500" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-73px)] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.32 }}
          className="w-full max-w-md text-center"
        >
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 rounded-3xl bg-violet-500/20 blur-xl" />
            <div className="relative inline-flex p-5 rounded-3xl bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800/50">
              <Users size={36} className="text-violet-500 dark:text-violet-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            No groups yet
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-8 leading-relaxed">
            Create a group for your trip, household, or any shared expense.
          </p>
          <button
            onClick={onOpenOnboarding}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors shadow-lg shadow-violet-500/25"
          >
            <Plus size={18} />
            Create your first group
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5 p-6">

      {/* ── KPI row (full width) ── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="lg:col-span-3 grid grid-cols-3 divide-x divide-gray-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
      >
        {/* Owed to me */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 shrink-0">
            <ArrowDownLeft size={14} className="text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Owed to you</p>
            <p className="text-base font-bold text-emerald-500 tabular-nums leading-none">
              {totalOwedToMe > 0.01 ? `+${formatPrice(totalOwedToMe)}` : '—'}
            </p>
          </div>
        </div>

        {/* I owe */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/25 shrink-0">
            <ArrowUpRight size={14} className="text-rose-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">You owe</p>
            <p className="text-base font-bold text-rose-500 tabular-nums leading-none">
              {totalIOwe > 0.01 ? formatPrice(totalIOwe) : '—'}
            </p>
          </div>
        </div>

        {/* Active pools */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
            <Users size={14} className="text-slate-400 dark:text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Active groups</p>
            <p className="text-base font-bold text-slate-600 dark:text-slate-300 tabular-nums leading-none">
              {groups.length}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Group selector grid (lg:col-span-2) ── */}
      <section className="lg:col-span-2 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
          My Groups
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {groups.map((group, i) => {
            const balance    = groupBalances[group.id];
            const hasBalance = balance !== undefined;
            const isPos      = hasBalance && balance > 0.01;
            const isNeg      = hasBalance && balance < -0.01;
            const debts      = personalData ? computeGroupDebts(personalData, group.id).slice(0, 2) : [];

            return (
              <motion.button
                key={group.id}
                type="button"
                custom={i}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                onClick={() => onSelectGroup(group.id)}
                className={cn(
                  'text-left w-full',
                  'bg-white dark:bg-slate-900',
                  'border border-gray-100 dark:border-slate-800',
                  'rounded-2xl p-4 shadow-sm',
                  'hover:border-purple-400/60 dark:hover:border-purple-500/50',
                  'hover:shadow-md hover:shadow-purple-500/10',
                  'transition-all group',
                )}
              >
                {/* Card header: icon + balance badge */}
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-100/80 dark:border-violet-800/50">
                    {group.icon ? (
                      <GroupIconDisplay icon={group.icon} size={16} className="text-violet-500 dark:text-violet-400" />
                    ) : (
                      <Users size={16} className="text-violet-500 dark:text-violet-400" />
                    )}
                  </div>

                  {hasBalance && (
                    <span className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold',
                      isPos ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                      isNeg ? 'bg-red-50    dark:bg-red-900/30    text-red-700    dark:text-red-400'    :
                              'bg-gray-100  dark:bg-slate-700     text-gray-500   dark:text-slate-400',
                    )}>
                      {isPos ? <TrendingUp   size={10} /> :
                       isNeg ? <TrendingDown size={10} /> :
                               <Minus        size={10} />}
                      {isPos ? `+${formatPrice(balance)}` :
                       isNeg ?   formatPrice(balance)     :
                                 'Settled'}
                    </span>
                  )}
                </div>

                {/* Group name + role */}
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate mb-0.5 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors text-sm">
                  {group.name}
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 capitalize mb-0">
                  {group.role}
                </p>

                {/* Debt micro-list */}
                {debts.length > 0 && (
                  <>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-700/60 space-y-1.5">
                      {debts.map(debt => (
                        <div key={debt.participantId} className="flex items-center gap-2">
                          <InitialAvatar name={debt.name} />
                          <span className="text-[11px] text-gray-500 dark:text-slate-400 truncate flex-1 leading-none">
                            {debt.amount > 0
                              ? <><span className="font-medium text-gray-700 dark:text-slate-200">{debt.name}</span> owes you</>
                              : <>You owe <span className="font-medium text-gray-700 dark:text-slate-200">{debt.name}</span></>
                            }
                          </span>
                          <span className={cn(
                            'text-[11px] font-semibold tabular-nums shrink-0',
                            debt.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                          )}>
                            {formatPrice(Math.abs(debt.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.button>
            );
          })}

          {/* + Create Group card */}
          <motion.button
            type="button"
            custom={groups.length}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            onClick={onOpenOnboarding}
            className={cn(
              'w-full flex flex-col items-center justify-center gap-2.5',
              'border-2 border-dashed border-gray-200 dark:border-slate-700/80',
              'rounded-2xl p-4 min-h-[110px]',
              'hover:border-purple-500/40 dark:hover:border-purple-500/40',
              'hover:bg-purple-600/5 dark:hover:bg-purple-600/5',
              'transition-all group',
            )}
          >
            <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40 transition-colors">
              <Plus size={16} className="text-gray-400 dark:text-slate-500 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-400 dark:text-slate-500 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors leading-none mb-1">
                Create Group
              </p>
              <p className="text-[10px] text-gray-300 dark:text-slate-600 group-hover:text-violet-400/70 dark:group-hover:text-violet-500/70 transition-colors leading-snug max-w-[140px]">
                Set up a new ledger, invite friends, and split instantly.
              </p>
            </div>
          </motion.button>

        </div>
      </section>

      {/* ── Personal analytics sidebar (lg:col-span-1) ── */}
      <aside className="lg:col-span-1 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
          Personal Overview
        </h2>

        {/* Spending breakdown donut */}
        {slices.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.28 }}
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm"
          >
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">Spending by Category</p>

            <div className="flex items-center gap-3">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={slices} dataKey="amount" cx="50%" cy="50%" innerRadius={24} outerRadius={46} strokeWidth={0}>
                      {slices.map(entry => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-1 min-w-0">
                {slices.slice(0, 5).map(s => (
                  <div key={s.category} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-500 dark:text-slate-400 truncate flex-1">{s.category}</span>
                    <span className="text-gray-700 dark:text-slate-300 font-medium shrink-0 tabular-nums">{formatPrice(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-700/50 flex items-center justify-between text-xs">
              <span className="text-gray-400 dark:text-slate-500">Total spent</span>
              <span className="font-semibold text-gray-800 dark:text-slate-200 tabular-nums">{formatPrice(grand)}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.28 }}
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm"
          >
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center leading-relaxed">
              Link yourself to group members to see personal spending analytics.
            </p>
          </motion.div>
        )}

        {/* Recent global activity */}
        {recentActivity.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.28 }}
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 shrink-0">
                <Activity size={11} className="text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">Recent Activity</p>
            </div>

            <div className="space-y-2.5">
              {recentActivity.map(item => {
                const myShare = item.expense.splits.find(s => s.participantId === item.memberId)?.share ?? item.expense.totalAmount;
                return (
                  <div key={item.expense.id} className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 shrink-0">
                      <div className="w-3 h-3 rounded-full bg-violet-400/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-800 dark:text-slate-200 truncate leading-none mb-0.5">
                        {item.expense.description}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate leading-none">
                        {item.groupName} · {item.expense.date ? relativeDate(item.expense.date) : ''}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 tabular-nums shrink-0">
                      {formatPrice(myShare)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Spending velocity */}
        {velocityChartData.some(d => d.amount > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.28 }}
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/20 shrink-0">
                  <TrendingUp size={11} className="text-violet-500 dark:text-violet-400" />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">Velocity</span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500">30-day</span>
              </div>

              {velocity !== null && (
                <span className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                  velocityIsUp
                    ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400',
                )}>
                  {velocityIsUp ? '↑' : '↓'} {Math.abs(velocity).toFixed(1)}%
                </span>
              )}
            </div>

            <p className="text-base font-bold text-gray-900 dark:text-slate-100 mb-2.5 tabular-nums">
              {formatPrice(velocityCurr)}
            </p>

            <ResponsiveContainer width="100%" height={64}>
              <AreaChart data={velocityChartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashVelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={isDark ? 0.45 : 0.28} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'} vertical={false} />
                <XAxis dataKey="day" hide />
                <YAxis hide />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl px-2.5 py-2 shadow-lg text-xs bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                        <p className="text-gray-400 dark:text-slate-400 mb-0.5">{label as string}</p>
                        <p className="text-violet-600 dark:text-violet-300 font-bold">
                          {formatPrice((payload[0] as { value: number }).value)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2} fill="url(#dashVelGrad)" dot={false} activeDot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

      </aside>

    </div>
  );
}
