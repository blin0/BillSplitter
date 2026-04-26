import { useState, useRef, useEffect, useId, useMemo } from 'react';
import { ChevronDown, Check, User, Star, Bookmark } from 'lucide-react';
import type { Participant } from '../types';
import { cn } from '../lib/cn';

// ─── Prefs storage ────────────────────────────────────────────────────────────

interface PaidByPrefs {
  defaultId: string | null;
  favorites: string[];
}

function loadPrefs(key: string): PaidByPrefs {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? { defaultId: null, favorites: [] };
  } catch { return { defaultId: null, favorites: [] }; }
}

function savePrefs(key: string, prefs: PaidByPrefs) {
  try { localStorage.setItem(key, JSON.stringify(prefs)); } catch (_) {}
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  participants:  Participant[];
  value:         string;
  onChange:      (id: string) => void;
  placeholder?:  string;
  className?:    string;
  onOpenChange?: (open: boolean) => void;
  embedded?:     boolean;
  /**
   * When provided, favorite/default buttons appear in the dropdown and
   * preferences are saved to localStorage under `bsp_paidby_${storageKey}`.
   */
  storageKey?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ParticipantSelect({
  participants,
  value,
  onChange,
  placeholder = 'Paid by…',
  className,
  onOpenChange,
  embedded = false,
  storageKey,
}: Props) {
  const lsKey = storageKey ? `bsp_paidby_${storageKey}` : null;

  const [open,  setOpen ] = useState(false);
  const [prefs, setPrefs] = useState<PaidByPrefs>(() =>
    lsKey ? loadPrefs(lsKey) : { defaultId: null, favorites: [] },
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId    = useId();

  function updatePrefs(next: PaidByPrefs) {
    setPrefs(next);
    if (lsKey) savePrefs(lsKey, next);
  }

  function updateOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(id: string) {
    onChange(id);
    // If a default is already pinned and the user explicitly picks something different,
    // update the default to their new choice — no two-step unpin→re-pin needed.
    if (lsKey && prefs.defaultId !== null && prefs.defaultId !== id) {
      updatePrefs({ ...prefs, defaultId: id });
    }
    updateOpen(false);
  }

  function toggleFavorite(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const favorites = prefs.favorites.includes(id)
      ? prefs.favorites.filter(f => f !== id)
      : [...prefs.favorites, id];
    updatePrefs({ ...prefs, favorites });
  }

  function toggleDefault(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const newDefault = prefs.defaultId === id ? null : id;
    updatePrefs({ ...prefs, defaultId: newDefault });
    // If setting a new default and no participant is selected yet, apply it immediately
    if (newDefault && !value) {
      onChange(newDefault);
    }
  }

  // Favorites listed first, separated from the rest
  const sorted = useMemo(() => {
    const favSet = new Set(prefs.favorites);
    return [
      ...participants.filter(p => favSet.has(p.id)),
      ...participants.filter(p => !favSet.has(p.id)),
    ];
  }, [participants, prefs.favorites]);

  const current    = participants.find(p => p.id === value);
  const favCount   = prefs.favorites.length;
  const isDefault  = (id: string) => prefs.defaultId === id;
  const isFav      = (id: string) => prefs.favorites.includes(id);

  return (
    <div className={cn(!embedded && 'relative', className)} ref={containerRef}>

      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => updateOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 text-sm',
          !embedded && [
            'border',
            open ? 'rounded-t-lg rounded-b-none' : 'rounded-lg',
            'border-gray-200 dark:border-slate-700',
            'bg-white dark:bg-slate-800',
            'focus-visible:ring-2 focus-visible:ring-violet-400 dark:focus-visible:ring-offset-slate-900',
          ],
          embedded && ['rounded-lg bg-transparent', 'hover:bg-slate-50 dark:hover:bg-slate-700/40'],
          'focus:outline-none transition-all active:scale-95',
          current ? 'text-gray-900 dark:text-slate-100 font-medium' : 'text-gray-400 dark:text-slate-500',
        )}
      >
        <span className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
          current
            ? 'bg-violet-200 dark:bg-violet-800/60 text-violet-700 dark:text-violet-300'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500',
        )}>
          {current ? current.name[0].toUpperCase() : <User size={11} />}
        </span>

        <span className="flex-1 text-left truncate">
          {current ? current.name : placeholder}
        </span>

        {/* Show bookmark indicator when selected participant is the default */}
        {current && isDefault(current.id) && (
          <Bookmark size={10} className="text-violet-400 dark:text-violet-500 shrink-0 fill-current" />
        )}

        <ChevronDown
          size={14}
          className={cn('text-gray-400 dark:text-slate-500 transition-transform shrink-0', open && 'rotate-180')}
        />
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Select who paid"
          className={cn(
            'absolute left-0 top-full mt-[-1px] z-50',
            'w-full rounded-b-xl rounded-t-none shadow-2xl overflow-hidden',
            embedded ? 'border-x border-b' : 'border',
            'bg-white dark:bg-slate-900',
            'border-slate-200 dark:border-slate-800',
          )}
        >
          {participants.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">
              No members added yet.
            </p>
          ) : (
            <div className="py-1 max-h-56 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent] dark:[scrollbar-color:theme(colors.slate.600)_transparent]">
              {favCount > 0 && (
                <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Favorites
                </p>
              )}
              {sorted.map((p, idx) => {
                const isSelected = p.id === value;
                const fav        = isFav(p.id);
                const def        = isDefault(p.id);
                // Section divider between favorites and the rest
                const showSectionDivider = idx === favCount && favCount > 0 && sorted.length > favCount;

                return (
                  <div key={p.id}>
                    {showSectionDivider && (
                      <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 mt-1">
                        Others
                      </p>
                    )}
                    <div
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => select(p.id)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') updateOpen(false);
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.id); }
                        if (e.key === 'ArrowDown') (e.currentTarget.nextElementSibling?.querySelector('[tabindex]') as HTMLElement | null)?.focus();
                        if (e.key === 'ArrowUp')   (e.currentTarget.previousElementSibling?.querySelector('[tabindex]') as HTMLElement | null)?.focus();
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors focus:outline-none cursor-pointer',
                        isSelected
                          ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/40',
                      )}
                    >
                      {/* Avatar */}
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        isSelected
                          ? 'bg-violet-200 dark:bg-violet-800/60 text-violet-700 dark:text-violet-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
                      )}>
                        {p.name[0].toUpperCase()}
                      </span>

                      <span className="flex-1 font-medium truncate">{p.name}</span>

                      {/* Favorite + Default toggle buttons */}
                      {lsKey && (
                        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          {/* Star — favorite */}
                          <div className="relative group/tip">
                            <button
                              type="button"
                              onClick={e => toggleFavorite(p.id, e)}
                              aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
                              className={cn(
                                'p-1 rounded transition-colors',
                                fav
                                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                              )}
                            >
                              <Star size={12} fill={fav ? 'currentColor' : 'none'} />
                            </button>
                            <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded text-[10px] whitespace-nowrap bg-gray-800 dark:bg-slate-700 text-white opacity-0 group-hover/tip:opacity-100 transition-opacity z-[9999]">
                              {fav ? 'Remove from favorites' : 'Favorite — sorts to top'}
                            </span>
                          </div>
                          {/* Bookmark — default payer */}
                          <div className="relative group/tip2">
                            <button
                              type="button"
                              onClick={e => toggleDefault(p.id, e)}
                              aria-label={def ? 'Remove as default payer' : 'Set as default payer'}
                              className={cn(
                                'p-1 rounded transition-colors',
                                def
                                  ? 'text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                              )}
                            >
                              <Bookmark size={12} fill={def ? 'currentColor' : 'none'} />
                            </button>
                            <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded text-[10px] whitespace-nowrap bg-gray-800 dark:bg-slate-700 text-white opacity-0 group-hover/tip2:opacity-100 transition-opacity z-[9999]">
                              {def ? 'Remove default' : 'Set as default payer'}
                            </span>
                          </div>
                        </div>
                      )}

                      {isSelected && (
                        <Check size={13} className="text-violet-500 dark:text-violet-400 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
