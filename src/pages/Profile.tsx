import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Check, Camera, Globe, BarChart3, Sparkles, X as XIcon, Crown, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { supabase } from '../lib/supabase';
import {
  fetchOwnProfile, updateOwnProfile, fetchOwnStats, createCheckoutSession,
  type OwnProfile, type OwnStats,
} from '../lib/db';
import { CURRENCIES, useCurrency, type CurrencyCode } from '../context/CurrencyContext';
import { useSubscription } from '../hooks/useSubscription';
import { STRIPE_PRICES, tierForPrice } from '../lib/stripe-prices';

interface Props {
  authEmail:                    string | null;
  authName:                     string | null;
  userId:                       string | null;
  desktopExpenseModal:          boolean;
  onDesktopExpenseModalChange:  (val: boolean) => void;
}

// ─── Brand icons ──────────────────────────────────────────────────────────────

function VenmoIcon() {
  return (
    <span className="w-[18px] h-[18px] rounded-full bg-[#008CFF] flex items-center justify-center text-white text-[9px] font-extrabold shrink-0 select-none">
      V
    </span>
  );
}

function CashAppIcon() {
  return (
    <span className="w-[18px] h-[18px] rounded-full bg-[#00D632] flex items-center justify-center text-white text-[9px] font-extrabold shrink-0 select-none">
      $
    </span>
  );
}

function ZelleIcon() {
  return (
    <span className="w-[18px] h-[18px] rounded-full bg-[#6d1ed1] flex items-center justify-center text-white text-[9px] font-extrabold shrink-0 select-none">
      Z
    </span>
  );
}

// ─── Floating-label input ─────────────────────────────────────────────────────

function FloatingInput({
  id, label, value, onChange, readOnly = false, prefix, icon, verified,
}: {
  id:        string;
  label:     string;
  value:     string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  prefix?:   string;
  icon?:     React.ReactNode;
  verified?: boolean;
}) {
  return (
    <div className={cn(
      'relative flex items-center rounded-xl border transition-colors',
      readOnly
        ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-700/50'
        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-500 focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-300/40',
    )}>
      {icon && <span className="pl-3 shrink-0">{icon}</span>}
      {prefix && (
        <span className="pl-3 pr-0.5 text-sm text-gray-400 dark:text-slate-500 shrink-0 font-medium select-none">
          {prefix}
        </span>
      )}
      <div className="relative flex-1 min-w-0">
        <input
          id={id}
          value={value}
          readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          placeholder=" "
          className={cn(
            'peer w-full bg-transparent outline-none text-sm px-3 pt-5 pb-1.5',
            (icon || prefix) && 'pl-1.5',
            readOnly
              ? 'text-gray-500 dark:text-slate-400 cursor-default'
              : 'text-gray-900 dark:text-slate-100',
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            'absolute pointer-events-none transition-all duration-150 ease-in-out left-3',
            (icon || prefix) && 'left-1.5',
            // floated (default — value present)
            'top-1.5 text-[10px] font-medium text-violet-500 dark:text-violet-400',
            // unset when empty
            'peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400 dark:peer-placeholder-shown:text-slate-500',
            // refloat on focus
            'peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-medium peer-focus:text-violet-500 dark:peer-focus:text-violet-400',
          )}
        >
          {label}
        </label>
      </div>
      {verified && (
        <span className="pr-3 shrink-0">
          <Check size={13} className="text-emerald-500" />
        </span>
      )}
    </div>
  );
}

// ─── Currency combobox ────────────────────────────────────────────────────────

function CurrencyCombobox({ value, onChange }: {
  value:    string;
  onChange: (c: CurrencyCode) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open,  setOpen ] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    }
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const entries = Object.entries(CURRENCIES) as [CurrencyCode, { symbol: string; label: string }][];
  const filtered = query.trim()
    ? entries.filter(([code, m]) =>
        code.toLowerCase().includes(query.toLowerCase()) ||
        m.label.toLowerCase().includes(query.toLowerCase()))
    : entries;

  const current = CURRENCIES[value as CurrencyCode];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors',
          'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
          'hover:border-violet-400 dark:hover:border-violet-500',
          'focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400',
        )}
      >
        <span className="w-6 text-center font-medium text-gray-500 dark:text-slate-400 shrink-0">
          {current?.symbol ?? value}
        </span>
        <span className="flex-1 truncate text-gray-900 dark:text-slate-100">{current?.label ?? value}</span>
        <span className="text-xs font-mono text-gray-400 dark:text-slate-500 shrink-0">{value}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-slate-700">
            <input
              autoFocus
              name="currency-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('profile.searchCurrencies')}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.map(([code, m]) => (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => { onChange(code); setOpen(false); setQuery(''); }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                    code === value
                      ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200',
                  )}
                >
                  <span className="w-6 text-center font-medium text-gray-500 dark:text-slate-400">{m.symbol}</span>
                  <span className="flex-1 truncate">{m.label}</span>
                  <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{code}</span>
                  {code === value && <Check size={12} className="text-violet-500 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, icon, children, className }: {
  title:      string;
  icon:       React.ReactNode;
  children:   React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800',
      'shadow-sm',
      className,
    )}>
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-slate-800">
        <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 shrink-0">{icon}</div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Avatar upload ────────────────────────────────────────────────────────────

function AvatarUpload({ initials, avatarUrl, uploading, onUpload }: {
  initials:  string;
  avatarUrl: string | null;
  uploading: boolean;
  onUpload:  (file: File) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative shrink-0 group" style={{ width: 80, height: 80 }}>
      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-violet-600 flex items-center justify-center ring-2 ring-violet-200 dark:ring-violet-800">
        {avatarUrl
          ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          : <span className="text-white text-3xl font-bold select-none">{initials}</span>}
      </div>

      {/* Camera overlay */}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-0.5 bg-black/0 group-hover:bg-black/50 transition-all text-transparent group-hover:text-white disabled:cursor-not-allowed"
        aria-label={t('profile.changePhoto')}
      >
        {uploading
          ? <Loader2 size={16} className="animate-spin" />
          : <Camera size={16} />}
        <span className="text-[9px] font-semibold leading-none">
          {uploading ? t('profile.uploading') : t('profile.change')}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        name="avatar-upload"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Profile page ─────────────────────────────────────────────────────────────

export default function Profile({ authEmail, authName, userId, desktopExpenseModal, onDesktopExpenseModalChange }: Props) {
  const { t } = useTranslation();
  const { setCurrency } = useCurrency();

  const [profile,         setProfile        ] = useState<OwnProfile | null>(null);
  const [stats,           setStats          ] = useState<OwnStats | null>(null);
  const [loading,         setLoading        ] = useState(true);
  const [saving,          setSaving         ] = useState(false);
  const [saved,           setSaved          ] = useState(false);
  const [saveError,       setSaveError      ] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl,       setAvatarUrl      ] = useState<string | null>(null);

  const [displayName,    setDisplayName   ] = useState('');
  const [venmoHandle,    setVenmoHandle   ] = useState('');
  const [cashappHandle,  setCashappHandle ] = useState('');
  const [zelleHandle,    setZelleHandle   ] = useState('');
  const [currency,       setCurrencyState ] = useState<CurrencyCode>('USD');
  const [defaultTaxRate, setDefaultTaxRate] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchOwnProfile(), fetchOwnStats()]).then(([pRes, sRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (pRes.data) {
        const p = pRes.data;
        setProfile(p);
        setDisplayName(p.fullName ?? '');
        setAvatarUrl(p.avatarUrl);
        setVenmoHandle(p.venmoHandle ?? '');
        setCashappHandle(p.cashappHandle ?? '');
        setZelleHandle(p.zelleHandle ?? '');
        setCurrencyState((p.defaultCurrency as CurrencyCode) ?? 'USD');
        setDefaultTaxRate(p.defaultTaxRate > 0 ? String(p.defaultTaxRate) : '');
      }
      if (sRes.data) setStats(sRes.data);
    });
    return () => { cancelled = true; };
  }, []);

  const taxRateNum = Math.max(0, Math.min(100, parseFloat(defaultTaxRate) || 0));

  const isDirty = profile != null && (
    displayName   !== (profile.fullName      ?? '')  ||
    venmoHandle   !== (profile.venmoHandle   ?? '')  ||
    cashappHandle !== (profile.cashappHandle ?? '')  ||
    zelleHandle   !== (profile.zelleHandle   ?? '')  ||
    currency      !== (profile.defaultCurrency as CurrencyCode ?? 'USD') ||
    taxRateNum    !== (profile.defaultTaxRate ?? 0)
  );

  async function handleAvatarUpload(file: File) {
    if (!userId) return;
    setAvatarUploading(true);
    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadErr) { setAvatarUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const busted = `${publicUrl}?t=${Date.now()}`;
    await updateOwnProfile({ avatarUrl: busted });
    setAvatarUrl(busted);
    setProfile(prev => prev ? { ...prev, avatarUrl: busted } : prev);
    setAvatarUploading(false);
  }

  async function handleSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    setSaveError(null);
    const cleanVenmo   = venmoHandle.replace(/^@+/, '');
    const cleanCashApp = cashappHandle.replace(/^\$+/, '');
    const cleanZelle   = zelleHandle.trim();
    const { error } = await updateOwnProfile({
      fullName:        displayName.trim() || null,
      venmoHandle:     cleanVenmo   || null,
      cashappHandle:   cleanCashApp || null,
      zelleHandle:     cleanZelle   || null,
      defaultCurrency: currency,
      defaultTaxRate:  taxRateNum,
    });
    setSaving(false);
    if (error) { setSaveError(error); return; }
    // Sync default tax rate to localStorage so ExpenseForm sees it immediately
    if (userId) {
      try { localStorage.setItem(`bsp_tax_${userId}`, String(taxRateNum)); } catch (_) {}
    }
    setProfile(prev => prev ? {
      ...prev,
      fullName: displayName.trim() || null,
      venmoHandle: cleanVenmo || null,
      cashappHandle: cleanCashApp || null,
      zelleHandle: cleanZelle || null,
      defaultCurrency: currency,
      defaultTaxRate: taxRateNum,
    } : prev);
    setVenmoHandle(cleanVenmo);
    setCashappHandle(cleanCashApp);
    setZelleHandle(cleanZelle);
    setCurrency(currency);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const subscription = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError,   setCheckoutError  ] = useState<string | null>(null);
  const [billingCycle,    setBillingCycle   ] = useState<'monthly' | 'yearly'>('monthly');

  async function handleUpgrade(priceId: string) {
    setCheckoutLoading(priceId);
    setCheckoutError(null);
    const { data: url, error } = await createCheckoutSession(priceId);
    setCheckoutLoading(null);
    if (error || !url) { setCheckoutError(error ?? t('profile.checkoutError')); return; }
    window.location.href = url;
  }

  const initials = (displayName || authName || authEmail || '?')[0].toUpperCase();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-gray-50 dark:bg-slate-950" style={{ touchAction: 'pan-y' }}>

      {/* Floating save button — appears when there are unsaved changes */}
      {isDirty && (
        <div className="fixed bottom-6 right-6 z-20">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white',
              'bg-violet-600 shadow-lg shadow-violet-500/25',
              'hover:brightness-110 hover:scale-105 active:scale-95 transition-all',
              'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100',
            )}
          >
            {saving  ? <Loader2 size={14} className="animate-spin" />
             : saved ? <Check   size={14} />
             :         <Save    size={14} />}
            {saved ? t('common.success') : t('profile.saveChanges')}
          </button>
        </div>
      )}

      {/* Content */}
      <main className="max-w-4xl mx-auto w-full px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-violet-500" />
          </div>
        ) : (
          <>
            {saveError && (
              <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-sm text-red-600 dark:text-red-400">
                {saveError}
              </div>
            )}

            {/* ── Identity (full width) ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5">
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <AvatarUpload
                  initials={initials}
                  avatarUrl={avatarUrl}
                  uploading={avatarUploading}
                  onUpload={handleAvatarUpload}
                />

                {/* Fields */}
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FloatingInput
                    id="displayName"
                    label={t('profile.displayName')}
                    value={displayName}
                    onChange={setDisplayName}
                  />
                  <FloatingInput
                    id="email"
                    label={t('profile.email')}
                    value={authEmail ?? ''}
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* ── Preferences + Payments (2 cols) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Preferences */}
              <Section
                title={t('profile.preferences')}
                icon={<Globe size={15} className="text-violet-500" />}
              >
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{t('profile.defaultCurrency')}</p>
                    <CurrencyCombobox value={currency} onChange={setCurrencyState} />
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed pt-1">
                      {t('profile.currencyDesc')}
                    </p>
                  </div>

                  {/* ── Global Sales Tax Rate ── */}
                  <div className="pt-1 border-t border-gray-100 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 pt-3">
                      <p className="text-xs text-gray-500 dark:text-slate-400">{t('profile.globalTaxRate')}</p>
                      <div className="relative group/taxinfo">
                        <Info size={12} className="text-gray-300 dark:text-slate-600 cursor-default" />
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 rounded-lg text-[11px] leading-relaxed bg-gray-800 dark:bg-slate-700 text-white opacity-0 group-hover/taxinfo:opacity-100 transition-opacity z-50 shadow-lg">
                          {t('profile.taxRateTooltip')}
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      'relative flex items-center rounded-xl border transition-colors',
                      'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
                      'hover:border-violet-400 dark:hover:border-violet-500',
                      'focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-300/40',
                    )}>
                      <input
                        type="number"
                        name="default-tax-rate"
                        min="0"
                        max="100"
                        step="0.1"
                        value={defaultTaxRate}
                        onChange={e => setDefaultTaxRate(e.target.value)}
                        placeholder="0"
                        className="flex-1 bg-transparent outline-none text-sm px-3 py-2.5 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                      />
                      <span className="pr-3 text-sm font-medium text-gray-400 dark:text-slate-500 select-none shrink-0">%</span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">
                      {t('profile.taxRateDesc')}
                    </p>
                  </div>

                  <div className="pt-1 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3 pt-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-slate-300">
                          {t('profile.desktopModalLabel')}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed mt-0.5">
                          {t('profile.desktopModalDesc')}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={desktopExpenseModal}
                        onClick={() => onDesktopExpenseModalChange(!desktopExpenseModal)}
                        className={cn(
                          'relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                          desktopExpenseModal ? 'bg-violet-600' : 'bg-gray-200 dark:bg-slate-700',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                            desktopExpenseModal ? 'translate-x-[18px]' : 'translate-x-[3px]',
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </Section>

              {/* Payment handles */}
              <Section
                title={t('profile.paymentHandles')}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                }
              >
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 dark:text-slate-500 -mt-1">
                    {t('profile.paymentHandlesDesc')}
                  </p>
                  <FloatingInput
                    id="venmo"
                    label={t('profile.venmoLabel')}
                    value={venmoHandle}
                    onChange={v => setVenmoHandle(v.replace(/^@+/, ''))}
                    icon={<VenmoIcon />}
                    prefix="@"
                    verified={!!venmoHandle}
                  />
                  <FloatingInput
                    id="cashapp"
                    label={t('profile.cashappLabel')}
                    value={cashappHandle}
                    onChange={v => setCashappHandle(v.replace(/^\$+/, ''))}
                    icon={<CashAppIcon />}
                    prefix="$"
                    verified={!!cashappHandle}
                  />
                  <FloatingInput
                    id="zelle"
                    label={t('profile.zelleLabel')}
                    value={zelleHandle}
                    onChange={setZelleHandle}
                    icon={<ZelleIcon />}
                    verified={!!zelleHandle}
                  />
                </div>
              </Section>
            </div>

            {/* ── Subscription (full width) ── */}
            <Section
              title={t('profile.subscription')}
              icon={<Sparkles size={15} className="text-violet-500" />}
            >
              {subscription.loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-6">

                  {/* ── Billing cycle toggle ── */}
                  <div className="flex justify-center">
                    <div className="inline-flex items-center p-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setBillingCycle('monthly')}
                        className={cn(
                          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                          billingCycle === 'monthly'
                            ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200',
                        )}
                      >
                        {t('profile.monthly')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle('yearly')}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                          billingCycle === 'yearly'
                            ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200',
                        )}
                      >
                        {t('profile.yearly')}
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold leading-none">
                          {t('profile.save20')}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* ── Error ── */}
                  {checkoutError && (
                    <p className="text-xs text-red-500 dark:text-red-400 text-center">{checkoutError}</p>
                  )}

                  {/* ── 3-tier grid ── */}
                  {(() => {
                    const currentTier = subscription.isPro
                      ? tierForPrice(subscription.priceId)
                      : 'free';

                    const proPrice    = billingCycle === 'yearly' ? STRIPE_PRICES.PRO_YEARLY     : STRIPE_PRICES.PRO_MONTHLY;
                    const premierPrice = billingCycle === 'yearly' ? STRIPE_PRICES.PREMIER_YEARLY : STRIPE_PRICES.PREMIER_MONTHLY;

                    // ── Reusable feature row ──────────────────────────────────
                    function FeatureItem({ text, available = true, dark = false, bold = false }: { text: string; available?: boolean; dark?: boolean; bold?: boolean }) {
                      return (
                        <li className="flex items-start gap-2">
                          {available ? (
                            <Check size={13} className="text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                          ) : (
                            <XIcon size={13} className="text-gray-300 dark:text-slate-600 mt-0.5 shrink-0" />
                          )}
                          <span className={cn(
                            'text-xs leading-relaxed',
                            dark
                              ? available ? 'text-slate-200' : 'text-slate-500'
                              : available ? 'text-gray-700 dark:text-slate-300' : 'text-gray-400 dark:text-slate-600',
                          )}>
                            {bold ? <strong className="font-bold">{text}</strong> : text}
                          </span>
                        </li>
                      );
                    }

                    // ── Tier card ─────────────────────────────────────────────
                    type TierCardProps = {
                      tier:         'free' | 'pro' | 'premier';
                      name:         string;
                      monthlyPrice: string;
                      yearlyMonthly: string;
                      yearlyTotal:  string;
                      features:     { text: string; available?: boolean; bold?: boolean }[];
                      priceId:      string | null;
                      popular?:     boolean;
                      dark?:        boolean;
                    };

                    function TierCard({
                      tier, name, monthlyPrice, yearlyMonthly, yearlyTotal,
                      features, priceId, popular = false, dark = false,
                    }: TierCardProps) {
                      const isCurrent  = currentTier === tier;
                      const isComingSoon = !!priceId && priceId.startsWith('price_TODO');
                      const isLoading  = !!priceId && checkoutLoading === priceId;
                      const displayPrice = billingCycle === 'yearly' ? yearlyMonthly : monthlyPrice;
                      const isFree     = tier === 'free';

                      const cardInner = (
                        <div className={cn(
                          'relative flex flex-col rounded-[22px] p-5 transition-all h-full',
                          tier === 'premier'
                            ? 'bg-white dark:bg-gradient-to-br dark:from-[#1c1d28] dark:to-[#12131a]'
                            : popular
                              ? 'border-2 border-violet-500 dark:border-violet-500 bg-white dark:bg-slate-900/50'
                              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50',
                        )}>
                          {/* Current badge */}
                          {isCurrent && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shadow-md">
                                {t('profile.currentPlan')}
                              </span>
                            </div>
                          )}

                          {/* Tier name + badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <p className={cn(
                              'text-xs font-bold uppercase tracking-widest',
                              tier === 'premier' ? 'text-violet-600 dark:text-amber-400'
                                : popular ? 'text-violet-500 dark:text-violet-400'
                                : 'text-gray-400 dark:text-slate-500',
                            )}>
                              {name}
                            </p>
                            {tier === 'premier' && (
                              <Crown size={12} className="text-violet-600 dark:text-amber-400 shrink-0" />
                            )}
                            {popular && (
                              <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                                {t('profile.mostPopular')}
                              </span>
                            )}
                          </div>

                          {/* Price */}
                          <div className="mb-1">
                            {isFree ? (
                              <p className="text-3xl font-extrabold text-gray-900 dark:text-slate-100">
                                {t('profile.free')}
                              </p>
                            ) : (
                              <>
                                <p className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 leading-none">
                                  {displayPrice}
                                  <span className="text-sm font-normal text-gray-400 dark:text-slate-500">{t('profile.perMonth')}</span>
                                </p>
                                {billingCycle === 'yearly' && (
                                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                                    {t('profile.billedYearly', { total: yearlyTotal })}
                                  </p>
                                )}
                              </>
                            )}
                          </div>

                          {/* Features */}
                          <ul className="mt-4 mb-5 space-y-2 flex-1">
                            {features.map((f, i) => (
                              <FeatureItem key={i} text={f.text} available={f.available ?? true} dark={dark} bold={f.bold} />
                            ))}
                          </ul>

                          {/* CTA button */}
                          {isCurrent ? (
                            <button
                              disabled
                              className="w-full py-2 rounded-xl text-sm font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 cursor-not-allowed"
                            >
                              {t('profile.currentPlan')}
                            </button>
                          ) : isFree ? (
                            <button
                              disabled
                              className="w-full py-2 rounded-xl text-sm font-semibold bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed"
                            >
                              {t('profile.freeForever')}
                            </button>
                          ) : isComingSoon ? (
                            <button
                              disabled
                              className="w-full py-2 rounded-xl text-sm font-semibold bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-dashed border-gray-300 dark:border-slate-600 cursor-not-allowed"
                            >
                              {t('profile.comingSoon')}
                            </button>
                          ) : popular ? (
                            <button
                              onClick={() => priceId && handleUpgrade(priceId)}
                              disabled={isLoading || !priceId}
                              className={cn(
                                'w-full py-2 rounded-xl text-sm font-bold text-white text-center transition-all',
                                'bg-gradient-to-r from-purple-500 via-pink-400 to-amber-300',
                                'hover:from-purple-600 hover:via-pink-500 hover:to-amber-400',
                                'shadow-inner active:scale-95 hover:scale-[1.02]',
                                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                              )}
                            >
                              {isLoading
                                ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={13} className="animate-spin" />{t('profile.opening')}</span>
                                : currentTier === 'free' ? t('profile.upgrade') : t('profile.switchPlan')}
                            </button>
                          ) : (
                            <button
                              onClick={() => priceId && handleUpgrade(priceId)}
                              disabled={isLoading || !priceId}
                              className={cn(
                                'w-full py-2 rounded-xl text-sm font-bold text-white text-center transition-all',
                                'bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500',
                                'hover:from-amber-500 hover:via-orange-500 hover:to-pink-600',
                                'shadow-inner active:scale-95 hover:scale-[1.02]',
                                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                              )}
                            >
                              {isLoading
                                ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={13} className="animate-spin" />{t('profile.opening')}</span>
                                : currentTier === 'free' ? t('profile.upgrade') : t('profile.switchPlan')}
                            </button>
                          )}
                        </div>
                      );
                      return tier === 'premier' ? (
                        <div className="p-[2px] rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-600 shadow-[0_0_30px_-10px_rgba(168,85,247,0.25)] dark:shadow-[0_0_60px_-15px_rgba(168,85,247,0.7)]">
                          {cardInner}
                        </div>
                      ) : cardInner;
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                        <TierCard
                          tier="free"
                          name={t('profile.tier.free')}
                          monthlyPrice="$0"
                          yearlyMonthly="$0"
                          yearlyTotal="$0"
                          priceId={null}
                          features={[
                            { text: t('profile.tier.freeGroups') },
                            { text: t('profile.tier.freeMembers') },
                            { text: t('profile.tier.freeExpenses') },
                            { text: t('profile.tier.smartSettle') },
                            { text: t('profile.tier.prioritySupport'), available: false },
                          ]}
                        />
                        <TierCard
                          tier="pro"
                          name={t('profile.tier.pro')}
                          monthlyPrice="$4.99"
                          yearlyMonthly="$3.99"
                          yearlyTotal="$47.88"
                          priceId={proPrice}
                          popular
                          features={[
                            { text: t('profile.tier.proGroups') },
                            { text: t('profile.tier.proMembers') },
                            { text: t('profile.tier.unlimitedExpenses'), bold: true },
                            { text: t('profile.tier.smartSettleEnabled') },
                            { text: t('profile.tier.prioritySupport'), available: false },
                          ]}
                        />
                        <TierCard
                          tier="premier"
                          name={t('profile.tier.premier')}
                          monthlyPrice="$9.99"
                          yearlyMonthly="$7.99"
                          yearlyTotal="$95.88"
                          priceId={premierPrice}
                          features={[
                            { text: t('profile.tier.unlimitedGroups'), bold: true },
                            { text: t('profile.tier.unlimitedMembers'), bold: true },
                            { text: t('profile.tier.unlimitedExpenses'), bold: true },
                            { text: t('profile.tier.smartSettleEnabled') },
                            { text: t('profile.tier.prioritySupport') },
                          ]}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </Section>

            {/* ── Stats strip ── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm px-5 py-4 flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                <BarChart3 size={14} className="shrink-0" />
                <span className="text-sm">
                  <span className="font-semibold text-gray-700 dark:text-slate-300">
                    {stats?.groupCount ?? '—'}
                  </span>{' '}
                  {t('profile.stat.group', { count: stats?.groupCount ?? 0 })}
                </span>
              </div>
              <div className="w-px h-4 bg-gray-200 dark:bg-slate-700 shrink-0" />
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                <span className="text-sm">
                  <span className="font-semibold text-gray-700 dark:text-slate-300">
                    {stats?.expenseCount ?? '—'}
                  </span>{' '}
                  {t('profile.stat.expense', { count: stats?.expenseCount ?? 0 })} {t('profile.stat.added')}
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
