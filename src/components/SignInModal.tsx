import { useState, useEffect, type FormEvent } from 'react';
import { X, Mail, Loader2, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose: () => void;
}

export default function SignInModal({ onClose }: Props) {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const { t } = useTranslation();
  const [email,   setEmail  ] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent   ] = useState(false);
  const [error,   setError  ] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signInWithEmail(email.trim());
    setLoading(false);
    if (error) setError(error);
    else setSent(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 p-6 relative">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={t('common.close')}
        >
          <X size={16} />
        </button>

        {sent ? (
          <div className="text-center py-2 space-y-3">
            <CheckCircle size={40} className="text-green-500 mx-auto" />
            <p className="font-semibold text-gray-900 dark:text-slate-100">{t('signIn.checkEmail')}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t('signIn.magicLinkSent', { email })}
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-xs text-violet-600 hover:underline"
            >
              {t('signIn.useDifferentEmail')}
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">
              {t('signIn.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
              {t('signIn.subtitle')}
            </p>

            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 dark:border-slate-700 rounded-xl py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors mb-4"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {t('signIn.google')}
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
              <span className="text-xs text-gray-400 dark:text-slate-500">{t('common.or')}</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center gap-2 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent bg-gray-50 dark:bg-slate-800">
                <Mail size={16} className="text-gray-400 dark:text-slate-500 shrink-0" />
                <input
                  type="email"
                  name="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none"
                  autoComplete="email"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> {t('signIn.sending')}</>
                  : t('signIn.sendMagicLink')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
