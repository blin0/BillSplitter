import { useState } from 'react';
import { WifiOff, Clock, X } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { cn } from '../lib/cn';

export default function OfflineBanner() {
  const { ratesSource, ratesLoading } = useCurrency();
  const [dismissed, setDismissed] = useState(false);

  if (ratesLoading || ratesSource === 'live' || dismissed) return null;

  const isStale    = ratesSource === 'stale-cache';
  const isFallback = ratesSource === 'fallback';

  return (
    <div className={cn(
      'border-b px-4 py-2.5 flex items-center gap-3 text-sm',
      isStale    && 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300',
      isFallback && 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50 text-orange-800 dark:text-orange-300'
    )}>
      {isStale    && <Clock   size={15} className="shrink-0 text-amber-500 dark:text-amber-400" />}
      {isFallback && <WifiOff size={15} className="shrink-0 text-orange-500 dark:text-orange-400" />}

      <p className="flex-1">
        {isStale && (
          <>
            <span className="font-semibold">Using saved rates</span>
            {' '}— live exchange rates could not be fetched. Cached rates may be up to 24 hours old.
          </>
        )}
        {isFallback && (
          <>
            <span className="font-semibold">Offline mode</span>
            {' '}— no network or cached rates available. Using approximate built-in rates.
            You can override the rate manually when adding an expense.
          </>
        )}
      </p>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}
