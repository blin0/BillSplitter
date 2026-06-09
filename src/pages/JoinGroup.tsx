import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchGroupInvite, acceptGroupInvite, type GroupInviteInfo } from '../lib/db';

const PENDING_INVITE_KEY = 'axiom_pending_invite_token';

interface Props {
  onShowSignIn: () => void;
}

export default function JoinGroup({ onShowSignIn }: Props) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [invite,      setInvite     ] = useState<GroupInviteInfo | null>(null);
  const [loadError,   setLoadError  ] = useState<string | null>(null);
  const [accepting,   setAccepting  ] = useState(false);
  const [accepted,    setAccepted   ] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const acceptingRef = useRef(false);

  useEffect(() => {
    if (!token) { setLoadError('Invalid invite link.'); return; }
    fetchGroupInvite(token).then(({ data, error }) => {
      if (error || !data) { setLoadError(error ?? 'Invite not found or expired.'); return; }
      setInvite(data);
    });
  }, [token]);

  // Auto-accept once both user and invite are available — ref prevents double-fire
  useEffect(() => {
    if (!user || !invite || accepted || acceptingRef.current) return;
    localStorage.removeItem(PENDING_INVITE_KEY);
    handleAccept();
  }, [user?.id, invite?.groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAccept() {
    if (!token || acceptingRef.current) return;
    acceptingRef.current = true;
    setAccepting(true);
    setAcceptError(null);

    const { data, error } = await acceptGroupInvite(token);
    setAccepting(false);

    if (error || !data) {
      acceptingRef.current = false;
      setAcceptError(error ?? 'Failed to accept invite.');
      return;
    }

    setAccepted(true);
    // Hard reload so App.tsx re-fetches groups and the new group is in the list
    setTimeout(() => { window.location.href = `/group/${data.groupId}`; }, 1500);
  }

  function handleSignInClick() {
    if (token) localStorage.setItem(PENDING_INVITE_KEY, token);
    onShowSignIn();
  }

  if (!token || loadError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-73px)] px-4">
        <div className="text-center max-w-sm">
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 inline-flex mb-4">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid Invite</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">{loadError ?? 'This invite link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-73px)]">
        <Loader2 size={28} className="animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-73px)] px-4 py-12">
      <div className="w-full max-w-md">

        {accepted ? (
          <div className="text-center">
            <div className="inline-flex p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 mb-4">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">You're in!</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Redirecting to {invite.groupName}…</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700/60 rounded-3xl shadow-xl overflow-hidden">

            <div className="bg-gradient-to-br from-violet-600 to-violet-700 p-6 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-white/20 mb-3">
                <Users size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">You've been invited</h2>
              <p className="text-sm text-violet-200 mt-1">to join a group on Axiom Splits</p>
            </div>

            <div className="p-6">
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/30 rounded-2xl p-4 mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-500 mb-1">Group</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{invite.groupName}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  Joining as <strong className="text-gray-700 dark:text-slate-300">{invite.participantName}</strong>
                </p>
              </div>

              {acceptError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-3 py-2 mb-4">
                  {acceptError}
                </p>
              )}

              {accepting ? (
                <div className="flex items-center justify-center gap-2 py-3">
                  <Loader2 size={16} className="animate-spin text-violet-500" />
                  <span className="text-sm text-gray-500">Joining group…</span>
                </div>
              ) : !user ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-slate-400 text-center">
                    Sign in or create a free account to accept this invite.
                  </p>
                  <button
                    onClick={handleSignInClick}
                    className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Sign in to accept
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
