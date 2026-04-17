import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, ArrowRight, CreditCard, ExternalLink,
  Loader2, ChevronDown, Copy, Check, Monitor, ScanLine,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '../lib/cn';
import { fetchInvitedMemberProfiles, type MemberProfile } from '../lib/db';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { round2 } from '../utils/calculations';

export interface SettleModalProps {
  /** Name of the person paying */
  fromName: string;
  /** Name of the person receiving payment */
  toName: string;
  /** Full amount owed */
  amount: number;
  /** Allow the user to enter a partial amount (default: false) */
  allowPartial?: boolean;
  /** Group ID used to load the invited-member list (omit for guest mode) */
  groupId?: string;
  /** Group name used in the payment note */
  groupName?: string;
  /** Called with the final amount when user confirms */
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

// ─── Dual-action payment button (Venmo / Cash App) ───────────────────────────
// Left side: deep-link for mobile apps.
// Right side (desktop only): copy the handle to clipboard.

function PayButton({
  label,
  handle,
  href,
  colorClass,
  isCopied,
  showCopy,
  onPay,
  onCopy,
}: {
  label:      string;
  handle:     string;
  href:       string;
  colorClass: string;
  isCopied:   boolean;
  showCopy:   boolean;
  onPay:      () => void;
  onCopy:     () => void;
}) {
  return (
    <div className="flex gap-1.5">
      {/* Deep-link button */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onPay}
        className={cn(
          'flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold',
          'transition-all hover:brightness-110 hover:scale-[1.02] active:scale-95',
          colorClass,
        )}
      >
        <ExternalLink size={14} />
        {label}
      </a>

      {/* Copy icon — shown on desktop */}
      {showCopy && (
        <button
          type="button"
          onClick={onCopy}
          title={`Copy ${handle}`}
          className={cn(
            'px-3 rounded-xl border transition-all hover:scale-105 active:scale-95 shrink-0',
            isCopied
              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500',
          )}
        >
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}

// ─── Zelle QR panel ──────────────────────────────────────────────────────────
// Zelle has no universal deep-link, so we render a scan-to-pay QR code that
// encodes the handle (email or phone). The handle is also shown as selectable
// text with a copy button as a fallback.

function ZelleQR({
  handle,
  isCopied,
  onCopy,
}: {
  handle:   string;
  isCopied: boolean;
  onCopy:   () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-3 py-4 rounded-xl border border-[#6d1ed1]/25 bg-[#6d1ed1]/5 dark:bg-[#6d1ed1]/10">
      {/* Section label */}
      <div className="flex items-center gap-1.5 self-stretch">
        <span className="w-5 h-5 rounded-full bg-[#6d1ed1] flex items-center justify-center text-white text-[9px] font-extrabold shrink-0 select-none">
          Z
        </span>
        <span className="text-xs font-semibold text-[#6d1ed1] dark:text-purple-300">Zelle</span>
      </div>

      {/* QR code */}
      <div className="p-3 rounded-2xl bg-white shadow-sm border border-[#6d1ed1]/15">
        <QRCodeCanvas
          value={handle}
          size={148}
          level="M"
          bgColor="#ffffff"
          fgColor="#6d1ed1"
        />
      </div>

      {/* Instruction */}
      <div className="flex items-start gap-1.5 text-center px-1">
        <ScanLine size={13} className="text-[#6d1ed1] dark:text-purple-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-[#6d1ed1]/80 dark:text-purple-400/80 leading-relaxed">
          Scan with your banking app, or copy the handle below.
        </p>
      </div>

      {/* Selectable handle + copy button */}
      <div className="flex items-center gap-2 w-full px-1">
        <span
          className="flex-1 text-sm font-mono font-medium text-[#6d1ed1] dark:text-purple-300 select-all cursor-text truncate"
          title="Click to select all"
        >
          {handle}
        </span>
        <button
          type="button"
          onClick={onCopy}
          title="Copy Zelle handle"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0',
            'hover:scale-105 active:scale-95',
            isCopied
              ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
              : 'bg-[#6d1ed1] text-white shadow-[0_0_8px_rgba(109,30,209,0.3)] hover:brightness-110',
          )}
        >
          {isCopied
            ? <><Check size={11} />Copied!</>
            : <><Copy size={11} />Copy</>}
        </button>
      </div>
    </div>
  );
}

// ─── SettleModal ──────────────────────────────────────────────────────────────

export default function SettleModal({
  fromName,
  toName,
  amount,
  allowPartial = false,
  groupId,
  groupName,
  onConfirm,
  onCancel,
}: SettleModalProps) {
  const { formatPrice } = useCurrency();

  const [inputVal,       setInputVal      ] = useState(String(amount));
  const [profiles,       setProfiles      ] = useState<MemberProfile[]>([]);
  const [profLoading,    setProfLoading   ] = useState(false);
  const [currentUserId,  setCurrentUserId ] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // Tracks which handle string was last copied (resets after 2 s)
  const [copiedHandle,   setCopiedHandle  ] = useState<string | null>(null);

  const cancelRef = useRef<HTMLButtonElement>(null);

  // Detect a pointer-accurate (mouse) device — used to show copy affordances
  // and the desktop tip. Computed once; non-reactive.
  const isDesktop = useMemo(
    () => window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    [],
  );

  // Focus cancel on mount
  useEffect(() => { cancelRef.current?.focus(); }, []);

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Fetch invited (authenticated) member profiles and current user in parallel.
  // Ghost participants from named_participants are never included.
  useEffect(() => {
    if (!groupId) return;
    setProfLoading(true);
    Promise.all([
      fetchInvitedMemberProfiles(groupId),
      supabase.auth.getUser(),
    ]).then(([{ data: profileData }, { data: authData }]) => {
      setProfLoading(false);
      setCurrentUserId(authData.user?.id ?? null);
      setProfiles(profileData ?? []);
    });
  }, [groupId]);

  const parsedAmount  = round2(parseFloat(inputVal) || 0);
  const isValidAmount = parsedAmount > 0 && parsedAmount <= amount + 0.005;
  const isPartial     = parsedAmount > 0 && parsedAmount < amount - 0.005;

  // Exclude the logged-in user — you shouldn't pay yourself.
  const invitedMembers = profiles.filter(p => p.userId !== currentUserId);

  const note = encodeURIComponent(`BillSplitter: ${groupName ?? 'group'}`);

  function makeVenmoUrl(handle: string) {
    return `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(handle)}&amount=${parsedAmount}&note=${note}`;
  }
  function makeCashAppUrl(handle: string) {
    return `https://cash.app/$${handle}`;
  }

  function copyHandle(handle: string) {
    navigator.clipboard.writeText(handle).then(() => {
      setCopiedHandle(handle);
      setTimeout(() => setCopiedHandle(null), 2000);
    });
  }

  function handleConfirm() {
    if (!isValidAmount) return;
    onConfirm(parsedAmount);
  }

  function toggleMember(userId: string) {
    setSelectedUserId(prev => (prev === userId ? null : userId));
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Panel */}
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 shrink-0">
            <CreditCard size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="flex-1 text-base font-semibold text-gray-900 dark:text-slate-100">
            Settle up
          </h2>
          <button
            onClick={onCancel}
            className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Who pays whom */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate min-w-0 flex-1">
              {fromName}
            </span>
            <ArrowRight size={15} className="text-amber-500 dark:text-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate min-w-0 flex-1 text-right">
              {toName}
            </span>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400">
              {allowPartial ? 'Amount to pay' : 'Amount'}
            </label>
            {allowPartial ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={amount}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  autoFocus
                  className={cn(
                    'flex-1 px-3 py-2.5 rounded-xl border text-sm',
                    'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100',
                    'focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-500',
                    isValidAmount
                      ? 'border-gray-200 dark:border-slate-700'
                      : 'border-red-300 dark:border-red-800',
                  )}
                />
                {isPartial && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium shrink-0">partial</span>
                )}
              </div>
            ) : (
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100 px-1">
                {formatPrice(amount)}
              </p>
            )}
            {allowPartial && (
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Full amount: {formatPrice(amount)}
              </p>
            )}
          </div>

          {/* Smart Settle — full list of invited members (self excluded) */}
          {groupId && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-1">
                  Smart settle
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800" />
              </div>

              {profLoading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              ) : invitedMembers.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-1">
                  No other invited members in this group.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {invitedMembers.map(member => {
                      const isOpen      = selectedUserId === member.userId;
                      const displayName = member.fullName?.trim() || 'Unknown';
                      const initial     = displayName[0]?.toUpperCase() ?? '?';
                      const venmoHandle = member.venmoHandle ?? null;
                      const cashHandle  = member.cashappHandle ?? null;
                      const zelleHandle = member.zelleHandle ?? null;
                      const hasHandles  = !!venmoHandle || !!cashHandle || !!zelleHandle;

                      return (
                        <div
                          key={member.userId}
                          className={cn(
                            'rounded-xl border overflow-hidden transition-colors',
                            isOpen
                              ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20'
                              : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800',
                          )}
                        >
                          {/* Collapsed row */}
                          <button
                            type="button"
                            onClick={() => toggleMember(member.userId)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                          >
                            <div className={cn(
                              'w-7 h-7 rounded-full shrink-0 overflow-hidden',
                              !member.avatarUrl && (isOpen ? 'bg-violet-200 dark:bg-violet-800' : 'bg-gray-200 dark:bg-slate-700'),
                            )}>
                              {member.avatarUrl ? (
                                <img
                                  src={member.avatarUrl}
                                  alt={displayName}
                                  className="w-full h-full object-cover"
                                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <span className={cn(
                                  'w-full h-full flex items-center justify-center text-[11px] font-bold',
                                  isOpen ? 'text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-slate-300',
                                )}>
                                  {initial}
                                </span>
                              )}
                            </div>

                            <span className={cn(
                              'flex-1 text-sm font-medium truncate',
                              isOpen ? 'text-violet-800 dark:text-violet-200' : 'text-gray-800 dark:text-slate-200',
                            )}>
                              {displayName}
                            </span>

                            <ChevronDown
                              size={14}
                              className={cn(
                                'shrink-0 transition-transform duration-200',
                                isOpen
                                  ? 'rotate-180 text-violet-500 dark:text-violet-400'
                                  : 'text-gray-400 dark:text-slate-500',
                              )}
                            />
                          </button>

                          {/* Expanded payment handles */}
                          {isOpen && (
                            <div className="px-3 pb-3 space-y-2">
                              {hasHandles ? (
                                <>
                                  {venmoHandle && (
                                    <PayButton
                                      label={`Pay @${venmoHandle} on Venmo`}
                                      handle={`@${venmoHandle}`}
                                      href={makeVenmoUrl(venmoHandle)}
                                      colorClass="bg-[#008CFF] text-white shadow-[0_0_12px_rgba(0,140,255,0.3)]"
                                      isCopied={copiedHandle === venmoHandle}
                                      showCopy={isDesktop}
                                      onPay={() => { if (isValidAmount) onConfirm(parsedAmount); }}
                                      onCopy={() => copyHandle(venmoHandle)}
                                    />
                                  )}
                                  {cashHandle && (
                                    <PayButton
                                      label={`Pay @${cashHandle} on Cash App`}
                                      handle={`$${cashHandle}`}
                                      href={makeCashAppUrl(cashHandle)}
                                      colorClass="bg-[#00D632] text-white shadow-[0_0_12px_rgba(0,214,50,0.3)]"
                                      isCopied={copiedHandle === cashHandle}
                                      showCopy={isDesktop}
                                      onPay={() => { if (isValidAmount) onConfirm(parsedAmount); }}
                                      onCopy={() => copyHandle(cashHandle)}
                                    />
                                  )}
                                  {zelleHandle && (
                                    <ZelleQR
                                      handle={zelleHandle}
                                      isCopied={copiedHandle === zelleHandle}
                                      onCopy={() => copyHandle(zelleHandle)}
                                    />
                                  )}
                                </>
                              ) : (
                                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-1">
                                  No payment handles linked.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop tip */}
                  {isDesktop && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                      <Monitor size={13} className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
                        Paying from a computer? Copy the handle and paste it into your payment provider's website.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer — manual settle fallback */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValidAmount}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium text-white transition-all',
              'hover:brightness-110 hover:scale-105 active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
              'bg-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
            )}
          >
            Mark settled
          </button>
        </div>
      </div>
    </div>
  );
}
