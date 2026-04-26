import { useState, type FormEvent } from 'react';
import { Receipt, Mail, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Full-screen sign-in wall shown when there is no active session.
 * Uses Supabase magic-link (OTP) email auth — no password required.
 */
export default function AuthGate() {
  const { signInWithEmail } = useAuth();
  const [email,   setEmail  ] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent   ] = useState(false);
  const [error,   setError  ] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signInWithEmail(email.trim());
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="p-3 bg-violet-600 rounded-2xl shadow-lg">
            <Receipt size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">BillSplitter</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500">Split expenses fairly</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          {sent ? (
            /* ── Success state ── */
            <div className="text-center py-4 space-y-3">
              <CheckCircle size={40} className="text-green-500 mx-auto" />
              <p className="font-semibold text-gray-900 dark:text-slate-100">Check your email</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-xs text-violet-600 hover:underline mt-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* ── Sign-in form ── */
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">
                Sign in to continue
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
                Enter your email and we'll send you a magic link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center gap-2 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent bg-gray-50 dark:bg-slate-800">
                  <Mail size={16} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  <input
                    type="email"
                    name="email"
                    required
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
                    ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
                    : 'Send magic link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
