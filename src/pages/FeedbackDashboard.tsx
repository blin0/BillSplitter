import { useState, useEffect } from 'react';
import { Bug, Lightbulb, MessageSquare, Loader2, Inbox, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/cn';
import { fetchAllFeedback, type FeedbackRow } from '../lib/db';

type Filter = 'all' | 'bug' | 'feature' | 'general';

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  bug:     { label: 'Bug',     icon: <Bug       size={12} />, color: 'text-red-400    bg-red-400/10    border-red-400/20'    },
  feature: { label: 'Feature', icon: <Lightbulb size={12} />, color: 'text-amber-400  bg-amber-400/10  border-amber-400/20'  },
  general: { label: 'General', icon: <MessageSquare size={12} />, color: 'text-blue-400   bg-blue-400/10   border-blue-400/20'   },
};

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.general;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', meta.color)}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(min  / 60);
  const day  = Math.floor(hr   / 24);
  if (day  > 0) return `${day}d ago`;
  if (hr   > 0) return `${hr}h ago`;
  if (min  > 0) return `${min}m ago`;
  return 'just now';
}

export default function FeedbackDashboard() {
  const [rows,    setRows   ] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState<string | null>(null);
  const [filter,  setFilter ] = useState<Filter>('all');

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchAllFeedback();
    setLoading(false);
    if (err || !data) { setError(err ?? 'Failed to load feedback'); return; }
    setRows(data);
  }

  useEffect(() => { load(); }, []);

  const visible = filter === 'all' ? rows : rows.filter(r => r.category === filter);

  const counts = {
    all:     rows.length,
    bug:     rows.filter(r => r.category === 'bug').length,
    feature: rows.filter(r => r.category === 'feature').length,
    general: rows.filter(r => r.category === 'general').length,
  };

  return (
    <div className="min-h-full bg-gray-50 dark:bg-slate-950 px-4 py-6 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 text-white text-[9px] font-bold uppercase tracking-widest">
                Developer
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">
              User Feedback
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {rows.length} submission{rows.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'bug', 'feature', 'general'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                filter === f
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600',
              )}
            >
              {f === 'all'     && <MessageSquare size={11} />}
              {f === 'bug'     && <Bug           size={11} />}
              {f === 'feature' && <Lightbulb     size={11} />}
              {f === 'general' && <MessageSquare size={11} />}
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={cn(
                'px-1.5 py-px rounded-full text-[10px]',
                filter === f ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500',
              )}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-violet-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle size={28} className="text-amber-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{error}</p>
            <button onClick={load} className="text-xs text-violet-500 hover:underline">Try again</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox size={28} className="text-gray-300 dark:text-slate-600" />
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {filter === 'all' ? 'No feedback yet.' : `No ${filter} submissions.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(row => (
              <div
                key={row.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <CategoryBadge category={row.category} />
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 shrink-0">
                    {timeAgo(row.created_at)}
                  </span>
                </div>

                <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {row.message}
                </p>

                <div className="flex items-center gap-3 pt-1 border-t border-gray-50 dark:border-slate-800">
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 font-mono truncate">
                    {row.email ?? row.user_id ?? 'anonymous'}
                  </span>
                  <span className="text-[11px] text-gray-300 dark:text-slate-600 shrink-0">
                    {new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
