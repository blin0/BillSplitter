import { useState, type FormEvent } from 'react';
import { Plus, Hash, Loader2, Users } from 'lucide-react';
import { createGroup, joinGroupByCode, type GroupInfo } from '../lib/db';

interface Props {
  /** Called after successfully creating a group. */
  onCreated: (group: GroupInfo) => void;
  /** Called after successfully joining a group. */
  onJoined:  (group: GroupInfo) => void;
}

/**
 * Two-panel card: create a new group OR join one by 6-char code.
 * Rendered as a centered page when the user has no groups yet,
 * or inside the sidebar for returning users.
 */
export default function GroupActions({ onCreated, onJoined }: Props) {
  // ── Create state ───────────────────────────────────────────────────────────
  const [createName,    setCreateName   ] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError,   setCreateError  ] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreateError(null);
    setCreateLoading(true);
    const { data, error } = await createGroup(name);
    setCreateLoading(false);
    if (error || !data) {
      setCreateError(error ?? 'Something went wrong.');
    } else {
      setCreateName('');
      onCreated(data);
    }
  }

  // ── Join state ─────────────────────────────────────────────────────────────
  const [joinCode,    setJoinCode   ] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError,   setJoinError  ] = useState<string | null>(null);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('Code must be exactly 6 characters.');
      return;
    }
    setJoinError(null);
    setJoinLoading(true);
    const { data, error } = await joinGroupByCode(code);
    setJoinLoading(false);
    if (error || !data) {
      setJoinError(error ?? 'Something went wrong.');
    } else {
      setJoinCode('');
      onJoined(data);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Create a group ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-violet-100 dark:bg-violet-900/40 rounded-lg">
            <Plus size={14} className="text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Create a group
          </h3>
        </div>

        <form onSubmit={handleCreate} className="space-y-2.5">
          <input
            type="text"
            required
            placeholder="e.g. Japan Trip 2025"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            maxLength={60}
            className="w-full px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          {createError && (
            <p className="text-xs text-red-500 dark:text-red-400">{createError}</p>
          )}
          <button
            type="submit"
            disabled={createLoading || !createName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl py-2 transition-colors"
          >
            {createLoading
              ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
              : 'Create group'}
          </button>
        </form>
      </div>

      {/* ── Join a group ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
            <Users size={14} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Join a group
          </h3>
        </div>

        <form onSubmit={handleJoin} className="space-y-2.5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent">
            <Hash size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="6-digit code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none font-mono tracking-widest uppercase"
            />
          </div>
          {joinError && (
            <p className="text-xs text-red-500 dark:text-red-400">{joinError}</p>
          )}
          <button
            type="submit"
            disabled={joinLoading || joinCode.trim().length !== 6}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl py-2 transition-colors"
          >
            {joinLoading
              ? <><Loader2 size={14} className="animate-spin" /> Joining…</>
              : 'Join group'}
          </button>
        </form>
      </div>

    </div>
  );
}
