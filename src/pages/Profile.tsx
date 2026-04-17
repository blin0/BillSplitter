import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Check, Camera, Globe, BarChart3, Sparkles, Crown, Zap, Infinity } from 'lucide-react';
import { cn } from '../lib/cn';
import { supabase } from '../lib/supabase';
import {
  fetchOwnProfile, updateOwnProfile, fetchOwnStats, createCheckoutSession,
  type OwnProfile, type OwnStats,
} from '../lib/db';
import { CURRENCIES, useCurrency, type CurrencyCode } from '../context/CurrencyContext';
import { useSubscription } from '../hooks/useSubscription';
import { STRIPE_PRICES } from '../lib/stripe-prices';

interface Props {
  authEmail: string | null;
  authName:  string | null;
  userId:    string | null;
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
        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-300/40',
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
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search currencies…"
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
        aria-label="Change photo"
      >
        {uploading
          ? <Loader2 size={16} className="animate-spin" />
          : <Camera size={16} />}
        <span className="text-[9px] font-semibold leading-none">
          {uploading ? 'Uploading' : 'Change'}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
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

export default function Profile({ authEmail, authName, userId }: Props) {
  const { setCurrency } = useCurrency();

  const [profile,         setProfile        ] = useState<OwnProfile | null>(null);
  const [stats,           setStats          ] = useState<OwnStats | null>(null);
  const [loading,         setLoading        ] = useState(true);
  const [saving,          setSaving         ] = useState(false);
  const [saved,           setSaved          ] = useState(false);
  const [saveError,       setSaveError      ] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl,       setAvatarUrl      ] = useState<string | null>(null);

  const [displayName,   setDisplayName  ] = useState('');
  const [venmoHandle,   setVenmoHandle  ] = useState('');
  const [cashappHandle, setCashappHandle] = useState('');
  const [zelleHandle,   setZelleHandle  ] = useState('');
  const [currency,      setCurrencyState] = useState<CurrencyCode>('USD');

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
      }
      if (sRes.data) setStats(sRes.data);
    });
    return () => { cancelled = true; };
  }, []);

  const isDirty = profile != null && (
    displayName   !== (profile.fullName      ?? '')  ||
    venmoHandle   !== (profile.venmoHandle   ?? '')  ||
    cashappHandle !== (profile.cashappHandle ?? '')  ||
    zelleHandle   !== (profile.zelleHandle   ?? '')  ||
    currency      !== (profile.defaultCurrency as CurrencyCode ?? 'USD')
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
    });
    setSaving(false);
    if (error) { setSaveError(error); return; }
    setProfile(prev => prev ? {
      ...prev,
      fullName: displayName.trim() || null,
      venmoHandle: cleanVenmo || null,
      cashappHandle: cleanCashApp || null,
      zelleHandle: cleanZelle || null,
      defaultCurrency: currency,
    } : prev);
    setVenmoHandle(cleanVenmo);
    setCashappHandle(cleanCashApp);
    setZelleHandle(cleanZelle);
    setCurrency(currency);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const subscription = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null); // priceId being processed
  const [checkoutError,   setCheckoutError  ] = useState<string | null>(null);

  async function handleUpgrade(priceId: string) {
    setCheckoutLoading(priceId);
    setCheckoutError(null);
    const { data: url, error } = await createCheckoutSession(priceId);
    setCheckoutLoading(null);
    if (error || !url) { setCheckoutError(error ?? 'Could not start checkout'); return; }
    window.location.href = url;
  }

  const initials = (displayName || authName || authEmail || '?')[0].toUpperCase();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-gray-50 dark:bg-slate-950">

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
            {saved ? 'Saved!' : 'Save changes'}
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
                    label="Display name"
                    value={displayName}
                    onChange={setDisplayName}
                  />
                  <FloatingInput
                    id="email"
                    label="Email"
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
                title="Preferences"
                icon={<Globe size={15} className="text-violet-500" />}
              >
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Default currency</p>
                  <CurrencyCombobox value={currency} onChange={setCurrencyState} />
                  <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed pt-1">
                    Synced on sign-in. Changeable any time in the header.
                  </p>
                </div>
              </Section>

              {/* Payment handles */}
              <Section
                title="Payment handles"
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                }
              >
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 dark:text-slate-500 -mt-1">
                    Members can tap these to pay you directly. No @ or $.
                  </p>
                  <FloatingInput
                    id="venmo"
                    label="Venmo username"
                    value={venmoHandle}
                    onChange={v => setVenmoHandle(v.replace(/^@+/, ''))}
                    icon={<VenmoIcon />}
                    prefix="@"
                    verified={!!venmoHandle}
                  />
                  <FloatingInput
                    id="cashapp"
                    label="Cash App $cashtag"
                    value={cashappHandle}
                    onChange={v => setCashappHandle(v.replace(/^\$+/, ''))}
                    icon={<CashAppIcon />}
                    prefix="$"
                    verified={!!cashappHandle}
                  />
                  <FloatingInput
                    id="zelle"
                    label="Zelle (email or phone)"
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
              title="Subscription"
              icon={<Sparkles size={15} className="text-violet-500" />}
            >
              {subscription.loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                </div>
              ) : subscription.isPro ? (
                /* ── Active Pro badge ── */
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-200 dark:border-violet-800/50">
                  <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40 shrink-0">
                    <Crown size={16} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">Pro Member</p>
                    <p className="text-xs text-violet-500 dark:text-violet-400 capitalize">
                      {subscription.subscriptionStatus ?? 'active'}
                      {subscription.priceId === STRIPE_PRICES.LIFETIME ? ' · Lifetime' : ' · Monthly'}
                    </p>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wide">
                    PRO
                  </span>
                </div>
              ) : (
                /* ── Upgrade plan cards ── */
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Free plan: up to 3 groups. Upgrade for unlimited groups and future Pro features.
                  </p>
                  {checkoutError && (
                    <p className="text-xs text-red-500 dark:text-red-400 px-1">{checkoutError}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Plus Monthly */}
                    <div className="relative flex flex-col gap-2 p-4 rounded-xl border-2 border-violet-200 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-950/20">
                      <div className="flex items-center gap-2">
                        <Zap size={15} className="text-violet-600 dark:text-violet-400 shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Plus</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 leading-none">
                        $4.99<span className="text-sm font-normal text-gray-400 dark:text-slate-500">/mo</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 flex-1">Unlimited groups, cancel any time.</p>
                      <button
                        onClick={() => handleUpgrade(STRIPE_PRICES.PLUS_MONTHLY)}
                        disabled={checkoutLoading === STRIPE_PRICES.PLUS_MONTHLY}
                        className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:brightness-110 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {checkoutLoading === STRIPE_PRICES.PLUS_MONTHLY
                          ? <><Loader2 size={12} className="animate-spin" /> Opening…</>
                          : 'Subscribe'}
                      </button>
                    </div>
                    {/* Lifetime */}
                    <div className="relative flex flex-col gap-2 p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/20">
                      <div className="absolute -top-2.5 left-3">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wide">Best value</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Infinity size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Lifetime</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 leading-none">
                        $49<span className="text-sm font-normal text-gray-400 dark:text-slate-500"> once</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 flex-1">Pay once, own it forever.</p>
                      <button
                        onClick={() => handleUpgrade(STRIPE_PRICES.LIFETIME)}
                        disabled={checkoutLoading === STRIPE_PRICES.LIFETIME}
                        className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:brightness-110 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {checkoutLoading === STRIPE_PRICES.LIFETIME
                          ? <><Loader2 size={12} className="animate-spin" /> Opening…</>
                          : 'Buy lifetime'}
                      </button>
                    </div>
                  </div>
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
                  {stats?.groupCount === 1 ? 'group' : 'groups'}
                </span>
              </div>
              <div className="w-px h-4 bg-gray-200 dark:bg-slate-700 shrink-0" />
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                <span className="text-sm">
                  <span className="font-semibold text-gray-700 dark:text-slate-300">
                    {stats?.expenseCount ?? '—'}
                  </span>{' '}
                  {stats?.expenseCount === 1 ? 'expense' : 'expenses'} added
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
