import { useState, useEffect, useRef, useCallback } from 'react';
import { PlusCircle, RefreshCw, ArrowRight, Pencil, Check, X, CheckCircle2, ChevronDown, Percent, Banknote, Minus as MinusIcon, Plus as PlusIcon } from 'lucide-react';
import type { Expense, Participant, Split } from '../types';
import { cn } from '../lib/cn';
import { round2, round4 } from '../utils/calculations';
import { useCurrency, EXPENSE_CURRENCIES } from '../context/CurrencyContext';
import CurrencySelect from './CurrencySelect';
import DescriptionComboBox from './DescriptionComboBox';
import ParticipantSelect from './ParticipantSelect';

interface Props {
  participants: Participant[];
  onAdd: (expense: Expense) => void;
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

const smallInputCls = 'rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 text-xs px-2.5 py-1.5 transition-colors hover:border-violet-400 dark:hover:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500';

export default function ExpenseForm({ participants, onAdd }: Props) {
  const { currency, symbol, formatPrice, convert, ratesLoading, ratesError } = useCurrency();

  const [description, setDescription]         = useState('');
  const [amount, setAmount]                   = useState('');
  const [sourceCurrency, setSourceCurrency]   = useState<string>(currency);
  const [paidBy, setPaidBy]                   = useState('');
  const [splitType, setSplitType]             = useState<'equally' | 'exact'>('equally');
  const [involved, setInvolved]               = useState<Set<string>>(new Set(participants.map(p => p.id)));
  const [exactAmounts, setExactAmounts]       = useState<Record<string, string>>({});
  const [error, setError]                     = useState('');
  const [isManualRate, setIsManualRate]       = useState(false);
  const [manualRateInput, setManualRateInput] = useState('');
  const [currencyOpen, setCurrencyOpen]       = useState(false);
  const [paidByOpen, setPaidByOpen]           = useState(false);
  const [shake, setShake]                     = useState(false);
  // Tax & Tip
  const [showFees, setShowFees]               = useState(false);
  const [taxInput, setTaxInput]               = useState('');
  const [tipInput, setTipInput]               = useState('');
  const taxRef    = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const longPressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Nudge the amount by `delta`. Clamps to 0. */
  const nudge = useCallback((delta: number) => {
    setAmount(prev => {
      const next = round2(Math.max(0, (parseFloat(prev) || 0) + delta));
      return next === 0 ? '' : String(next);
    });
  }, []);

  /** Start a long-press rapid-fire nudge (fires every 150 ms after 400 ms hold). */
  function startLongPress(delta: number) {
    const timeout = setTimeout(() => {
      longPressRef.current = setInterval(() => nudge(delta), 150);
    }, 400);
    // Store timeout id so we can clear both on release
    longPressRef.current = timeout as unknown as ReturnType<typeof setInterval>;
  }

  function stopLongPress() {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current as unknown as ReturnType<typeof setTimeout>);
      clearInterval(longPressRef.current);
      longPressRef.current = null;
    }
  }

  // Clean up on unmount
  useEffect(() => () => stopLongPress(), []);

  useEffect(() => { setSourceCurrency(currency); setIsManualRate(false); }, [currency]);
  useEffect(() => { setIsManualRate(false); }, [sourceCurrency]);
  useEffect(() => { setInvolved(new Set(participants.map(p => p.id))); }, [participants]);
  // Auto-focus tax input when section opens
  useEffect(() => { if (showFees) setTimeout(() => taxRef.current?.focus(), 50); }, [showFees]);

  // ── Core amounts ──────────────────────────────────────────────────────────
  const sourceSubtotal  = parseFloat(amount) || 0;
  const isForeign       = sourceCurrency !== currency;
  const manualRateValue = parseFloat(manualRateInput) || 0;

  const effectiveLockedRate: number = (() => {
    if (!isForeign) return 1;
    if (isManualRate && manualRateValue > 0) return round4(1 / manualRateValue);
    return round4(convert(1, sourceCurrency, currency));
  })();

  /** Subtotal in base currency (before tax/tip) */
  const baseSubtotal = isForeign ? round2(sourceSubtotal * effectiveLockedRate) : sourceSubtotal;

  /** Display symbol for the expense source currency (used in exact split inputs). */
  const srcSymbol = EXPENSE_CURRENCIES.find(c => c.code === sourceCurrency)?.symbol ?? sourceCurrency;

  // Tax & tip
  const taxPercent       = Math.max(0, parseFloat(taxInput) || 0);
  const sourceTip        = Math.max(0, parseFloat(tipInput) || 0);
  const hasFees          = showFees && (taxPercent > 0 || sourceTip > 0);
  const feesDisabled     = baseSubtotal <= 0;

  const taxBase          = hasFees ? round2(baseSubtotal * taxPercent / 100) : 0;
  const tipBase          = hasFees ? (isForeign ? round2(sourceTip * effectiveLockedRate) : sourceTip) : 0;
  /** Grand total in base currency */
  const grandTotalBase   = round2(baseSubtotal + taxBase + tipBase);

  const involvedList = participants.filter(p => involved.has(p.id));
  const allSelected  = involvedList.length === participants.length;
  const n            = involvedList.length;

  // ── Per-person share preview (equal split) ────────────────────────────────
  function equalSharePreview(): number {
    if (n === 0 || grandTotalBase <= 0) return 0;
    return round2(grandTotalBase / n);
  }

  /** Convert a source-currency amount to base currency. */
  function srcToBase(srcAmt: number): number {
    return isForeign ? round2(srcAmt * effectiveLockedRate) : srcAmt;
  }

  /** Sum of exact amounts as entered — always in sourceCurrency. Used for validation and footer display. */
  function exactSumSource(): number {
    return round2(involvedList.reduce((s, p) => s + (parseFloat(exactAmounts[p.id] || '0') || 0), 0));
  }

  /** Sum of exact amounts converted to base currency (for buildSplits proportions). */
  function exactSumBase(): number {
    return round2(involvedList.reduce((s, p) => s + srcToBase(parseFloat(exactAmounts[p.id] || '0') || 0), 0));
  }

  // ── Manual rate helpers ───────────────────────────────────────────────────
  function openManualRate() {
    const previewRate = round4(convert(1, currency, sourceCurrency));
    setManualRateInput(previewRate > 0 ? String(previewRate) : '');
    setIsManualRate(true);
  }
  function confirmManualRate() {
    if (!manualRateValue || manualRateValue <= 0) { setManualRateInput(''); setIsManualRate(false); }
  }
  function cancelManualRate() { setManualRateInput(''); setIsManualRate(false); }

  // ── Participant toggle ────────────────────────────────────────────────────
  function toggleAll() {
    setInvolved(allSelected ? new Set() : new Set(participants.map(p => p.id)));
  }
  function toggleParticipant(id: string) {
    setInvolved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Proportional split computation ────────────────────────────────────────
  /**
   * Build final splits with proportional tax+tip distribution.
   *
   * For equal split: each person gets grand_total/n (last person gets remainder).
   * For exact split: each person's proportion = their subtotal share / subtotal total;
   *   tax+tip are added proportionally, last person absorbs rounding remainder.
   */
  function buildSplits(lockedBaseSubtotal: number, lockedGrandTotal: number): Split[] | null {
    if (n === 0) return null;

    const lockedTaxBase = hasFees ? round2(lockedBaseSubtotal * taxPercent / 100) : 0;
    const lockedTipBase = hasFees ? (isForeign ? round2(sourceTip * effectiveLockedRate) : sourceTip) : 0;

    let shares: number[];

    if (splitType === 'equally') {
      // Equal subtotal split → equal grand total split (proportions are identical)
      const baseShare = round2(lockedGrandTotal / n);
      shares = involvedList.map((_, i) =>
        i < n - 1 ? baseShare : round2(lockedGrandTotal - baseShare * (n - 1))
      );
    } else {
      // Manual subtotal amounts; distribute tax+tip proportionally
      // Amounts entered in sourceCurrency — convert each to base for share calculation
      const subtotalSum = round2(involvedList.reduce(
        (s, p) => s + srcToBase(parseFloat(exactAmounts[p.id] || '0') || 0), 0
      ));
      if (subtotalSum <= 0) return null;

      let allocated = 0;
      shares = involvedList.map((p, i) => {
        const subtotalShare = srcToBase(round2(parseFloat(exactAmounts[p.id] || '0')));
        if (i === n - 1) {
          return round2(lockedGrandTotal - allocated);
        }
        const proportion  = subtotalShare / subtotalSum;
        const share       = round2(subtotalShare
          + round2(lockedTaxBase * proportion)
          + round2(lockedTipBase * proportion));
        allocated = round2(allocated + share);
        return share;
      });
    }

    return involvedList.map((p, i) => ({
      participantId: p.id,
      share: shares[i],
      paidAmount: p.id === paidBy ? shares[i] : 0,
      isSettled: p.id === paidBy,
    }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function triggerShake() { setShake(true); }

  function handleSubmit() {
    setError('');
    if (!description.trim())       { setError('Please enter a description.'); triggerShake(); return; }
    if (sourceSubtotal <= 0)       { setError('Amount must be greater than 0.'); triggerShake(); return; }
    if (!paidBy)                   { setError('Please select who paid.'); triggerShake(); return; }
    if (n === 0)                   { setError('Select at least one participant.'); return; }
    if (isForeign && ratesLoading && !isManualRate) {
      setError('Exchange rates are still loading. Wait or set a manual rate.'); return;
    }
    if (isForeign && isManualRate && manualRateValue <= 0) {
      setError('Please enter a valid manual exchange rate.'); return;
    }

    const lockedRate         = effectiveLockedRate;
    const lockedBaseSubtotal = round2(sourceSubtotal * lockedRate);
    const lockedTaxBase      = hasFees ? round2(lockedBaseSubtotal * taxPercent / 100) : 0;
    const lockedTipBase      = hasFees ? (isForeign ? round2(sourceTip * lockedRate) : sourceTip) : 0;
    const lockedGrandTotal   = round2(lockedBaseSubtotal + lockedTaxBase + lockedTipBase);

    if (splitType === 'exact') {
      const sum = exactSumSource();
      if (Math.abs(sum - sourceSubtotal) > 0.01) {
        setError(`Manual amounts must sum to ${sourceSubtotal.toFixed(2)} ${sourceCurrency} (currently ${sum.toFixed(2)} ${sourceCurrency}).`);
        return;
      }
    }

    const splits = buildSplits(lockedBaseSubtotal, lockedGrandTotal);
    if (!splits) { setError('Select at least one participant.'); return; }

    onAdd({
      id: makeId(),
      description: description.trim(),
      totalAmount: lockedGrandTotal,
      sourceAmount: sourceSubtotal,
      sourceCurrency,
      lockedRate,
      paidBy,
      splitType,
      involvedParticipants: involvedList.map(p => p.id),
      splits,
      isHighlighted: false,
      taxPercent: hasFees && taxPercent > 0 ? taxPercent : undefined,
      tipSourceAmount: hasFees && sourceTip > 0 ? sourceTip : undefined,
    });

    setDescription(''); setAmount(''); setSourceCurrency(currency); setPaidBy('');
    setSplitType('equally'); setInvolved(new Set(participants.map(p => p.id)));
    setExactAmounts({}); setIsManualRate(false); setManualRateInput('');
    setShowFees(false); setTaxInput(''); setTipInput('');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">Add Expense</h2>

      <div className="space-y-3">
        <DescriptionComboBox
          value={description}
          onChange={setDescription}
          nextRef={amountRef}
          onCommit={handleSubmit}
        />

        {/* ── Unified Control Bar ── */}
        <div
          onAnimationEnd={() => setShake(false)}
          className={cn(
            'relative flex flex-col',
            'rounded-xl border border-gray-200 dark:border-slate-700',
            'bg-white dark:bg-slate-900/50',
            'transition-colors',
            'hover:border-gray-300 dark:hover:border-slate-600',
            'focus-within:border-violet-500/50 focus-within:shadow-[0_0_15px_rgba(139,92,246,0.1)]',
            (currencyOpen || paidByOpen) && 'rounded-b-none border-b-0 z-[51]',
            shake && 'animate-[shake_0.4s_ease-in-out] border-red-400 dark:border-red-500'
          )}
        >
          {/* Top row: on mobile → [Currency | Amount] stacked above [Paid By]
                        on sm+   → [Currency] | [Amount] | [Paid By] in one row */}
          <div className="flex flex-col sm:flex-row items-stretch">

            {/* Currency + Amount sub-row (always together) */}
            <div className="flex flex-1 items-stretch">
            {/* Currency — embedded; panel anchors to this container */}
            <CurrencySelect
              options={EXPENSE_CURRENCIES}
              value={sourceCurrency}
              onChange={setSourceCurrency}
              onOpenChange={setCurrencyOpen}
              embedded
              className="shrink-0 w-[6.5rem]"
              listMaxHeight="max-h-56"
            />

            {/* Vertical divider */}
            <div className="w-px bg-gray-200 dark:bg-slate-700 self-stretch" />

            {/* Amount input with − / + nudge */}
            <div className="flex flex-1 items-stretch">
              <button
                type="button"
                onClick={() => nudge(-1)}
                onMouseDown={() => startLongPress(-1)}
                onMouseUp={stopLongPress}
                onMouseLeave={stopLongPress}
                onTouchStart={() => startLongPress(-1)}
                onTouchEnd={stopLongPress}
                className="px-2.5 text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:scale-110 active:scale-95 transition-all select-none"
                aria-label="Decrease amount"
              >
                <MinusIcon size={13} />
              </button>

              <input
                ref={amountRef}
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-center py-2 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => nudge(1)}
                onMouseDown={() => startLongPress(1)}
                onMouseUp={stopLongPress}
                onMouseLeave={stopLongPress}
                onTouchStart={() => startLongPress(1)}
                onTouchEnd={stopLongPress}
                className="px-2.5 text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:scale-110 active:scale-95 transition-all select-none"
                aria-label="Increase amount"
              >
                <PlusIcon size={13} />
              </button>
            </div>
            </div>{/* end Currency+Amount sub-row */}

            {/* Responsive divider: horizontal on mobile, vertical on sm+ */}
            <div className="sm:w-px h-px sm:h-auto bg-gray-200 dark:bg-slate-700 self-stretch" />

            {/* Paid By — full width on mobile, flex-1 on sm+ */}
            <ParticipantSelect
              participants={participants}
              value={paidBy}
              onChange={setPaidBy}
              onOpenChange={setPaidByOpen}
              embedded
              className="w-full sm:flex-1 sm:min-w-0"
            />
          </div>{/* end top row */}

          {/* Horizontal divider */}
          <div className="h-px bg-gray-200 dark:bg-slate-700" />

          {/* Quick-add chips row */}
          <div className="flex gap-1 px-1.5 pb-2 pt-1">
            {[1, 5, 10, 20, 50, 100].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { nudge(n); amountRef.current?.focus(); }}
                className="flex-1 text-[10px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-500 hover:bg-violet-500/20 hover:text-violet-500 dark:hover:text-violet-300 transition-colors select-none"
              >
                +{n}
              </button>
            ))}
          </div>
        </div>

        {/* Conversion preview */}
        {isForeign && sourceSubtotal > 0 && (
          <>
            {!isManualRate && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                ratesLoading
                  ? 'bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500'
                  : ratesError
                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                    : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30'
              )}>
                {ratesLoading ? (
                  <><RefreshCw size={12} className="animate-spin" /> Loading rates…</>
                ) : (
                  <>
                    <span className="font-medium">{sourceSubtotal} {sourceCurrency}</span>
                    <ArrowRight size={12} className="shrink-0" />
                    <span className="font-bold">{formatPrice(baseSubtotal)}</span>
                    <span className={cn('ml-auto', ratesError ? 'text-amber-500 dark:text-amber-400' : 'text-blue-400 dark:text-blue-500')}>
                      1 {sourceCurrency} = {effectiveLockedRate.toFixed(4)} {currency}
                    </span>
                  </>
                )}
                <button type="button" onClick={openManualRate}
                  className={cn(
                    'flex items-center gap-1 ml-1 px-2 py-0.5 rounded text-xs font-medium transition-colors',
                    ratesError
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                  )}>
                  <Pencil size={10} /> Edit Rate
                </button>
              </div>
            )}

            {isManualRate && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-xs text-violet-800 dark:text-violet-300">
                <span className="font-medium shrink-0">1 {currency} =</span>
                <input
                  type="number" min="0" step="0.0001" value={manualRateInput} autoFocus
                  onChange={e => setManualRateInput(e.target.value)} placeholder="e.g. 7.20"
                  className="w-24 rounded border border-violet-300 dark:border-violet-700 px-2 py-1 text-sm font-medium bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
                <span className="font-medium shrink-0">{sourceCurrency}</span>
                {manualRateValue > 0 && (
                  <span className="ml-auto font-bold text-violet-700 dark:text-violet-300 shrink-0">
                    ≈ {formatPrice(baseSubtotal)}
                  </span>
                )}
                <button type="button" onClick={confirmManualRate}
                  className="p-1 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors">
                  <Check size={13} />
                </button>
                <button type="button" onClick={cancelManualRate}
                  className="p-1 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                  <X size={13} />
                </button>
              </div>
            )}

            {isManualRate && manualRateValue > 0 && !ratesLoading && (
              <p className="text-xs text-violet-600 dark:text-violet-400 px-1">
                Manual rate active: 1 {currency} = {manualRateInput} {sourceCurrency}
                <button type="button" onClick={cancelManualRate} className="ml-2 underline hover:no-underline">
                  reset
                </button>
              </p>
            )}
          </>
        )}

        {/* ── Tax & Tip toggle ── */}
        <div>
          <button
            type="button"
            onClick={() => setShowFees(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            <ChevronDown
              size={13}
              strokeWidth={2}
              className={cn('transition-transform duration-200', showFees && 'rotate-180')}
            />
            {showFees ? 'Hide Tax & Tip' : '+ Add Tax & Tip'}
          </button>

          {/* Slide-down panel — grid-rows trick for smooth height animation */}
          <div className={cn(
            'grid transition-all duration-300 ease-in-out',
            showFees ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}>
            <div className="overflow-hidden">
              <div className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Fee Breakdown — distributed proportionally
                </p>

                <div className="flex gap-2">
                  {/* Tax % */}
                  <div className="flex-1 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Percent size={11} className="text-slate-400 dark:text-slate-500" />
                    </span>
                    <input
                      ref={taxRef}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={taxInput}
                      onChange={e => setTaxInput(e.target.value)}
                      placeholder="Tax %"
                      disabled={feesDisabled}
                      className={cn(smallInputCls, 'w-full pl-7', feesDisabled && 'opacity-40 cursor-not-allowed')}
                    />
                  </div>

                  {/* Flat tip */}
                  <div className="flex-1 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Banknote size={11} className="text-slate-400 dark:text-slate-500" />
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tipInput}
                      onChange={e => setTipInput(e.target.value)}
                      placeholder={`Tip (${sourceCurrency})`}
                      disabled={feesDisabled}
                      className={cn(smallInputCls, 'w-full pl-7', feesDisabled && 'opacity-40 cursor-not-allowed')}
                    />
                  </div>
                </div>

                {/* Live breakdown */}
                {hasFees && baseSubtotal > 0 && (
                  <div className="space-y-0.5 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{formatPrice(baseSubtotal)}</span>
                    </div>
                    {taxPercent > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({taxPercent}%)</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">+{formatPrice(taxBase)}</span>
                      </div>
                    )}
                    {sourceTip > 0 && (
                      <div className="flex justify-between">
                        <span>Tip ({sourceTip} {sourceCurrency})</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">+{formatPrice(tipBase)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700/60 pt-0.5 mt-0.5">
                      <span>Grand Total</span>
                      <span>{formatPrice(grandTotalBase)}</span>
                    </div>
                  </div>
                )}

                {feesDisabled && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Enter an amount above to enable tax & tip fields.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Split type toggle */}
        <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden text-sm">
          {(['equally', 'exact'] as const).map(type => (
            <button key={type} onClick={() => setSplitType(type)}
              className={cn(
                'flex-1 py-2 font-medium transition-colors',
                splitType === type
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              )}>
              {type === 'equally' ? 'Split Equally' : 'Manual Amounts'}
            </button>
          ))}
        </div>

        {/* Participant selector — selection tiles */}
        {participants.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Splitting with ({involvedList.length}/{participants.length})
              </span>
              <div className="flex items-center gap-3">
                {isForeign && baseSubtotal > 0 && !ratesLoading && (
                  <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">splits in {currency}</span>
                )}
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {participants.map(p => {
                const isInvolved = involved.has(p.id);

                function handleActivate() { toggleParticipant(p.id); }
                function handleKeyDown(e: React.KeyboardEvent) {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleParticipant(p.id); }
                }

                return (
                  <div key={p.id}>
                    <div
                      role="checkbox"
                      aria-checked={isInvolved}
                      tabIndex={0}
                      onClick={handleActivate}
                      onKeyDown={handleKeyDown}
                      className={cn(
                        'rounded-xl border-2 p-3 flex items-center justify-between',
                        'transition-all duration-200 cursor-pointer select-none',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                        'active:scale-95',
                        isInvolved
                          ? 'bg-violet-500/10 dark:bg-violet-500/10 border-violet-500'
                          : 'bg-slate-100 dark:bg-slate-800/50 border-transparent hover:scale-[1.02] hover:shadow-md dark:hover:shadow-slate-900/60'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          isInvolved
                            ? 'bg-violet-200 dark:bg-violet-800/60 text-violet-700 dark:text-violet-300'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        )}>
                          {p.name[0].toUpperCase()}
                        </div>
                        <span className={cn(
                          'text-sm font-medium truncate',
                          isInvolved
                            ? 'text-violet-600 dark:text-violet-400'
                            : 'text-slate-500 dark:text-slate-400'
                        )}>
                          {p.name}
                        </span>
                      </div>

                      {isInvolved ? (
                        splitType === 'equally' && grandTotalBase > 0 ? (
                          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 shrink-0 ml-1">
                            {formatPrice(equalSharePreview())}
                          </span>
                        ) : (
                          <CheckCircle2 size={16} className="text-violet-500 dark:text-violet-400 shrink-0 ml-1" />
                        )
                      ) : null}
                    </div>

                    {splitType === 'exact' && isInvolved && (
                      <div className="mt-1 space-y-0.5" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none opacity-50">
                            {srcSymbol}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={exactAmounts[p.id] ?? ''}
                            onChange={e => setExactAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="0.00"
                            className="w-full rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 px-7 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500"
                          />
                        </div>
                        {isForeign && (parseFloat(exactAmounts[p.id] || '0') || 0) > 0 && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                            ≈ {formatPrice(srcToBase(parseFloat(exactAmounts[p.id] || '0') || 0))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Exact split total footer — validates in source currency */}
            {splitType === 'exact' && involvedList.length > 0 && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {hasFees ? 'Subtotal assigned' : 'Total assigned'}
                  </span>
                  <span className={cn('text-xs font-semibold',
                    Math.abs(exactSumSource() - sourceSubtotal) < 0.01 && sourceSubtotal > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-500 dark:text-red-400')}>
                    {exactSumSource().toFixed(2)} / {sourceSubtotal.toFixed(2)} {sourceCurrency}
                    {Math.abs(exactSumSource() - sourceSubtotal) < 0.01 && sourceSubtotal > 0 && ' ✓'}
                  </span>
                </div>
                {isForeign && exactSumBase() > 0 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 text-right">
                    ≈ {formatPrice(exactSumBase())} {currency} total
                  </p>
                )}
              </div>
            )}

            {/* Exact + fees: show what each person will actually owe after proportional tax/tip */}
            {splitType === 'exact' && hasFees && involvedList.length > 0 && Math.abs(exactSumSource() - sourceSubtotal) < 0.01 && sourceSubtotal > 0 && (
              <div className="mt-1 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-1">
                  Final owed (subtotal + tax + tip)
                </p>
                <div className="space-y-0.5">
                  {involvedList.map((p, i) => {
                    const splits = buildSplits(baseSubtotal, grandTotalBase);
                    const share  = splits?.[i]?.share ?? 0;
                    return (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300">{p.name}</span>
                        <span className="font-semibold text-violet-700 dark:text-violet-300">{formatPrice(share)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <PlusCircle size={16} />
          <span className="flex flex-col items-center leading-tight">
            <span>
              {sourceSubtotal > 0
                ? `Add Expense (${sourceSubtotal.toFixed(2)} ${sourceCurrency})`
                : 'Add Expense'}
            </span>
            {isForeign && grandTotalBase > 0 && (
              <span className="text-[11px] font-normal opacity-75">≈ {formatPrice(grandTotalBase)}</span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
