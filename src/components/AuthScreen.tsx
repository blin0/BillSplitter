import { useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Receipt, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

// ── Google "G" logo SVG ───────────────────────────────────────────────────────
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuthScreen({ onClose, modal = false }: { onClose?: () => void; modal?: boolean }) {
  const { signIn } = useAuthActions();

  const [mode, setMode]           = useState<'login' | 'signup'>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]         = useState('');

  // ── Google OAuth ─────────────────────────────────────────────────────────
  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      await signIn('google');
    } catch (err) {
      setError('Could not start Google sign-in. Please try again.');
      setGoogleLoading(false);
    }
  }

  // ── Password submit ───────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password)  { setError('Please fill in all fields.'); return; }
    if (password.length < 8)         { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      await signIn('password', {
        email:  email.trim(),
        password,
        flow:   mode === 'signup' ? 'signUp' : 'signIn',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('InvalidAccountId') || msg.includes('No account')) {
        setError('No account found with that email.');
      } else if (msg.includes('InvalidSecret') || msg.includes('incorrect')) {
        setError('Incorrect password.');
      } else if (msg.includes('already') || msg.includes('exists')) {
        setError('An account with that email already exists.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const anyLoading = loading || googleLoading;

  const card = (
    <div className="w-full max-w-sm bg-white dark:bg-zinc-950/90 rounded-2xl shadow-2xl border border-violet-500/20 dark:border-violet-500/30 pt-10 px-7 pb-6">

      {/* Logo — inside card when modal, standalone when not */}
      {modal && (
        <div className="flex flex-col items-center gap-1 mb-7">
          <div className="p-3 bg-violet-600 rounded-xl mb-2">
            <Receipt size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-none">BillSplitter</h1>
          <p className="text-xs font-medium text-violet-700 dark:text-violet-200/90">Split expenses fairly</p>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden mb-6 text-sm">
        {(['login', 'signup'] as const).map(m => (
          <button
            key={m}
            type="button"
            disabled={anyLoading}
            onClick={() => { setMode(m); setError(''); }}
            className={cn(
              'flex-1 py-2 font-medium transition-colors',
              mode === m
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700',
              anyLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {m === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        ))}
      </div>

      {/* Google button */}
      <button
        type="button"
        disabled={anyLoading}
        onClick={handleGoogle}
        className={cn(
          'w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all',
          'border-gray-200 dark:border-slate-700',
          'bg-white dark:bg-slate-800',
          'text-gray-700 dark:text-slate-200',
          'hover:bg-gray-50 dark:hover:bg-slate-700/80 hover:border-gray-300 dark:hover:border-slate-600',
          'hover:scale-[1.01] active:scale-[0.99]',
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100'
        )}
      >
        {googleLoading
          ? <Loader2 size={16} className="animate-spin text-slate-400" />
          : <GoogleIcon className="w-4 h-4 shrink-0" />
        }
        {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
      </button>

      {/* "— or —" divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        <span className="text-xs text-slate-400 dark:text-slate-500 select-none">or</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
      </div>

      {/* Email / password form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={anyLoading}
            className={cn(
              'w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm transition-colors',
              'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800',
              'text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500',
              'hover:border-gray-300 dark:hover:border-slate-600',
              'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20',
              anyLoading && 'opacity-60 cursor-not-allowed'
            )}
          />
        </div>

        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type={showPw ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={anyLoading}
            className={cn(
              'w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm transition-colors',
              'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800',
              'text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500',
              'hover:border-gray-300 dark:hover:border-slate-600',
              'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20',
              anyLoading && 'opacity-60 cursor-not-allowed'
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 px-0.5">{error}</p>
        )}

        <button
          type="submit"
          disabled={anyLoading}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium',
            'bg-violet-600 hover:bg-violet-500 text-white',
            'transition-all hover:scale-[1.01] active:scale-[0.99]',
            'disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100'
          )}
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" />{mode === 'login' ? 'Logging in…' : 'Creating account…'}</>
            : mode === 'login' ? 'Log In' : 'Create Account'
          }
        </button>
      </form>

      {/* Toggle hint */}
      <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          type="button"
          disabled={anyLoading}
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
          className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
        >
          {mode === 'login' ? 'Sign Up' : 'Log In'}
        </button>
      </p>

      {/* Continue as guest */}
      {onClose && (
        <button
          type="button"
          disabled={anyLoading}
          onClick={onClose}
          className="mt-3 w-full text-center text-xs text-slate-600 dark:text-slate-300 underline underline-offset-4 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:opacity-50"
        >
          Continue as Guest
        </button>
      )}
    </div>
  );

  if (modal) return card;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Logo — standalone page only */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-violet-600 rounded-xl">
          <Receipt size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-none">BillSplitter</h1>
          <p className="text-xs text-gray-400 dark:text-slate-500">Split expenses fairly</p>
        </div>
      </div>
      {card}
    </div>
  );
}
