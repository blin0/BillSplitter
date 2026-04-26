import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Users, ChevronDown,
  Loader2, Globe, RefreshCw, Sparkles, Receipt,
} from 'lucide-react';
import {
  PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { fetchExpenses, fetchParticipants, type GroupInfo } from '../lib/db';
import type { Expense, Participant } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { cn } from '../lib/cn';
import { computeBalances, simplifyDebts, round2 } from '../utils/calculations';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  groups:        GroupInfo[];
  currentUserId: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATS = ['Dining', 'Coffee', 'Groceries', 'Travel', 'Bills', 'Misc'] as const;
type Cat = typeof CATS[number];

const SLICE_COLORS: Record<Cat, string> = {
  Dining:    '#8b5cf6',
  Coffee:    '#7c3aed',
  Groceries: '#a78bfa',
  Travel:    '#6d28d9',
  Bills:     '#c4b5fd',
  Misc:      '#4c1d95',
};

const TAX_COLOR = '#06b6d4';
const TIP_COLOR = '#f59e0b';

// ─── Theme hook ───────────────────────────────────────────────────────────────

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() =>
    document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function categorize(desc: string): Cat {
  const d = desc.toLowerCase();
  if (/dinner|lunch|breakfast|restaurant|sushi|pizza|burger|ramen|food|eat|meal|dine|tavern|grill/.test(d)) return 'Dining';
  if (/coffee|starbucks|latte|espresso|cafe|boba|tea|brew/.test(d)) return 'Coffee';
  if (/grocer|supermarket|market|costco|walmart|trader joe|whole food|safeway|aldi/.test(d)) return 'Groceries';
  if (/uber|lyft|taxi|flight|hotel|airbnb|train|bus|transit|gas|parking|toll|transport/.test(d)) return 'Travel';
  if (/rent|util|electric|water|internet|phone|insurance|bill|subscription|netflix|spotify/.test(d)) return 'Bills';
  return 'Misc';
}

function getCategoryData(expenses: Expense[]) {
  const totals: Record<Cat, number> = { Dining: 0, Coffee: 0, Groceries: 0, Travel: 0, Bills: 0, Misc: 0 };
  let taxTotal = 0, tipTotal = 0, grand = 0;
  for (const e of expenses) {
    const eTax = e.taxPercent     ? e.totalAmount * (e.taxPercent / (100 + e.taxPercent)) : 0;
    const eTip = e.tipSourceAmount ? e.tipSourceAmount * e.lockedRate : 0;
    const base = round2(e.totalAmount - eTax - eTip);
    const cat  = categorize(e.description);
    totals[cat] = round2(totals[cat] + base);
    taxTotal    = round2(taxTotal + eTax);
    tipTotal    = round2(tipTotal + eTip);
    grand       = round2(grand + e.totalAmount);
  }
  const result: { category: string; amount: number; pct: number; color: string }[] = CATS
    .map(cat => ({
      category: cat as string,
      amount:   totals[cat],
      pct:      grand > 0 ? round2((totals[cat] / grand) * 100) : 0,
      color:    SLICE_COLORS[cat],
    }))
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (taxTotal > 0) result.push({ category: 'Tax', amount: taxTotal, pct: grand > 0 ? round2((taxTotal / grand) * 100) : 0, color: TAX_COLOR });
  if (tipTotal > 0) result.push({ category: 'Tip', amount: tipTotal, pct: grand > 0 ? round2((tipTotal / grand) * 100) : 0, color: TIP_COLOR });
  return result;
}

function getSavingsData(expenses: Expense[]) {
  let taxAmt = 0, tipAmt = 0, grand = 0, withTaxOrTip = 0;
  for (const e of expenses) {
    grand += e.totalAmount;
    const hasTax = !!e.taxPercent;
    const hasTip = !!e.tipSourceAmount;
    if (hasTax) taxAmt += e.totalAmount * (e.taxPercent! / (100 + e.taxPercent!));
    if (hasTip) tipAmt += e.tipSourceAmount! * e.lockedRate;
    if (hasTax || hasTip) withTaxOrTip++;
  }
  taxAmt = round2(taxAmt); tipAmt = round2(tipAmt); grand = round2(grand);
  return {
    taxAmt, tipAmt,
    combined:     round2(taxAmt + tipAmt),
    taxPct:       grand > 0 ? round2((taxAmt / grand) * 100) : 0,
    tipPct:       grand > 0 ? round2((tipAmt / grand) * 100) : 0,
    withTaxOrTip, grand,
  };
}

function getVelocityData(expenses: Expense[]) {
  const now = Date.now(), DAY = 86_400_000;
  const daily: Record<string, number> = {};
  let curr = 0, prev = 0;
  for (const e of expenses) {
    if (!e.date) continue;
    const age = now - new Date(e.date).getTime();
    if (age <= 30 * DAY) {
      const key = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daily[key] = round2((daily[key] ?? 0) + e.totalAmount);
      curr = round2(curr + e.totalAmount);
    } else if (age <= 60 * DAY) {
      prev = round2(prev + e.totalAmount);
    }
  }
  const data: { day: string; amount: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(now - i * DAY);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    data.push({ day: key, amount: daily[key] ?? 0 });
  }
  return { data, curr, velocity: prev > 0 ? round2(((curr - prev) / prev) * 100) : null };
}

function getPeerBreakdown(participants: Participant[], expenses: Expense[]) {
  return participants.map(p => {
    const catAmounts: Partial<Record<Cat, number>> = {};
    let taxAmt = 0, tipAmt = 0;

    for (const e of expenses) {
      const split = e.splits.find(s => s.participantId === p.id);
      if (!split) continue;

      const ratio = e.totalAmount > 0 ? split.share / e.totalAmount : 0;
      const eTax  = e.taxPercent     ? e.totalAmount * (e.taxPercent / (100 + e.taxPercent)) : 0;
      const eTip  = e.tipSourceAmount ? e.tipSourceAmount * e.lockedRate : 0;

      taxAmt += eTax * ratio;
      tipAmt += eTip * ratio;

      const baseShare = split.share - eTax * ratio - eTip * ratio;
      if (baseShare > 0) {
        const cat = categorize(e.description);
        catAmounts[cat] = (catAmounts[cat] ?? 0) + baseShare;
      }
    }

    const catEntries = (Object.entries(catAmounts) as [Cat, number][])
      .map(([cat, amount]) => ({ cat, amount: round2(amount), color: SLICE_COLORS[cat] }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    taxAmt = round2(taxAmt);
    tipAmt = round2(tipAmt);
    const total = round2(catEntries.reduce((s, c) => s + c.amount, 0) + taxAmt + tipAmt);

    return { id: p.id, name: p.name, catEntries, taxAmt, tipAmt, total };
  }).sort((a, b) => b.total - a.total);
}

function getFXImpact(expenses: Expense[], convert: (a: number, f: string, t: string) => number, base: string) {
  let impact = 0, count = 0;
  for (const e of expenses) {
    if (e.sourceCurrency === base || e.lockedRate === 1) continue;
    impact = round2(impact + (convert(e.sourceAmount, e.sourceCurrency, base) - e.sourceAmount * e.lockedRate));
    count++;
  }
  return { impact, count };
}

function getPeerData(participants: Participant[], expenses: Expense[]) {
  const balances = computeBalances(participants, expenses);
  return participants
    .map(p => {
      const all        = expenses.flatMap(e => e.splits.filter(s => s.participantId === p.id));
      const settled    = all.filter(s => s.isSettled).length;
      const totalSpent = round2(all.reduce((sum, s) => sum + s.share, 0));
      return {
        id:          p.id,
        name:        p.name,
        balance:     round2(balances[p.id] ?? 0),
        settleRate:  all.length > 0 ? round2((settled / all.length) * 100) : 100,
        totalSplits: all.length,
        totalSpent,
      };
    })
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('animate-pulse rounded-xl bg-black/6 dark:bg-white/8', className)} style={style} />;
}

function DonutSkeleton() {
  return (
    <div className="flex items-center justify-center h-52 my-1">
      <div className="relative w-40 h-40">
        <div className="absolute inset-0 animate-pulse rounded-full border-[14px] border-black/10 dark:border-white/10" />
        <div className="absolute inset-[28%] rounded-full" style={{ background: 'var(--analytics-donut-hole)' }} />
      </div>
    </div>
  );
}

function LineSkeleton() {
  return (
    <div className="h-40 flex items-end gap-0.5 px-1">
      {Array.from({ length: 30 }).map((_, i) => (
        <Shimmer
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ height: `${18 + Math.abs(Math.sin(i * 0.7 + 1)) * 55 + 10}%`, animationDelay: `${i * 30}ms` }}
        />
      ))}
    </div>
  );
}

// ─── InsightBadge ─────────────────────────────────────────────────────────────

function InsightBadge({ insight }: { insight: string }) {
  const { t } = useTranslation('analytics');
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setShow(o => !o)}
        className={cn(
          'p-1 rounded-lg transition-colors',
          show
            ? 'bg-violet-500/30 text-violet-600 dark:text-violet-300'
            : 'text-gray-400 dark:text-slate-600 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-violet-500/15',
        )}
        aria-label={t('insightLabel')}
      >
        <Sparkles size={11} />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.14 }}
            className="absolute top-full right-0 z-50 w-56 p-3 mt-1 rounded-xl border text-xs leading-relaxed shadow-2xl"
            style={{
              background:   'var(--analytics-tooltip-bg)',
              borderColor:  'var(--analytics-tooltip-border)',
              color:        'inherit',
              boxShadow:    '0 20px 60px rgba(109,40,217,0.15)',
            }}
          >
            <div className="flex items-start gap-2">
              <Sparkles size={10} className="text-violet-500 mt-0.5 shrink-0" />
              <span className="text-gray-700 dark:text-slate-300">{insight}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── GroupDropdown ────────────────────────────────────────────────────────────

function GroupDropdown({ groups, value, onChange }: {
  groups:   GroupInfo[];
  value:    string | null;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation('analytics');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = groups.find(g => g.id === value);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm text-gray-900 dark:text-white hover:opacity-90 transition-colors min-w-[120px]"
        style={{ background: 'var(--analytics-toggle-bg)', borderColor: 'var(--analytics-toggle-border)' }}
      >
        <span className="flex-1 truncate text-left">{cur?.name ?? t('selectGroup')}</span>
        <ChevronDown size={13} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 z-50 min-w-[200px] rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--analytics-dropdown-bg)', borderColor: 'var(--analytics-card-border)' }}
        >
          {groups.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => { onChange(g.id); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors',
                g.id === value
                  ? 'bg-violet-600/20 text-violet-700 dark:text-violet-300'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/8',
              )}
            >
              {g.id === value && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />}
              <span className="flex-1 truncate">{g.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Widget A: Donut Chart ────────────────────────────────────────────────────

function WidgetDonut({ expenses, fmt, loading }: {
  expenses: Expense[];
  fmt:      (n: number) => string;
  loading:  boolean;
}) {
  const { t } = useTranslation('analytics');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const catData = useMemo(() => getCategoryData(expenses), [expenses]);
  const total   = useMemo(() => round2(expenses.reduce((s, e) => s + e.totalAmount, 0)), [expenses]);
  const hovered = hoveredIdx !== null ? catData[hoveredIdx] : null;
  const insight = catData.length > 0
    ? t('donut.insightTop', { cat: t(`cat.${catData[0].category}`), pct: catData[0].pct })
    : t('donut.insightNone');

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 flex flex-col shadow-sm"
      style={{ background: 'var(--analytics-card-bg)', borderColor: 'var(--analytics-card-border)' }}
    >
      <div className="pointer-events-none absolute -top-10 -left-10 w-44 h-44 rounded-full bg-violet-600/12 blur-3xl" />

      <div className="flex items-center gap-2 mb-5">
        <div className="p-1.5 rounded-lg bg-violet-500/20 shrink-0">
          <BarChart3 size={13} className="text-violet-500 dark:text-violet-400" />
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{t('donut.title')}</span>
        <InsightBadge insight={insight} />
      </div>

      {loading ? <DonutSkeleton /> : catData.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: 280 }}>
          <p className="text-gray-400 dark:text-slate-500 text-sm">{t('donut.noExpenses')}</p>
        </div>
      ) : (
        <>
          {/* ── Chart — fixed height, never compressed by the list below ── */}
          <motion.div
            className="shrink-0 relative"
            style={{ height: 280 }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div
              className="relative h-full [&_svg]:outline-none [&_svg]:focus:outline-none [&_*:focus]:outline-none [&_*]:select-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart style={{ outline: 'none' }}>
                  <defs>
                    <filter id="donutGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                      <feColorMatrix
                        in="blur" type="matrix"
                        values="0 0 0 0 0.545  0 0 0 0 0.361  0 0 0 0 0.965  0 0 0 0.45 0"
                        result="coloredBlur"
                      />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <Pie
                    data={catData}
                    cx="50%" cy="50%"
                    innerRadius="42%" outerRadius="70%"
                    dataKey="amount"
                    strokeWidth={0}
                    paddingAngle={2}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={900}
                    animationEasing="ease-out"
                    onMouseEnter={(_, i) => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {catData.map((c, i) => (
                      <Cell
                        key={c.category}
                        fill={c.color}
                        opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.3}
                        filter="url(#donutGlow)"
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Dynamic center text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <AnimatePresence mode="wait">
                  {hovered ? (
                    <motion.div
                      key={hovered.category}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.14 }}
                      className="text-center px-2"
                    >
                      <p className="text-[9px] text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-0.5 leading-none">{t(`cat.${hovered.category}`)}</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">{fmt(hovered.amount)}</p>
                      <p className="text-[10px] font-semibold mt-0.5" style={{ color: hovered.color }}>{hovered.pct}%</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="total"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.14 }}
                      className="text-center"
                    >
                      <p className="text-[9px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5 leading-none">{t('donut.total')}</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">{fmt(total)}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* ── Category list — grows naturally; pushes card border down ── */}
          <div className="flex-grow mt-8 space-y-1">
            {catData.map((c, i) => (
              <div
                key={c.category}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1 transition-all cursor-default select-none',
                  hoveredIdx === i ? 'bg-black/5 dark:bg-white/8' : hoveredIdx !== null ? 'opacity-35' : '',
                )}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="text-xs text-gray-500 dark:text-slate-400 flex-1">{t(`cat.${c.category}`)}</span>
                <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">{fmt(c.amount)}</span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 w-7 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Widget: Savings ──────────────────────────────────────────────────────────

function WidgetSavings({ expenses, fmt, loading }: {
  expenses: Expense[];
  fmt:      (n: number) => string;
  loading:  boolean;
}) {
  const { t } = useTranslation('analytics');
  const s       = useMemo(() => getSavingsData(expenses), [expenses]);
  const insight = t('savings.insight', { amount: fmt(s.combined), pct: round2(s.taxPct + s.tipPct) });

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 shadow-sm"
      style={{ background: 'var(--analytics-card-bg)', borderColor: 'var(--analytics-card-border)' }}
    >
      <div className="pointer-events-none absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-emerald-500/8 blur-3xl" />

      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-emerald-500/20 shrink-0">
          <Receipt size={13} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{t('savings.title')}</span>
        <InsightBadge insight={insight} />
      </div>

      {loading ? (
        <div className="space-y-2">
          <Shimmer className="h-9" />
          <Shimmer className="h-7" />
          <Shimmer className="h-7" />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-1.5">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{fmt(s.combined)}</span>
            <span className="text-xs text-gray-400 dark:text-slate-500 mb-1">{t('savings.tracked')}</span>
          </div>

          <div className="space-y-2">
            <div
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'var(--analytics-sub-row)' }}
            >
              <div>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('savings.tax')}</p>
                <p className="text-sm font-bold text-violet-600 dark:text-violet-300">{fmt(s.taxAmt)}</p>
              </div>
              <span className="text-xs text-gray-400 dark:text-slate-500">{s.taxPct}%</span>
            </div>
            <div
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'var(--analytics-sub-row)' }}
            >
              <div>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('savings.tips')}</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(s.tipAmt)}</p>
              </div>
              <span className="text-xs text-gray-400 dark:text-slate-500">{s.tipPct}%</span>
            </div>
          </div>

          {s.withTaxOrTip > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-slate-600 leading-snug">
              {t('savings.acrossExpenses', { count: s.withTaxOrTip })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Widget B: Peer Dynamics ──────────────────────────────────────────────────

type PeerTip =
  | { kind: 'peer'; x: number; y: number; peer: ReturnType<typeof getPeerData>[0] }
  | { kind: 'seg';  x: number; y: number; name: string; amount: number; pct: number; color: string };

function WidgetPeer({ participants, expenses, fmt, loading }: {
  participants: Participant[];
  expenses:     Expense[];
  fmt:          (n: number) => string;
  loading:      boolean;
}) {
  const { t } = useTranslation('analytics');
  const [peerView,   setPeerView  ] = useState<'debt' | 'spent'>('debt');
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [tip,        setTip       ] = useState<PeerTip | null>(null);

  const peers     = useMemo(() => getPeerData(participants, expenses),     [participants, expenses]);
  const breakdown = useMemo(() => getPeerBreakdown(participants, expenses), [participants, expenses]);

  const maxAbs  = Math.max(...peers.map(p => Math.abs(p.balance)), 1);
  const maxTotal = Math.max(...breakdown.map(b => b.total), 1);


  const settlements = useMemo(() => {
    const balances = computeBalances(participants, expenses);
    return simplifyDebts(balances);
  }, [participants, expenses]);
  const nameOf = (id: string) => participants.find(p => p.id === id)?.name ?? '?';

  const overallSettle = peers.length > 0
    ? round2(peers.reduce((s, p) => s + p.settleRate, 0) / peers.length)
    : 0;
  const insight = peers.length > 0
    ? t('peer.insight', { pct: overallSettle })
    : t('peer.insightNone');

  // All categories that appear in the breakdown (for legend)
  const activeCats = CATS.filter(cat => breakdown.some(b => b.catEntries.some(c => c.cat === cat)));

  const tipPortal = typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      {tip && (
        <motion.div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: Math.max(4, tip.x - 244), top: tip.y - 12 }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.1 }}
        >
          <div
            className="rounded-xl px-3 py-2.5 shadow-2xl text-xs"
            style={{
              background:  'var(--analytics-tooltip-bg)',
              borderColor: 'var(--analytics-tooltip-border)',
              border:      '1px solid var(--analytics-tooltip-border)',
              boxShadow:   '0 20px 60px rgba(109,40,217,0.18)',
            }}
          >
            {tip.kind === 'peer' && (
              <>
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <span className="text-gray-900 dark:text-slate-200 font-semibold">{tip.peer.name}</span>
                  <span className={cn('font-bold', tip.peer.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {tip.peer.balance >= 0 ? t('peer.isOwed') : t('peer.owes')} {Math.abs(tip.peer.balance).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-[10px] text-gray-400 dark:text-slate-500">
                  <span className={tip.peer.settleRate >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
                    {tip.peer.settleRate >= 100 ? t('peer.fullySettled') : t('peer.pctSettled', { pct: tip.peer.settleRate })}
                  </span>
                  <span className="w-px h-2.5 bg-black/15 dark:bg-white/15 shrink-0" />
                  <span>{t('peer.splits', { count: tip.peer.totalSplits })}</span>
                  <span className="w-px h-2.5 bg-black/15 dark:bg-white/15 shrink-0" />
                  <span>{t('peer.totalSpentLabel')} <span className="font-semibold text-gray-700 dark:text-slate-200">{fmt(tip.peer.totalSpent)}</span></span>
                </div>
              </>
            )}
            {tip.kind === 'seg' && (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: tip.color }} />
                  <span className="text-gray-900 dark:text-slate-200 font-semibold">{t(`cat.${tip.name}`, { defaultValue: tip.name })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-800 dark:text-slate-100 font-bold">{fmt(tip.amount)}</span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">{tip.pct}{t('peer.pctOfTotal')}</span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  ) : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-4 h-full shadow-sm"
      style={{ background: 'var(--analytics-card-bg)', borderColor: 'var(--analytics-card-border)' }}
    >
      {tipPortal}
        <div className="pointer-events-none absolute -top-10 -right-10 w-44 h-44 rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 shrink-0">
            <Users size={13} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{t('peer.title')}</span>
          <div
            className="flex items-center p-0.5 rounded-lg border"
            style={{ background: 'var(--analytics-toggle-bg)', borderColor: 'var(--analytics-toggle-border)' }}
          >
            {(['debt', 'spent'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setPeerView(v)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all',
                  peerView === v
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/60'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200',
                )}
              >
                {v === 'debt' ? t('peer.debtFlow') : t('peer.totalSpent')}
              </button>
            ))}
          </div>
          <InsightBadge insight={insight} />
        </div>

        {/* Body */}
        <div className="flex-1 min-h-[160px]">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Shimmer key={i} className="h-10" />)}</div>
          ) : peers.length === 0 ? (
            <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-6">{t('peer.noParticipants')}</p>
          ) : (
            <AnimatePresence mode="wait">

              {/* ── Debt Flow ── */}
              {peerView === 'debt' && (
                <motion.div
                  key="debt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-3"
                >
                  {peers.map(p => {
                    const barW     = (Math.abs(p.balance) / maxAbs) * 45;
                    const isCredit = p.balance >= 0;
                    return (
                      <div
                        key={p.id}
                        className="cursor-default"
                        onMouseMove={e => setTip({ kind: 'peer', x: e.clientX, y: e.clientY, peer: p })}
                        onMouseLeave={() => setTip(null)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-700 dark:text-slate-300 font-medium truncate max-w-[140px]">{p.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-gray-400 dark:text-slate-500">{p.settleRate}%</span>
                            <span className={cn('text-xs font-bold tabular-nums min-w-[52px] text-right', isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                              {isCredit ? '+' : ''}{p.balance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="relative h-1.5 flex">
                          <div className="flex-1 flex items-center justify-end">
                            {!isCredit && <div className="h-full rounded-l-full bg-rose-600 dark:bg-rose-500/80 transition-all duration-700" style={{ width: `${barW}%` }} />}
                          </div>
                          <div className="w-px bg-black/15 dark:bg-white/20 shrink-0" />
                          <div className="flex-1 flex items-center justify-start">
                            {isCredit && <div className="h-full rounded-r-full bg-emerald-600 dark:bg-emerald-500/80 transition-all duration-700" style={{ width: `${barW}%` }} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {settlements.length > 0 && (
                    <div className="pt-3 border-t" style={{ borderColor: 'var(--analytics-divider)' }}>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t('peer.whoPaysWho')}</p>
                      <div className="space-y-1.5">
                        {settlements.slice(0, 4).map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                            <span className="text-xs">
                              <span className="text-rose-600 dark:text-rose-300 font-medium">{nameOf(s.from)}</span>
                              <span className="text-gray-400 dark:text-slate-500 mx-1">→</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{nameOf(s.to)}</span>
                              <span className="text-gray-400 dark:text-slate-500 mx-1">·</span>
                              <span className="text-violet-600 dark:text-violet-400 font-bold">{fmt(s.amount)}</span>
                            </span>
                          </div>
                        ))}
                        {settlements.length > 4 && (
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 pl-3">{t('peer.morePayments', { count: settlements.length - 4 })}</p>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Total Spent ── */}
              {peerView === 'spent' && (
                <motion.div
                  key="spent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-4"
                >
                  {breakdown.map(b => (
                    <div key={b.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-700 dark:text-slate-300 font-medium truncate max-w-[160px]">{b.name}</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-slate-200 tabular-nums shrink-0">{fmt(b.total)}</span>
                      </div>

                      {b.total < 0.01 ? (
                        <div className="h-3 rounded-full flex items-center px-2" style={{ background: 'var(--analytics-sub-row)' }}>
                          <span className="text-[9px] text-gray-400 dark:text-slate-600">{t('peer.noSpending')}</span>
                        </div>
                      ) : (
                        <div className="flex h-3 rounded-full overflow-hidden gap-px">
                          {b.catEntries.map(c => {
                            const w = (c.amount / maxTotal) * 100;
                            if (w < 0.5) return null;
                            const pct = round2((c.amount / b.total) * 100);
                            return (
                              <motion.div
                                key={c.cat}
                                layout
                                initial={{ width: 0 }}
                                animate={{ width: `${w}%`, opacity: hoveredCat && hoveredCat !== c.cat ? 0.2 : 1 }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="h-full shrink-0 cursor-default"
                                style={{ background: c.color }}
                                onMouseMove={e => { setHoveredCat(c.cat); setTip({ kind: 'seg', x: e.clientX, y: e.clientY, name: c.cat, amount: c.amount, pct, color: c.color }); }}
                                onMouseLeave={() => { setHoveredCat(null); setTip(null); }}
                              />
                            );
                          })}
                          {b.taxAmt > 0.01 && (
                            <motion.div
                              layout
                              initial={{ width: 0 }}
                              animate={{ width: `${(b.taxAmt / maxTotal) * 100}%`, opacity: hoveredCat && hoveredCat !== '__tax__' ? 0.2 : 1 }}
                              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
                              className="h-full shrink-0 cursor-default"
                              style={{ background: TAX_COLOR }}
                              onMouseMove={e => { setHoveredCat('__tax__'); setTip({ kind: 'seg', x: e.clientX, y: e.clientY, name: 'Tax', amount: b.taxAmt, pct: round2((b.taxAmt / b.total) * 100), color: TAX_COLOR }); }}
                              onMouseLeave={() => { setHoveredCat(null); setTip(null); }}
                            />
                          )}
                          {b.tipAmt > 0.01 && (
                            <motion.div
                              layout
                              initial={{ width: 0 }}
                              animate={{ width: `${(b.tipAmt / maxTotal) * 100}%`, opacity: hoveredCat && hoveredCat !== '__tip__' ? 0.2 : 1 }}
                              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                              className="h-full shrink-0 cursor-default"
                              style={{ background: TIP_COLOR }}
                              onMouseMove={e => { setHoveredCat('__tip__'); setTip({ kind: 'seg', x: e.clientX, y: e.clientY, name: 'Tip', amount: b.tipAmt, pct: round2((b.tipAmt / b.total) * 100), color: TIP_COLOR }); }}
                              onMouseLeave={() => { setHoveredCat(null); setTip(null); }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="pt-2 border-t flex flex-wrap gap-x-3 gap-y-1" style={{ borderColor: 'var(--analytics-divider)' }}>
                    {activeCats.map(cat => (
                      <div key={cat} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SLICE_COLORS[cat] }} />
                        <span className="text-[9px] text-gray-400 dark:text-slate-500">{t(`cat.${cat}`)}</span>
                      </div>
                    ))}
                    {breakdown.some(b => b.taxAmt > 0.01) && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TAX_COLOR }} />
                        <span className="text-[9px] text-gray-400 dark:text-slate-500">{t('cat.Tax')}</span>
                      </div>
                    )}
                    {breakdown.some(b => b.tipAmt > 0.01) && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TIP_COLOR }} />
                        <span className="text-[9px] text-gray-400 dark:text-slate-500">{t('cat.Tip')}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </div>
  );
}

// ─── Widget C: Spending Velocity ──────────────────────────────────────────────

function WidgetVelocity({ expenses, fmt, loading, convert, currency, isDark }: {
  expenses: Expense[];
  fmt:      (n: number) => string;
  loading:  boolean;
  convert:  (a: number, from: string, to: string) => number;
  currency: string;
  isDark:   boolean;
}) {
  const { t } = useTranslation('analytics');
  const { data, curr, velocity } = useMemo(() => getVelocityData(expenses), [expenses]);
  const { impact: fxImpact, count: fxCount } = useMemo(() => getFXImpact(expenses, convert, currency), [expenses, convert, currency]);
  const isUp     = velocity !== null && velocity > 0;

  const dateExpenseMap = useMemo(() => {
    const map: Record<string, Expense[]> = {};
    for (const e of expenses) {
      if (!e.date) continue;
      const key = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [expenses]);

  const insight = velocity !== null
    ? t('velocity.insight', { dir: isUp ? t('velocity.up') : t('velocity.down'), pct: Math.abs(velocity).toFixed(1) })
    : t('velocity.insightNone');

  const gridStroke = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const tickFill   = isDark ? '#475569' : '#94a3b8';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 shadow-sm"
      style={{ background: 'var(--analytics-card-bg)', borderColor: 'var(--analytics-card-border)' }}
    >
      <div className="pointer-events-none absolute -bottom-10 left-1/3 w-64 h-20 bg-violet-600/10 blur-3xl" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/20 shrink-0">
            <TrendingUp size={13} className="text-violet-500 dark:text-violet-400" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{t('velocity.title')}</span>
          <span className="text-[11px] text-gray-400 dark:text-slate-500">{t('velocity.thirtyDay')}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {velocity !== null && (
            <div className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border',
              isUp ? 'bg-rose-500/12 border-rose-500/25 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/12 border-emerald-500/25 text-emerald-600 dark:text-emerald-400',
            )}>
              {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {isUp ? '↑' : '↓'} {Math.abs(velocity).toFixed(1)}%
            </div>
          )}
          <div className="text-right">
            <p className="text-[10px] text-gray-400 dark:text-slate-500">{t('velocity.total')}</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(curr)}</p>
          </div>
          <InsightBadge insight={insight} />
        </div>
      </div>

      {loading ? <LineSkeleton /> : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={isDark ? 0.5 : 0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <filter id="lineGlow" x="-20%" y="-100%" width="140%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: tickFill, fontSize: 9 }} tickLine={false} axisLine={false} interval={6} />
            <YAxis width={62} tick={{ fill: tickFill, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => fmt(v as number)} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const dayExps = (dateExpenseMap[label as string] ?? [])
                  .sort((a, b) => b.totalAmount - a.totalAmount)
                  .slice(0, 3);
                return (
                  <div
                    className="rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[160px]"
                    style={{
                      background:  'var(--analytics-tooltip-bg)',
                      border:      '1px solid var(--analytics-tooltip-border)',
                      boxShadow:   '0 20px 60px rgba(109,40,217,0.15)',
                    }}
                  >
                    <p className="text-gray-400 dark:text-slate-400 mb-0.5">{label as string}</p>
                    <p className="text-violet-600 dark:text-violet-300 font-bold mb-2">{fmt((payload[0] as { value: number }).value)}</p>
                    {dayExps.length > 0 && (
                      <div className="space-y-1 border-t pt-2" style={{ borderColor: 'var(--analytics-divider)' }}>
                        <p className="text-[9px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t('velocity.largeExpenses')}</p>
                        {dayExps.map(e => (
                          <div key={e.id} className="flex items-center justify-between gap-3">
                            <span className="text-gray-500 dark:text-slate-400 truncate max-w-[100px]">{e.description}</span>
                            <span className="text-gray-800 dark:text-slate-200 font-semibold shrink-0">{fmt(e.totalAmount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="monotone" dataKey="amount"
              stroke="#8b5cf6" strokeWidth={2.5}
              fill="url(#velGrad)" filter="url(#lineGlow)"
              dot={false} activeDot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!loading && fxImpact !== 0 && (
        <div className="mt-4 flex items-start gap-3 px-3 py-2.5 rounded-xl border" style={{ background: 'var(--analytics-sub-row)', borderColor: 'var(--analytics-card-border)' }}>
          <Globe size={13} className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{t('velocity.fxTitle')}</p>
            <p className="text-xs text-gray-600 dark:text-slate-300 leading-snug">
              {t('velocity.fxDesc', { count: fxCount })}
              {' '}{t('velocity.fxSuffix')}{' '}
              {fxImpact > 0
                ? <><span className="text-rose-600 dark:text-rose-400 font-semibold">{t('velocity.fxMore', { amount: fmt(fxImpact) })}</span></>
                : <><span className="text-emerald-600 dark:text-emerald-400 font-semibold">{t('velocity.fxLess', { amount: fmt(Math.abs(fxImpact)) })}</span></>
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Analytics page ──────────────────────────────────────────────────────

export default function Analytics({ groups }: Props) {
  const { t } = useTranslation('analytics');
  const { formatPrice, currency, convert } = useCurrency();
  const isDark = useIsDark();

  const [view,            setView           ] = useState<'summary' | 'group'>('summary');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groups[0]?.id ?? null);
  const [expenseMap,      setExpenseMap     ] = useState<Record<string, Expense[]>>({});
  const [participantMap,  setParticipantMap ] = useState<Record<string, Participant[]>>({});
  const [loading,         setLoading        ] = useState(false);

  const loadGroup = useCallback(async (groupId: string, force = false) => {
    if (!force && expenseMap[groupId]) return;
    setLoading(true);
    const [{ data: exps }, { data: parts }] = await Promise.all([
      fetchExpenses(groupId),
      fetchParticipants(groupId),
    ]);
    setExpenseMap(prev    => ({ ...prev, [groupId]: exps   ?? [] }));
    setParticipantMap(prev => ({ ...prev, [groupId]: parts ?? [] }));
    setLoading(false);
  }, [expenseMap]);

  const loadAll = useCallback(async () => {
    const missing = groups.filter(g => !expenseMap[g.id]);
    if (!missing.length) return;
    setLoading(true);
    const results = await Promise.all(
      missing.map(g =>
        Promise.all([fetchExpenses(g.id), fetchParticipants(g.id)])
          .then(([e, p]) => ({ id: g.id, exps: e.data ?? [], parts: p.data ?? [] })),
      ),
    );
    setExpenseMap(prev    => { const n = { ...prev }; results.forEach(r => { n[r.id] = r.exps; });  return n; });
    setParticipantMap(prev => { const n = { ...prev }; results.forEach(r => { n[r.id] = r.parts; }); return n; });
    setLoading(false);
  }, [groups, expenseMap]);

  useEffect(() => {
    if (view === 'summary')   loadAll();
    else if (selectedGroupId) loadGroup(selectedGroupId);
  }, [view, selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selecting a group while on Summary auto-switches to Group view
  function handleGroupSelect(id: string) {
    setSelectedGroupId(id);
    if (view === 'summary') setView('group');
  }

  const activeExpenses = useMemo<Expense[]>(() => {
    if (view === 'summary') return Object.values(expenseMap).flat();
    return expenseMap[selectedGroupId ?? ''] ?? [];
  }, [view, selectedGroupId, expenseMap]);

  const activeParticipants = useMemo<Participant[]>(() => {
    if (view === 'summary') {
      const seen = new Set<string>();
      return Object.values(participantMap).flat().filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    }
    return participantMap[selectedGroupId ?? ''] ?? [];
  }, [view, selectedGroupId, participantMap]);

  function handleRefresh() {
    if (view === 'summary') groups.forEach(g => loadGroup(g.id, true));
    else if (selectedGroupId) loadGroup(selectedGroupId, true);
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-gray-50 dark:bg-slate-950">

      {/* ── Header ── */}
      <div className="border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex flex-wrap items-center gap-3">

          <div className="flex items-center gap-2 mr-auto">
            <BarChart3 size={16} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">{t('title')}</h2>
          </div>

          {/* Summary / Group toggle */}
          <div
            className="flex items-center p-0.5 rounded-xl border"
            style={{ background: 'var(--analytics-toggle-bg)', borderColor: 'var(--analytics-toggle-border)' }}
          >
            {(['summary', 'group'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 rounded-[10px] text-xs font-semibold capitalize transition-all',
                  view === v
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-900/60'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200',
                )}
              >
                {v === 'summary' ? t('summary') : t('group')}
              </button>
            ))}
          </div>

          {/* Group dropdown — always visible; selecting on Summary auto-switches to Group */}
          {groups.length > 0 && (
            <GroupDropdown
              groups={groups}
              value={selectedGroupId}
              onChange={handleGroupSelect}
            />
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/8 transition-colors disabled:opacity-40"
            aria-label={t('title')}
          >
            {loading
              ? <Loader2 size={14} className="animate-spin text-violet-500 dark:text-violet-400" />
              : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {/* ── Bento grid ── */}
      <div className="max-w-6xl mx-auto px-5 py-5">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <BarChart3 size={28} className="text-violet-500/60" />
            </div>
            <p className="text-gray-400 dark:text-slate-500 text-sm">{t('noGroups')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Row 1: Donut (1col) + Peer (2col) */}
            <div className="lg:col-span-1">
              <WidgetDonut expenses={activeExpenses} fmt={formatPrice} loading={loading} />
            </div>
            <div className="lg:col-span-2 min-h-[500px]">
              <WidgetPeer participants={activeParticipants} expenses={activeExpenses} fmt={formatPrice} loading={loading} />
            </div>

            {/* Row 2: Savings (1col) + Velocity (2col) */}
            <div className="lg:col-span-1">
              <WidgetSavings expenses={activeExpenses} fmt={formatPrice} loading={loading} />
            </div>
            <div className="lg:col-span-2">
              <WidgetVelocity
                expenses={activeExpenses}
                fmt={formatPrice}
                loading={loading}
                convert={convert}
                currency={currency}
                isDark={isDark}
              />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
