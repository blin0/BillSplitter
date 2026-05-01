import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type PageState = 'waiting' | 'ready' | 'done' | 'expired';

export default function ResetPassword() {
  const navigate = useNavigate();

  const [pageState,  setPageState ] = useState<PageState>('waiting');
  const [password,   setPassword  ] = useState('');
  const [confirm,    setConfirm   ] = useState('');
  const [showPw,     setShowPw    ] = useState(false);
  const [showCfm,    setShowCfm   ] = useState(false);
  const [loading,    setLoading   ] = useState(false);
  const [error,      setError     ] = useState<string | null>(null);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the recovery link is followed.
    // It also establishes a session automatically from the URL hash tokens.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPageState('ready');
    });

    // Handle the case where the page is already loaded with an active session
    // (e.g. user clicked the link and the tab is still open with a valid token).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPageState('ready');
    });

    // If no PASSWORD_RECOVERY event fires within 5 s, the token is missing/expired.
    const timer = setTimeout(() => {
      setPageState(s => s === 'waiting' ? 'expired' : s);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setPageState('done');
      setTimeout(() => navigate('/'), 2500);
    }
  }

  // ── Shared input classes ────────────────────────────────────────────────────
  const fieldWrap = 'relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.10] bg-white/[0.04] focus-within:border-violet-500/60 focus-within:bg-white/[0.06] transition-colors overflow-visible';
  const inputCls  = 'flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none caret-violet-400 autofill:shadow-[inset_0_0_0_1000px_#171527]';
  const iconCls   = 'relative z-10 bg-transparent text-slate-500 shrink-0 pointer-events-none';

  return (
    <div className="min-h-screen bg-[#060612] flex items-center justify-center px-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.10] bg-[#0d0b1e]/90 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Violet top sheen */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-600/10 to-transparent" />

        <div className="relative p-8">

          {/* ── Waiting for token ── */}
          {pageState === 'waiting' && (
            <div className="text-center py-6">
              <Loader2 size={32} className="animate-spin text-violet-400 mx-auto mb-4" />
              <p className="text-sm text-slate-400">Verifying your reset link…</p>
            </div>
          )}

          {/* ── Token expired / invalid ── */}
          {pageState === 'expired' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 6v4m0 4h.01M3 10a7 7 0 1 1 14 0A7 7 0 0 1 3 10z" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="font-semibold text-white mb-1">Link expired</p>
              <p className="text-sm text-slate-400 mb-4">
                This reset link has expired or is invalid. Request a new one from the sign-in screen.
              </p>
              <button
                onClick={() => navigate('/')}
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          {/* ── Success ── */}
          {pageState === 'done' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M4 11l5 5 9-9" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="font-semibold text-white mb-1">Password updated</p>
              <p className="text-sm text-slate-400">You're being signed in now…</p>
            </div>
          )}

          {/* ── Update password form ── */}
          {pageState === 'ready' && (
            <>
              <div className="mb-6 text-center">
                <img src="/favicon.svg" alt="Axiom Splits" className="w-10 h-10 mx-auto mb-3 opacity-90" />
                <h2 className="text-xl font-bold tracking-tight text-white mb-1">Choose a new password</h2>
                <p className="text-sm text-slate-400">Must be at least 6 characters.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">

                <div className={fieldWrap}>
                  <Lock size={15} className={iconCls} />
                  <input
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    required
                    placeholder="New password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={inputCls}
                    autoComplete="new-password"
                    autoFocus
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

                <div className={fieldWrap}>
                  <Lock size={15} className={iconCls} />
                  <input
                    type={showCfm ? 'text' : 'password'}
                    name="confirm"
                    required
                    placeholder="Confirm new password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className={inputCls}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCfm(v => !v)}
                    className="relative z-10 bg-transparent text-slate-600 hover:text-slate-300 transition-colors shrink-0"
                    aria-label={showCfm ? 'Hide confirm password' : 'Show confirm password'}
                    tabIndex={-1}
                  >
                    {showCfm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-amber-400 -mt-1">
                    Password must be at least 6 characters.
                  </p>
                )}

                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs text-amber-400 -mt-1">Passwords do not match.</p>
                )}

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" />Updating…</>
                    : 'Update password'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
