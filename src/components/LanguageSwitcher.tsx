import { useState, useRef, useEffect, useCallback } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LANG_STORAGE_KEY, type LangCode } from '../lib/i18n';
import { cn } from '../lib/cn';
import { useAuth } from '../context/AuthContext';
import { updateOwnProfile } from '../lib/db';

interface Props {
  /** 'light' renders on a dark/transparent navbar (Landing). 'dark' on app header. */
  variant?: 'light' | 'dark';
}

export default function LanguageSwitcher({ variant = 'dark' }: Props) {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
        return;
      }
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onDown);
    };
  }, [open]);

  const handleSelect = useCallback(async (code: LangCode) => {
    setOpen(false);
    if (code === i18n.language) return;

    // 1. Update i18next (triggers DOM dir+lang update via the listener in i18n.ts)
    await i18n.changeLanguage(code);

    // 2. Persist to localStorage (also done by i18next-browser-languagedetector,
    //    but we set it explicitly for reliability)
    try { localStorage.setItem(LANG_STORAGE_KEY, code); } catch (_) {}

    // 3. Sync to Supabase profile if signed in
    if (user) {
      void updateOwnProfile({ languagePreference: code });
    }
  }, [i18n, user]);

  // ── Styles per variant ──────────────────────────────────────────────────────
  const btnCls = variant === 'light'
    ? 'p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors'
    : 'p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors';

  const dropdownCls = variant === 'light'
    ? 'absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/[0.10] bg-[#0d0b1e] shadow-2xl shadow-black/60 overflow-hidden z-50'
    : 'absolute right-0 top-full mt-2 w-52 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-black/10 overflow-hidden z-50';

  const headerCls = variant === 'light'
    ? 'px-3 py-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold border-b border-white/[0.06]'
    : 'px-3 py-2 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold border-b border-gray-100 dark:border-slate-800';

  const itemBase = variant === 'light'
    ? 'flex items-center justify-between w-full px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06] transition-colors'
    : 'flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors';

  const itemActiveCls = variant === 'light'
    ? 'bg-violet-500/10 text-violet-300'
    : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400';

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={t('nav.language')}
        aria-expanded={open}
        className={btnCls}
      >
        <Globe size={18} />
      </button>

      {open && (
        <div className={dropdownCls} role="listbox" aria-label={t('nav.language')}>
          <div className={headerCls}>{t('nav.language')}</div>

          <div className="max-h-72 overflow-y-auto py-1">
            {SUPPORTED_LANGUAGES.map(lang => {
              const isActive = lang.code === i18n.language;
              return (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(lang.code as LangCode)}
                  className={cn(itemBase, isActive && itemActiveCls)}
                  dir={lang.dir}
                >
                  <span className="font-medium">{lang.nativeName}</span>
                  {isActive && (
                    <Check size={14} className={variant === 'light' ? 'text-violet-400' : 'text-violet-500'} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
