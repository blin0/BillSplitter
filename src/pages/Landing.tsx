import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FALLBACK_RATES } from '../constants/fallbackRates';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { fetchLiveRates } from '../lib/currency';
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionTemplate,
} from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import AuthCard from '../components/AuthCard';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_MEMBERS = ['Alex', 'Jamie', 'Sam', 'Riley'];

const MOCK_EXPENSES = [
  { id: 1, desc: 'Hotel (3 nights)', amount: 420, payer: 'Alex' },
  { id: 2, desc: 'Sushi dinner',     amount: 185, payer: 'Jamie' },
  { id: 3, desc: 'Bullet train',     amount: 240, payer: 'Sam' },
  { id: 4, desc: 'Teamlab Planets',  amount: 96,  payer: 'Riley' },
];

const MOCK_SETTLEMENTS = [
  { from: 'Riley', to: 'Alex',  amount: 62.75 },
  { from: 'Jamie', to: 'Alex',  amount: 28.50 },
  { from: 'Sam',   to: 'Riley', amount: 14.25 },
];

const BEFORE_TXNS = 9;
const AFTER_TXNS  = 3;

// ─── Bento card widgets ───────────────────────────────────────────────────────

// ── 1. Multi-currency: live exchange rate board ───────────────────────────────

// ── Currency widget config ────────────────────────────────────────────────────
// Master list of 19 currencies. Desktop shows all except the chosen base (18).
// Mobile shows a fixed 6 — no base selector, no change column.

const ALL_WIDGET_CURRENCIES = [
  { code: 'USD', flag: '🇺🇸' },
  { code: 'EUR', flag: '🇪🇺' },
  { code: 'GBP', flag: '🇬🇧' },
  { code: 'JPY', flag: '🇯🇵' },
  { code: 'CNY', flag: '🇨🇳' },
  { code: 'CAD', flag: '🇨🇦' },
  { code: 'AUD', flag: '🇦🇺' },
  { code: 'INR', flag: '🇮🇳' },
  { code: 'KRW', flag: '🇰🇷' },
  { code: 'CHF', flag: '🇨🇭' },
  { code: 'SGD', flag: '🇸🇬' },
  { code: 'NZD', flag: '🇳🇿' },
  { code: 'MXN', flag: '🇲🇽' },
  { code: 'BRL', flag: '🇧🇷' },
  { code: 'HKD', flag: '🇭🇰' },
  { code: 'SEK', flag: '🇸🇪' },
  { code: 'NOK', flag: '🇳🇴' },
  { code: 'ZAR', flag: '🇿🇦' },
  { code: 'THB', flag: '🇹🇭' },
] as const;

const MOBILE_WIDGET_CURRENCIES = ['EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD'] as const;

const BASE_OPTIONS = ['USD', 'EUR', 'GBP', 'JPY'] as const;
type WidgetBase = typeof BASE_OPTIONS[number];

// Reads the same localStorage cache that CurrencyContext writes
const RATES_CACHE_KEY = 'billsplitter_rates_v1';
const RATES_TTL_MS    = 24 * 60 * 60 * 1000;

interface RatesCacheEntry {
  timestamp:     number;
  rates:         Record<string, number>;
  previousRates: Record<string, number> | null;
}

function readRatesCache(): RatesCacheEntry | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RatesCacheEntry;
    if (Date.now() - parsed.timestamp >= RATES_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

/** Format a cross-rate for display regardless of magnitude */
function fmtRate(rate: number): string {
  if (rate >= 10000) return rate.toFixed(0);
  if (rate >= 1000)  return rate.toFixed(1);
  if (rate >= 10)    return rate.toFixed(2);
  return rate.toFixed(4);
}

/** ±% change badge — null when no previous data yet */
function changePct(
  code:       string,
  eurRates:   Record<string, number>,
  prevRates:  Record<string, number> | null,
  baseEur:    number,
  prevBaseEur: number | null,
): number | null {
  if (!prevRates || !prevBaseEur) return null;
  const cur  = (eurRates[code]  ?? 1) / baseEur;
  const prev = (prevRates[code] ?? 1) / prevBaseEur;
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function CurrencyRatesWidget() {
  const cached = readRatesCache();
  const [eurRates,  setEurRates ] = useState<Record<string, number>>(cached?.rates         ?? FALLBACK_RATES);
  const [prevRates, setPrevRates] = useState<Record<string, number> | null>(cached?.previousRates ?? null);
  const [base,      setBase     ] = useState<WidgetBase>('USD');

  useEffect(() => {
    if (readRatesCache()) return; // still fresh
    fetchLiveRates()
      .then(({ rates, previousRates }) => {
        setEurRates(rates);
        setPrevRates(previousRates);
      })
      .catch(() => { /* already showing fallback */ });
  }, []);

  // EUR-relative rate for the chosen base (used to convert all cross-rates)
  const baseEur     = eurRates[base]  ?? FALLBACK_RATES[base] ?? 1;
  const prevBaseEur = prevRates ? (prevRates[base] ?? null) : null;

  // Desktop: all 19 currencies minus the selected base (= 18 rows)
  // Mobile:  fixed 6, no base selector
  const desktopRows = ALL_WIDGET_CURRENCIES
    .filter(c => c.code !== base)
    .map(c => ({
      code:   c.code,
      flag:   c.flag,
      rate:   (eurRates[c.code] ?? FALLBACK_RATES[c.code] ?? 1) / baseEur,
      change: changePct(c.code, eurRates, prevRates, baseEur, prevBaseEur),
    }));

  const mobileRows = ALL_WIDGET_CURRENCIES
    .filter(c => MOBILE_WIDGET_CURRENCIES.includes(c.code as typeof MOBILE_WIDGET_CURRENCIES[number]))
    .map(c => ({
      code:   c.code,
      flag:   c.flag,
      rate:   (eurRates[c.code] ?? FALLBACK_RATES[c.code] ?? 1) / baseEur,
      change: null, // keep mobile UI clean
    }));

  const rows = IS_MOBILE ? mobileRows : desktopRows;

  // Log-scale bars so JPY/KRW don't visually crush EUR/GBP
  const logs    = rows.map(r => Math.log(r.rate + 0.01));
  const minLog  = Math.min(...logs);
  const logSpan = (Math.max(...logs) - minLog) || 1;
  const barPct  = (rate: number) =>
    15 + ((Math.log(rate + 0.01) - minLog) / logSpan) * 80; // 15–95%

  const hasChange = rows.some(r => r.change !== null);

  return (
    <div className="flex flex-col gap-1.5 w-full">

      {/* Header — base selector (desktop only) + live pulse */}
      <div className="flex items-center justify-between mb-1">
        {IS_MOBILE ? (
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">1 USD =</span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 font-mono mr-0.5">1</span>
            {BASE_OPTIONS.map(b => (
              <button
                key={b}
                onClick={() => setBase(b)}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md transition-colors ${
                  base === b
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                {b}
              </button>
            ))}
            <span className="text-[10px] text-slate-500 font-mono ml-0.5">=</span>
          </div>
        )}
        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          Live
        </span>
      </div>

      {/* Column headers when change data is available */}
      {!IS_MOBILE && hasChange && (
        <div className="flex items-center gap-2.5 px-3 mb-0.5">
          <span className="w-4 shrink-0" />
          <span className="text-[8px] text-slate-600 font-mono w-8 shrink-0">CODE</span>
          <span className="flex-1" />
          <span className="text-[8px] text-slate-600 font-mono w-14 text-right shrink-0">RATE</span>
          <span className="text-[8px] text-slate-600 font-mono w-14 text-right shrink-0">24H</span>
        </div>
      )}

      {rows.map((r, i) => {
        const delay    = IS_MOBILE ? 0.03 * i : 0.04 * i;
        const barDelay = IS_MOBILE ? 0.06 + i * 0.03 : 0.08 + i * 0.04;
        const pct      = r.change;
        return (
          <motion.div
            key={`${base}-${r.code}`}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.035] border border-white/[0.06]"
            initial={{ opacity: 0, x: IS_MOBILE ? 0 : -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-20px 0px' }}
            transition={{ delay, duration: IS_MOBILE ? 0.3 : 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-sm leading-none select-none shrink-0">{r.flag}</span>
            <span className="text-[11px] font-mono font-semibold text-slate-300 w-8 shrink-0">{r.code}</span>
            {/* log-scale bar */}
            <div className="flex-1 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400"
                initial={{ width: 0 }}
                whileInView={{ width: `${barPct(r.rate)}%` }}
                viewport={{ once: true }}
                transition={{ delay: barDelay, duration: IS_MOBILE ? 0.5 : 0.55, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            {/* Rate */}
            <span className="text-[11px] font-mono tabular-nums text-white/70 w-14 text-right shrink-0">
              {fmtRate(r.rate)}
            </span>
            {/* ±change — desktop only, placeholder dash when no history yet */}
            {!IS_MOBILE && (
              <span className={`text-[9px] font-mono tabular-nums w-14 text-right shrink-0 ${
                pct === null
                  ? 'text-slate-700'
                  : pct >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
              }`}>
                {pct === null
                  ? '—'
                  : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
              </span>
            )}
          </motion.div>
        );
      })}

      {/* Footnote when no history yet */}
      {!IS_MOBILE && !hasChange && (
        <p className="text-[8px] text-slate-700 font-mono mt-1 text-center">
          24h change available after first daily refresh
        </p>
      )}
    </div>
  );
}



// ── 2. Smart Settle: before → after simplification animation ─────────────────

const SETTLE_BEFORE = [
  { from: 'Alex',  to: 'Jamie', amt: '$28' },
  { from: 'Riley', to: 'Alex',  amt: '$62' },
  { from: 'Sam',   to: 'Jamie', amt: '$45' },
  { from: 'Jamie', to: 'Sam',   amt: '$19' },
];
const SETTLE_AFTER = [
  { from: 'Riley', to: 'Alex',  amt: '$62.75' },
  { from: 'Jamie', to: 'Alex',  amt: '$28.50' },
  { from: 'Sam',   to: 'Riley', amt: '$14.25' },
];
const AVATARS: Record<string, string> = { Alex: '#7c3aed', Jamie: '#4f46e5', Sam: '#0891b2', Riley: '#059669' };

function SmartSettleWidget() {
  const [phase, setPhase] = useState<'before' | 'processing' | 'after'>('before');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('processing'), 2200);
    const t2 = setTimeout(() => setPhase('after'),      3400);
    const t3 = setTimeout(() => setPhase('before'),     6000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Restart loop
  useEffect(() => {
    if (phase !== 'before') return;
    const t = setTimeout(() => {
      setPhase('processing');
      setTimeout(() => setPhase('after'), 1200);
      setTimeout(() => setPhase('before'), 4000);
    }, 2200);
    return () => clearTimeout(t);
  }, [phase]);

  const rows = phase === 'after' ? SETTLE_AFTER : SETTLE_BEFORE;

  return (
    <div className="w-full space-y-2">
      {/* counter badge */}
      <div className="flex items-center justify-between mb-1">
        <motion.span
          key={phase}
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
            phase === 'after'
              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
              : 'text-slate-400 border-white/10 bg-white/[0.04]'
          }`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {phase === 'processing' ? 'Optimising…' : phase === 'after' ? '✓ 3 transfers' : `${SETTLE_BEFORE.length} transfers`}
        </motion.span>
        <span className="text-[9px] text-slate-600 font-mono uppercase tracking-wide">
          {phase === 'after' ? 'settled' : 'pending'}
        </span>
      </div>

      {phase === 'processing' ? (
        <div className="flex items-center justify-center h-[88px]">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-t-violet-500 border-white/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      ) : (
        rows.map((r, i) => (
          <motion.div
            key={`${phase}-${i}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.035] border border-white/[0.06]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{ background: AVATARS[r.from] }}
            >
              {r.from[0]}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">→</span>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{ background: AVATARS[r.to] }}
            >
              {r.to[0]}
            </span>
            <span className="flex-1 text-[10px] text-slate-500 font-mono truncate">{r.from} → {r.to}</span>
            <span className={`text-[11px] font-mono font-semibold tabular-nums shrink-0 ${phase === 'after' ? 'text-emerald-400' : 'text-slate-300'}`}>
              {r.amt}
            </span>
          </motion.div>
        ))
      )}
    </div>
  );
}


// ── 3. Real-time sync: live activity feed ────────────────────────────────────

const FEED_ITEMS = [
  { user: 'Alex',  action: 'added',  item: 'Hotel (3 nights)', amt: '+$420.00', color: '#7c3aed' },
  { user: 'Jamie', action: 'split',  item: 'Sushi dinner',     amt: '+$185.00', color: '#4f46e5' },
  { user: 'Sam',   action: 'added',  item: 'Bullet train',     amt: '+$240.00', color: '#0891b2' },
  { user: 'Riley', action: 'paid',   item: 'Teamlab Planets',  amt: '-$62.75',  color: '#059669' },
];

function RealtimeFeedWidget() {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    if (visible >= FEED_ITEMS.length) return;
    const t = setTimeout(() => setVisible(v => v + 1), 1100);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Activity</span>
        <span className="flex items-center gap-1.5 text-[10px] text-violet-400 font-mono">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block"
            animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          Syncing
        </span>
      </div>
      {FEED_ITEMS.slice(0, visible).map((item, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.035] border border-white/[0.06]"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
            style={{ background: item.color }}
          >
            {item.user[0]}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{item.user} <span className="text-slate-600">{item.action}</span></span>
          <span className="flex-1 text-[10px] text-slate-500 truncate">{item.item}</span>
          <span className={`text-[11px] font-mono font-semibold shrink-0 tabular-nums ${item.amt.startsWith('+') ? 'text-violet-300' : 'text-emerald-400'}`}>
            {item.amt}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// ── 4. Spending Insights: full analytics dashboard ───────────────────────────

const MONTHLY = [
  { month: 'Jan', v: 0.34 }, { month: 'Feb', v: 0.55 },
  { month: 'Mar', v: 0.72 }, { month: 'Apr', v: 0.45 },
  { month: 'May', v: 0.89 }, { month: 'Jun', v: 1.00 },
];
const CATEGORIES_DATA = [
  { label: 'Accommodation', pct: 48, color: '#7c3aed' },
  { label: 'Food & Dining',  pct: 32, color: '#4f46e5' },
  { label: 'Transport',      pct: 15, color: '#0891b2' },
  { label: 'Activities',     pct:  5, color: '#059669' },
];

function SpendingInsightsWidget() {
  // SVG chart — viewBox 340 × 80, with horizontal padding so edge
  // points are inset and labels never bleed outside the viewBox.
  const W = 340; const H = 80; const PX = 12;
  const chartW = W - PX * 2;

  const pts = MONTHLY.map((d, i) => ({
    x: PX + (i / (MONTHLY.length - 1)) * chartW,
    y: H - d.v * (H - 18) - 10,
  }));

  const linePath = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx.toFixed(1)},${prev.y.toFixed(1)} ${cx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`;

  // Observe the wrapper div — HTML IntersectionObserver is reliable on all
  // browsers. We drive the motion.g animation imperatively via `animate` so
  // we avoid animating inside an SVG <clipPath>, which breaks on mobile WebKit.
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInView = useInView(chartRef, { once: true, margin: '-20px 0px' });

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-1">Group Spending · Jun 2025</p>
          <motion.p
            className="text-2xl font-bold tabular-nums tracking-tight"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            $1,241<span className="text-slate-500 text-lg">.50</span>
          </motion.p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
            ↑ 12.4%
          </span>
          <span className="text-[9px] text-slate-600 font-mono">vs last month</span>
        </div>
      </div>

      {/* Area chart — ref on the div so IntersectionObserver targets an HTML element */}
      <div ref={chartRef} className="relative rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.05] p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
          <defs>
            <linearGradient id="si-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal guide lines */}
          {[0.25, 0.5, 0.75].map(t => (
            <line key={t}
              x1={PX} y1={H - t * (H - 18) - 10}
              x2={W - PX} y2={H - t * (H - 18) - 10}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1"
            />
          ))}

          {/* Chart paths — faded in as a group once the wrapper div enters the viewport */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={chartInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
          >
            <path d={areaPath} fill="url(#si-fill)" />
            <path d={linePath} stroke="#7c3aed" strokeWidth="4" fill="none"
              strokeLinecap="round" opacity="0.25" style={{ filter: 'blur(4px)' }} />
            <path d={linePath} stroke="#a78bfa" strokeWidth="1.5" fill="none"
              strokeLinecap="round" />
          </motion.g>

          {/* Month labels — start/end anchors on edges so labels stay inside viewBox */}
          {pts.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={H - 1}
              textAnchor={i === 0 ? 'start' : i === MONTHLY.length - 1 ? 'end' : 'middle'}
              fontSize="7"
              fill="rgba(148,163,184,0.5)"
              fontFamily="ui-monospace,monospace"
            >
              {MONTHLY[i].month}
            </text>
          ))}

          {/* Peak dot (Jun) */}
          <motion.circle cx={pts[5].x} cy={pts[5].y} r={3.5}
            fill="#0f0a1e" stroke="#a78bfa" strokeWidth="1.5"
            animate={{ r: [3, 5, 3], strokeOpacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <circle cx={pts[5].x} cy={pts[5].y} r={1.5} fill="#a78bfa" />
        </svg>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {CATEGORIES_DATA.map((cat, i) => (
          <div key={cat.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-slate-500 truncate">{cat.label}</span>
                <span className="text-[9px] font-mono text-slate-400 shrink-0 ml-1">{cat.pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: cat.color }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${cat.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 5. Smart Roles: permission hierarchy ─────────────────────────────────────

const ROLE_MEMBERS = [
  { name: 'Alex',  role: 'Admin',  color: '#f59e0b', perms: ['Add', 'Edit', 'Delete', 'Invite'] },
  { name: 'Jamie', role: 'Editor', color: '#7c3aed', perms: ['Add', 'Edit'] },
  { name: 'Sam',   role: 'Editor', color: '#4f46e5', perms: ['Add', 'Edit'] },
  { name: 'Riley', role: 'Viewer', color: '#64748b', perms: ['View'] },
];

function SmartRolesWidget() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % ROLE_MEMBERS.length), 1800);
    return () => clearInterval(t);
  }, []);

  const m = ROLE_MEMBERS[active];

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Members</span>
        <span className="text-[9px] text-slate-600 font-mono">4 people</span>
      </div>
      {ROLE_MEMBERS.map((member, i) => (
        <motion.div
          key={member.name}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors cursor-default"
          animate={{
            background: active === i ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
            borderColor: active === i ? `${member.color}40` : 'rgba(255,255,255,0.06)',
          }}
          transition={{ duration: 0.3 }}
          onMouseEnter={() => setActive(i)}
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ background: member.color }}
          >
            {member.name[0]}
          </span>
          <span className="text-[11px] font-medium text-slate-300 flex-1">{member.name}</span>
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border"
            style={{ color: member.color, borderColor: `${member.color}50`, background: `${member.color}15` }}
          >
            {member.role}
          </span>
        </motion.div>
      ))}
      {/* Permission chips */}
      <div className="pt-1 flex flex-wrap gap-1">
        {['Add', 'Edit', 'Delete', 'Invite', 'View'].map(perm => (
          <motion.span
            key={perm}
            className="text-[9px] font-mono px-2 py-0.5 rounded-full border"
            animate={{
              color: m.perms.includes(perm) ? '#a78bfa' : 'rgba(100,116,139,0.5)',
              borderColor: m.perms.includes(perm) ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)',
              background: m.perms.includes(perm) ? 'rgba(139,92,246,0.1)' : 'transparent',
            }}
            transition={{ duration: 0.25 }}
          >
            {perm}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

// ── 6. Precision Totals: animated receipt ────────────────────────────────────

function PrecisionTotalsWidget() {
  const subtotal = 185.00;
  const tax      = subtotal * 0.0825;
  const tip      = subtotal * 0.18;
  const total    = subtotal + tax + tip;
  const perHead  = total / 4;

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Sushi Dinner</span>
        <span className="text-[9px] text-slate-600 font-mono">Tokyo · 4 ppl</span>
      </div>

      {[
        { label: 'Subtotal',   value: subtotal, color: 'text-slate-300',   delay: 0.1, barW: '100%', barColor: '#7c3aed' },
        { label: 'Tax (8.25%)',value: tax,       color: 'text-amber-400',  delay: 0.2, barW: '52%',  barColor: '#f59e0b' },
        { label: 'Tip (18%)',  value: tip,       color: 'text-fuchsia-400',delay: 0.3, barW: '72%',  barColor: '#d946ef' },
      ].map(row => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">{row.label}</span>
            <motion.span
              className={`text-[11px] font-mono tabular-nums ${row.color}`}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: row.delay }}
            >
              ${row.value.toFixed(2)}
            </motion.span>
          </div>
          <div className="h-[3px] rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: row.barColor }}
              initial={{ width: 0 }}
              whileInView={{ width: row.barW }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: row.delay + 0.1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      ))}

      <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-semibold">Total</span>
        <motion.span
          className="text-base font-bold tabular-nums text-white"
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.45, type: 'spring', stiffness: 200 }}
        >
          ${total.toFixed(2)}
        </motion.span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-600">÷ 4 people</span>
        <span className="text-[11px] font-mono text-violet-300 font-semibold tabular-nums">
          ${perHead.toFixed(2)} each
        </span>
      </div>
    </div>
  );
}

// ── 7. Secure by default: RLS row-lock visualization ─────────────────────────

const RLS_ROWS = [
  { group: 'Tokyo Trip 🇯🇵',    accessible: true  },
  { group: 'Flat · London 🇬🇧',  accessible: true  },
  { group: "Sarah's Hike 🏔",    accessible: false },
  { group: 'Work Lunch 🍱',       accessible: false },
];

function SecurityWidget() {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Your groups</span>
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
          <span className="text-[8px]">🔐</span> RLS active
        </span>
      </div>
      {RLS_ROWS.map((row, i) => (
        <motion.div
          key={row.group}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
          style={{
            background:     row.accessible ? 'rgba(5,150,105,0.06)'  : 'rgba(255,255,255,0.02)',
            borderColor:    row.accessible ? 'rgba(5,150,105,0.2)'   : 'rgba(255,255,255,0.05)',
          }}
          initial={{ opacity: 0, x: 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
        >
          <span className="text-sm leading-none select-none">
            {row.accessible ? '🔓' : '🔒'}
          </span>
          <span className={`flex-1 text-[11px] truncate ${row.accessible ? 'text-slate-300' : 'text-slate-600'}`}>
            {row.group}
          </span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border shrink-0 ${
            row.accessible
              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
              : 'text-slate-600   border-white/[0.06]   bg-transparent'
          }`}>
            {row.accessible ? 'visible' : 'hidden'}
          </span>
        </motion.div>
      ))}
      <p className="text-[9px] text-slate-600 pt-1 leading-relaxed">
        Row-level security — other users' groups are invisible, not just locked.
      </p>
    </div>
  );
}

// ─── Mobile detection ─────────────────────────────────────────────────────────

/** True for phone/tablet viewports — evaluated once at module load, no rerenders */
const IS_MOBILE =
  typeof window !== 'undefined' &&
  (window.matchMedia('(max-width: 768px)').matches ||
   window.matchMedia('(pointer: coarse)').matches);

// ─── Animation helpers ────────────────────────────────────────────────────────

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

// ─── Bento card ───────────────────────────────────────────────────────────────

/**
 * BentoCard — a glassmorphism card with two hover interactions:
 *   1. Spotlight: a radial purple glow that follows the mouse cursor inside the
 *      card, implemented via CSS variables --glow-x / --glow-y on the element.
 *   2. Scale + border: Framer Motion lifts the card (scale 1→1.015) and a second
 *      border overlay fades from transparent → violet/30 on hover.
 */
function BentoCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const { left, top } = el.getBoundingClientRect();
    el.style.setProperty('--glow-x', `${e.clientX - left}px`);
    el.style.setProperty('--glow-y', `${e.clientY - top}px`);
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={IS_MOBILE ? undefined : handleMouseMove}
      // Disable scale-on-hover on touch devices — pointer events fire during
      // scroll and the mid-scroll scale change confuses the browser's gesture
      // classifier, causing it to drop the scroll.
      whileHover={IS_MOBILE ? undefined : { scale: 1.015, zIndex: 10 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      // pan-y: tell the browser vertical touch is always a scroll, not a tap
      style={{ touchAction: 'pan-y' }}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] ${className}`}
    >
      {/* Glassmorphism top sheen — bg-gradient-to-b from-white/5 to-transparent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-2xl bg-gradient-to-b from-white/[0.06] to-transparent" />
      {/* Spotlight glow — radial gradient anchored to cursor position */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(420px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(139,92,246,0.16), transparent 65%)',
        }}
      />
      {/* Brightened border overlay on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-violet-500/0 group-hover:border-violet-400/35 transition-colors duration-300" />
      {children}
    </motion.div>
  );
}

/**
 * Wraps children in a motion.div that fades + slides up when it enters the viewport.
 * `once: true` means it only fires once — no re-hiding on scroll back up.
 */
function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // On mobile: skip scroll-triggered animation entirely.
  // useInView fires IntersectionObserver callbacks mid-scroll, which trigger
  // React state updates and y-translate reflows on the main thread — both
  // cause jank and can drop the scroll gesture.
  if (IS_MOBILE) {
    return <div className={className}>{children}</div>;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const inView = useInView(ref, { once: true, margin: '-40px 0px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.65, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Parallax background ──────────────────────────────────────────────────────

/** Deterministic pseudo-random (0–1) from a seed, no Math.random() */
function pr(seed: number): number {
  return Math.abs(Math.sin(seed * 127.1 + 311.7) % 1);
}

interface ParticleConfig {
  id:       number;
  x:        number;   // % from left
  y:        number;   // % from top
  size:     number;   // px
  factor:   number;   // parallax speed multiplier
  opacity:  number;
  duration: number;   // twinkle cycle seconds
  delay:    number;
  color:    string;
}

const PARTICLE_COLORS = ['#a78bfa', '#818cf8', '#c4b5fd', '#6366f1', '#e879f9', '#ffffff'];

const PARTICLES: ParticleConfig[] = Array.from({ length: 20 }, (_, i) => ({
  id:       i,
  x:        pr(i * 3.7)   * 100,
  y:        pr(i * 11.1)  * 100,
  size:     1 + pr(i * 5.3) * 1.5,
  factor:   0.08 + pr(i * 7.9) * 0.28,
  opacity:  0.20 + pr(i * 13.3) * 0.55,
  duration: 4 + pr(i * 2.1) * 6,
  delay:    pr(i * 17.7) * 4,
  color:    PARTICLE_COLORS[Math.floor(pr(i * 23.1) * PARTICLE_COLORS.length)],
}));

/** Single micro-particle — owns its own useTransform so hooks aren't in a loop */
function Particle({
  scrollY, x, y, size, factor, opacity, duration, delay, color, isMobile,
}: ParticleConfig & { scrollY: MotionValue<number>; isMobile: boolean }) {
  // On mobile: skip scroll parallax (return 0) — still subscribes to satisfy hook rules
  const translateY = useTransform(scrollY, (v) => isMobile ? 0 : -(v * factor));
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top:  `${y}%`,
        width:  size,
        height: size,
        borderRadius: '50%',
        background: color,
        opacity,
        y: translateY,
        willChange: 'transform',
      }}
      animate={{ opacity: [opacity * 0.35, opacity, opacity * 0.35] }}
      transition={{ duration, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

/**
 * All reactive background layers in one fixed-positioned component.
 * Uses Framer Motion's MotionValue system so transforms bypass React
 * renders entirely — runs at 60 fps via the internal rAF loop.
 *
 * On mobile (IS_MOBILE): skips the grain SVG, perspective grid, mouse
 * spotlight, and most particles — the biggest GPU cost savers.
 */
function ParallaxBackground({
  mouseX,
  mouseY,
}: {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}) {
  const { scrollY, scrollYProgress } = useScroll();

  // ── Orb parallax (always call hooks — conditionally apply values) ──
  const orbAY     = useTransform(scrollY, [0, 3000], IS_MOBILE ? [0, 0] : [0, -380]);
  const orbBY     = useTransform(scrollY, [0, 3000], IS_MOBILE ? [0, 0] : [0,  120]);
  const orbCScale = useTransform(scrollY, [0, 2000], IS_MOBILE ? [1, 1] : [1, 1.5]);

  // ── Grid floor treadmill (desktop only) ───────────────────────────
  const gridBgY = useTransform(scrollY, [0, 3000], ['0px', '500px']);

  // ── Spotlight: mouse + scroll drift (desktop only) ────────────────
  const spotX = useTransform(
    [mouseX, scrollYProgress] as MotionValue<number>[],
    ([mx, sp]: number[]) => mx + sp * (typeof window !== 'undefined' ? window.innerWidth  * 0.12 : 0),
  );
  const spotY = useTransform(
    [mouseY, scrollYProgress] as MotionValue<number>[],
    ([my, sp]: number[]) => my + sp * (typeof window !== 'undefined' ? window.innerHeight * 0.28 : 0),
  );
  const spotBg = useMotionTemplate`radial-gradient(650px circle at ${spotX}px ${spotY}px, rgba(139,92,246,0.11), transparent 65%)`;

  // Particle subset — far fewer on mobile
  const activeParticles = IS_MOBILE ? PARTICLES.slice(0, 5) : PARTICLES;

  return (
    <>
      {/* Layer 1 · Parallax orbs ─────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        {/* Orb A — top centre */}
        <motion.div
          className="blob-1 absolute -top-40 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            background: 'rgba(59,7,100,0.45)',
            filter:     IS_MOBILE ? 'blur(70px)' : 'blur(120px)',
            width:      IS_MOBILE ? 500 : 1000,
            height:     IS_MOBILE ? 400 : 800,
            y:          orbAY,
          }}
        />
        {/* Orb B — mid left (skip on mobile — saves one composited layer) */}
        {!IS_MOBILE && (
          <motion.div
            className="blob-2 absolute top-[35%] -left-72 w-[750px] h-[750px] rounded-full"
            style={{ background: 'rgba(30,27,75,0.40)', filter: 'blur(120px)', y: orbBY }}
          />
        )}
        {/* Orb C — bottom right */}
        <motion.div
          className="blob-3 absolute bottom-0 -right-24 rounded-full"
          style={{
            background: 'rgba(46,16,101,0.35)',
            filter:     IS_MOBILE ? 'blur(70px)' : 'blur(120px)',
            width:      IS_MOBILE ? 380 : 700,
            height:     IS_MOBILE ? 380 : 700,
            scale:      orbCScale,
          }}
        />
        {/* Orb D — teal accent (desktop only) */}
        {!IS_MOBILE && (
          <motion.div
            className="blob-4 absolute top-[55%] right-[5%] w-[550px] h-[550px] rounded-full"
            style={{ background: 'rgba(13,148,136,0.07)', filter: 'blur(120px)' }}
          />
        )}
      </div>

      {/* Layer 2 · Reactive grid floor — desktop only (perspective is expensive) */}
      {!IS_MOBILE && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 overflow-hidden"
          style={{ zIndex: 2, height: '65vh' }}
          aria-hidden="true"
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: 'perspective(900px) rotateX(58deg)',
              transformOrigin: 'center top',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 80%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 80%, transparent 100%)',
            }}
          >
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: [
                  'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
                  'linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
                ].join(', '),
                backgroundSize: '50px 50px',
                backgroundPositionY: gridBgY,
              }}
            />
          </div>
        </div>
      )}

      {/* Layer 3 · Dynamic spotlight — desktop only (no mouse on touch screens) */}
      {!IS_MOBILE && (
        <motion.div
          className="pointer-events-none fixed inset-0"
          style={{ zIndex: 3, background: spotBg }}
          aria-hidden="true"
        />
      )}

      {/* Layer 4 · Micro-particles (5 on mobile, 20 on desktop) ─────── */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 4 }}
        aria-hidden="true"
      >
        {activeParticles.map(p => (
          <Particle key={p.id} scrollY={scrollY} isMobile={IS_MOBILE} {...p} />
        ))}
      </div>

      {/* Layer 5 · Grain texture — desktop only (feTurbulence is GPU-heavy) */}
      {!IS_MOBILE && (
        <svg
          className="pointer-events-none fixed inset-0 w-full h-full"
          style={{ zIndex: 5 }}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <filter id="grain-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.7 0.75" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-noise)" opacity="0.038" />
        </svg>
      )}
    </>
  );
}

// ─── Auth modal ───────────────────────────────────────────────────────────────

function AuthModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <AuthCard onClose={onClose} />
      </motion.div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Landing() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  const [showAuth, setShowAuth] = useState(false);

  // Mouse position — updated via onMouseMove, read by ParallaxBackground
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (IS_MOBILE) return;
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  }

  if (loading) return (
    <div className="min-h-[100dvh] bg-[#060612] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
  if (user) return null;

  return (
    <div
      className="min-h-[100dvh] bg-[#060612] text-white [overflow-x:clip]"
      onMouseMove={IS_MOBILE ? undefined : handleMouseMove}
    >
      <ParallaxBackground mouseX={mouseX} mouseY={mouseY} />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/[0.06]"
      >
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="w-7 h-7" />
          <span className="font-bold text-lg tracking-tight">Axiom Splits</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="light" />
          <button
            onClick={() => setShowAuth(true)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            {t('landing.nav.signIn')}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 transition-colors"
          >
            {t('landing.nav.getStarted')}
          </button>
        </div>
      </motion.nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-16 md:pt-32 md:pb-24">

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-8 tracking-wide uppercase"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          {t('landing.hero.badge')}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.08] max-w-3xl mb-6"
        >
          {t('landing.hero.title1')}{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400">
            {t('landing.hero.title2')}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.3, ease: EASE }}
          className="text-slate-400 text-lg md:text-xl max-w-xl mb-10 leading-relaxed"
        >
          {t('landing.hero.subtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.42, ease: EASE }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-14"
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3.5 rounded-xl text-base font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-900/40 w-full sm:w-auto text-center"
          >
            {t('landing.hero.ctaPrimary')}
          </button>
          <a
            href="#features"
            className="px-8 py-3.5 rounded-xl text-base font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors w-full sm:w-auto text-center text-slate-300"
          >
            {t('landing.hero.ctaSecondary')}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.58, ease: EASE }}
          className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-slate-500 text-sm"
        >
          <span>{t('landing.hero.trust1')}</span>
          <span>{t('landing.hero.trust2')}</span>
          <span>{t('landing.hero.trust3')}</span>
          <span>{t('landing.hero.trust4')}</span>
        </motion.div>
      </section>

      {/* ── Smart Settle Preview Card ─────────────────────────────────────── */}
      <section className="relative z-10 flex justify-center px-6 pb-24">
        <FadeUp className="w-full max-w-lg">
          <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Group</p>
                <p className="font-semibold text-sm">Tokyo Trip 🇯🇵</p>
              </div>
              <div className="flex -space-x-2">
                {MOCK_MEMBERS.map((name, i) => (
                  <div
                    key={name}
                    className="w-7 h-7 rounded-full border-2 border-[#060612] flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: ['#7c3aed', '#4f46e5', '#a21caf', '#0891b2'][i],
                      zIndex: MOCK_MEMBERS.length - i,
                    }}
                  >
                    {name[0]}
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses */}
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Expenses</p>
              <ul className="space-y-2">
                {MOCK_EXPENSES.map(exp => (
                  <li key={exp.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                      <span className="text-slate-300 truncate">{exp.desc}</span>
                    </div>
                    <span className="text-slate-400 shrink-0 ml-3 tabular-nums">
                      ${exp.amount.toFixed(2)}
                      <span className="text-slate-600 ml-1 text-[11px]">{exp.payer}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Smart Settle result */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Smart Settle</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500 line-through">{BEFORE_TXNS} transfers</span>
                  <span className="text-emerald-400 font-semibold">→ {AFTER_TXNS} transfers</span>
                </div>
              </div>
              <ul className="space-y-2">
                {MOCK_SETTLEMENTS.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="font-medium text-slate-200">{s.from}</span>
                      <span className="text-slate-600">→</span>
                      <span className="font-medium text-slate-200">{s.to}</span>
                    </div>
                    <span className="text-emerald-400 font-semibold tabular-nums shrink-0">
                      ${s.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA inside card */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowAuth(true)}
                className="block w-full text-center py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600/80 to-indigo-600/80 hover:from-violet-500/90 hover:to-indigo-500/90 border border-violet-500/30 transition-all"
              >
                Create your group →
              </button>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── Layer 4 · Section connectors — hero → features ───────────────── */}
      <div className="relative z-10 pointer-events-none overflow-hidden" aria-hidden="true" style={{ height: '5rem', marginTop: '-2.5rem', marginBottom: '-2.5rem' }}>
        <div className="absolute inset-x-0 top-0 flex items-start justify-center gap-32 h-full">
          <div className="w-px flex-none bg-gradient-to-b from-violet-500/30 via-violet-500/10 to-transparent" style={{ height: '5rem' }} />
          <div className="w-px flex-none bg-gradient-to-b from-indigo-400/20 via-indigo-400/08 to-transparent" style={{ height: '5rem', marginTop: '1rem' }} />
          <div className="w-px flex-none bg-gradient-to-b from-fuchsia-500/20 via-fuchsia-500/08 to-transparent" style={{ height: '5rem' }} />
          <div className="w-px flex-none bg-gradient-to-b from-indigo-400/20 via-indigo-400/08 to-transparent" style={{ height: '5rem', marginTop: '1rem' }} />
          <div className="w-px flex-none bg-gradient-to-b from-violet-500/30 via-violet-500/10 to-transparent" style={{ height: '5rem' }} />
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 px-6 pb-24 max-w-7xl mx-auto">
        <FadeUp>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3 tracking-tight">
            {t('landing.features.title')}
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-lg mx-auto">
            {t('landing.features.subtitle')}
          </p>
        </FadeUp>

        {/*
          ── Bento Grid (7 cards, 3 columns) ──────────────────────────────────
          ┌─────────────────┬─────────────────┬─────────────────┐
          │  Multi-currency │  Smart Settle   │  Real-time sync │
          │  (row-span-2)   │                 │                 │
          │                 ├─────────────────┴─────────────────┤
          │                 │      Spending Insights (col-span-2)│
          ├─────────────────┼─────────────────┬─────────────────┤
          │   Smart Roles   │ Precision Totals│  Secure         │
          └─────────────────┴─────────────────┴─────────────────┘
          lg: 3 cols with spans — sm: 2 cols — mobile: 1 col
        */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          style={{ gridAutoRows: 'minmax(400px, auto)' }}
        >

          {/* ① Multi-currency — col 1, spans 2 rows — tall live rate board */}
          <FadeUp delay={0} className="sm:row-span-2 lg:row-span-2">
            <BentoCard className="h-full p-7 flex flex-col">
              <CurrencyRatesWidget />
              <div className="mt-auto pt-6 border-t border-white/[0.06]">
                <h3 className="text-xl font-bold mb-2">{t('landing.features.multicurrency.title')}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t('landing.features.multicurrency.desc')}
                </p>
              </div>
            </BentoCard>
          </FadeUp>

          {/* ② Smart Settle — col 2, row 1 */}
          <FadeUp delay={0.1}>
            <BentoCard className="h-full p-7 flex flex-col">
              <SmartSettleWidget />
              <div className="mt-auto pt-5 border-t border-white/[0.06]">
                <h3 className="text-lg font-bold mb-1.5">{t('landing.features.smartSettle.title')}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t('landing.features.smartSettle.desc')}
                </p>
              </div>
            </BentoCard>
          </FadeUp>

          {/* ③ Real-time sync — col 3, row 1 */}
          <FadeUp delay={0.2}>
            <BentoCard className="h-full p-7 flex flex-col">
              <RealtimeFeedWidget />
              <div className="mt-auto pt-5 border-t border-white/[0.06]">
                <h3 className="text-lg font-bold mb-1.5">{t('landing.features.realtime.title')}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t('landing.features.realtime.desc')}
                </p>
              </div>
            </BentoCard>
          </FadeUp>

          {/* ④ Spending Insights — col 2-3, row 2 — full analytics */}
          <FadeUp delay={0.15} className="sm:col-span-1 lg:col-span-2">
            <BentoCard className="h-full p-7 flex flex-col">
              <SpendingInsightsWidget />
              <div className="mt-auto pt-5 border-t border-white/[0.06]">
                <h3 className="text-lg font-bold mb-1.5">{t('landing.features.insights.title')}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t('landing.features.insights.desc')}
                </p>
              </div>
            </BentoCard>
          </FadeUp>

          {/* ⑤ Smart Roles — col 1, row 3 */}
          <FadeUp delay={0.1}>
            <BentoCard className="h-full p-7 flex flex-col">
              <SmartRolesWidget />
              <div className="mt-auto pt-5 border-t border-white/[0.06]">
                <h3 className="text-lg font-bold mb-1.5">{t('landing.features.roles.title')}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t('landing.features.roles.desc')}
                </p>
              </div>
            </BentoCard>
          </FadeUp>

          {/* ⑥ Precision Totals — col 2, row 3 */}
          <FadeUp delay={0.2}>
            <BentoCard className="h-full p-7 flex flex-col">
              <PrecisionTotalsWidget />
              <div className="mt-auto pt-5 border-t border-white/[0.06]">
                <h3 className="text-lg font-bold mb-1.5">{t('landing.features.precision.title')}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t('landing.features.precision.desc')}
                </p>
              </div>
            </BentoCard>
          </FadeUp>

          {/* ⑦ Secure by default — col 3, row 3 */}
          <FadeUp delay={0.3}>
            <BentoCard className="h-full p-7 flex flex-col">
              <SecurityWidget />
              <div className="mt-auto pt-5 border-t border-white/[0.06]">
                <h3 className="text-lg font-bold mb-1.5">{t('landing.features.secure.title')}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t('landing.features.secure.desc')}
                </p>
              </div>
            </BentoCard>
          </FadeUp>

        </div>
      </section>

      {/* ── Smart Settle Showcase ─────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-24 max-w-3xl mx-auto text-center">
        <FadeUp>
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-10">
            <div className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400 mb-2">
              {BEFORE_TXNS} → {AFTER_TXNS}
            </div>
            <p className="text-slate-300 text-lg font-medium mb-3">
              {t('landing.settle.label')}
            </p>
            <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
              {t('landing.settle.desc')}
            </p>
          </div>
        </FadeUp>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-24 max-w-2xl mx-auto text-center">
        <FadeUp>
          <div className="rounded-2xl p-px bg-gradient-to-r from-violet-600/50 via-fuchsia-600/50 to-indigo-600/50">
            <div className="rounded-2xl bg-[#0a0a1a] px-8 py-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                {t('landing.cta.title')}
              </h2>
              <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                {t('landing.cta.subtitle')}
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-10 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-900/40"
              >
                {t('landing.cta.button')}
              </button>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-8 text-center text-slate-600 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src="/favicon.svg" alt="" className="w-5 h-5 opacity-50" />
          <span className="font-semibold text-slate-500">Axiom Splits</span>
        </div>
        <p>{t('landing.footer.copyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}
