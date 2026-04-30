import { useState, type FormEvent } from 'react';
import { X, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Mode = 'signin' | 'signup';

interface Props {
  onClose?: () => void;
}

export default function AuthCard({ onClose }: Props) {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword } = useAuth();

  const [mode,     setMode    ] = useState<Mode>('signin');
  const [email,    setEmail   ] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw  ] = useState(false);
  const [loading,  setLoading ] = useState(false);
  const [error,    setError   ] = useState<string | null>(null);
  const [confirmed,setConfirmed] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
    setShowPw(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signInWithPassword(email.trim(), password);
      setLoading(false);
      if (error) setError('Incorrect email or password. Please try again.');
    } else {
      const { error } = await signUpWithPassword(email.trim(), password);
      setLoading(false);
      if (error) setError(error);
      else setConfirmed(true);
    }
  }

  const isSignIn = mode === 'signin';

  return (
    <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.10] bg-[#0d0b1e]/90 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">

      {/* Violet top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-600/10 to-transparent" />

      <div className="relative p-8">

        {/* Close button — only when used as a modal */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        )}

        {confirmed ? (
          /* ── Sign-up success ── */
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 11l5 5 9-9" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="font-semibold text-white mb-1">Check your email</p>
            <p className="text-sm text-slate-400">
              We sent a confirmation link to{' '}
              <span className="text-white font-medium">{email}</span>.
              Click it to activate your account.
            </p>
            <button
              onClick={() => { setConfirmed(false); switchMode('signin'); }}
              className="mt-4 text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="mb-6 text-center">
              <img src="/favicon.svg" alt="Axiom Splits" className="w-10 h-10 mx-auto mb-3 opacity-90" />
              <h2 className="text-xl font-bold tracking-tight text-white mb-1">
                Welcome to Axiom Splits
              </h2>
              <p className="text-sm text-slate-400">
                {isSignIn ? 'Sign in to your account' : 'Create your free account'}
              </p>
            </div>

            {/* ── Google OAuth ── */}
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-sm font-medium text-white mb-4"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* ── Divider ── */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-[11px] text-slate-600 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Email */}
              <div className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.10] bg-white/[0.04] focus-within:border-violet-500/60 focus-within:bg-white/[0.06] transition-colors overflow-visible">
                <Mail size={15} className="relative z-10 bg-transparent text-slate-500 shrink-0 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none caret-violet-400 autofill:shadow-[inset_0_0_0_1000px_#171527]"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.10] bg-white/[0.04] focus-within:border-violet-500/60 focus-within:bg-white/[0.06] transition-colors overflow-visible">
                <Lock size={15} className="relative z-10 bg-transparent text-slate-500 shrink-0 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder={isSignIn ? 'Password' : 'Password (min. 6 characters)'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none caret-violet-400 autofill:shadow-[inset_0_0_0_1000px_#171527]"
                  autoComplete={isSignIn ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="relative z-10 bg-transparent text-slate-600 hover:text-slate-300 transition-colors shrink-0"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {/* Inline length hint */}
              {!isSignIn && password.length > 0 && password.length < 6 && (
                <p className="text-xs text-amber-400 -mt-1">
                  Password must be at least 6 characters.
                </p>
              )}

              {/* Error */}
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              {/* Submit — violet-to-indigo gradient */}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" />{isSignIn ? 'Signing in…' : 'Creating account…'}</>
                  : isSignIn ? 'Sign in' : 'Create account'}
              </button>
            </form>

            {/* ── Mode toggle ── */}
            <p className="mt-5 text-center text-sm text-slate-500">
              {isSignIn ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(isSignIn ? 'signup' : 'signin')}
                className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
              >
                {isSignIn ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
