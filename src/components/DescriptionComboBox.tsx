import { useState, useRef, useEffect, useMemo, type RefObject, type KeyboardEvent } from 'react';
import {
  Utensils, Coffee, Wine,
  Home, Zap, Globe,
  Film, Ticket, Plane,
  Fuel, Car,
  ShoppingBasket, Gift, Package,
  ChevronDown, Star, Bookmark,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/cn';

// ─── Category data ────────────────────────────────────────────────────────────

interface Suggestion {
  label:    string;
  icon:     LucideIcon;
  category: string;
}

const SUGGESTIONS: Suggestion[] = [
  { label: 'Dinner',    icon: Utensils,       category: 'Food & Drink' },
  { label: 'Lunch',     icon: Utensils,       category: 'Food & Drink' },
  { label: 'Coffee',    icon: Coffee,         category: 'Food & Drink' },
  { label: 'Drinks',    icon: Wine,           category: 'Food & Drink' },
  { label: 'Rent',      icon: Home,           category: 'Living'       },
  { label: 'Utilities', icon: Zap,            category: 'Living'       },
  { label: 'Internet',  icon: Globe,          category: 'Living'       },
  { label: 'Movie',     icon: Film,           category: 'Fun'          },
  { label: 'Concert',   icon: Ticket,         category: 'Fun'          },
  { label: 'Travel',    icon: Plane,          category: 'Fun'          },
  { label: 'Gas',       icon: Fuel,           category: 'Transport'    },
  { label: 'Taxi',      icon: Car,            category: 'Transport'    },
  { label: 'Groceries', icon: ShoppingBasket, category: 'Essentials'   },
  { label: 'Gift',      icon: Gift,           category: 'Essentials'   },
  { label: 'Misc',      icon: Package,        category: 'Essentials'   },
];

const CATEGORIES = ['Food & Drink', 'Living', 'Fun', 'Transport', 'Essentials'];

const DEFAULT_CHIPS: Suggestion[] = [
  SUGGESTIONS.find(s => s.label === 'Dinner')!,
  SUGGESTIONS.find(s => s.label === 'Coffee')!,
  SUGGESTIONS.find(s => s.label === 'Groceries')!,
  SUGGESTIONS.find(s => s.label === 'Misc')!,
];

// ─── Prefs storage ────────────────────────────────────────────────────────────

interface DescPrefs {
  defaultLabel: string | null;
  favorites:    string[];
}

function loadDescPrefs(key: string): DescPrefs {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? { defaultLabel: null, favorites: [] };
  } catch { return { defaultLabel: null, favorites: [] }; }
}

function saveDescPrefs(key: string, prefs: DescPrefs) {
  try { localStorage.setItem(key, JSON.stringify(prefs)); } catch (_) {}
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  value:      string;
  onChange:   (v: string) => void;
  nextRef?:   RefObject<HTMLElement | null>;
  onCommit?:  () => void;
  /**
   * When provided, favorite/default buttons appear in the dropdown and
   * preferences are saved to localStorage under `bsp_descs_${storageKey}`.
   * Favorites replace the default quick chips below the input.
   */
  storageKey?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DescriptionComboBox({ value, onChange, nextRef, onCommit, storageKey }: Props) {
  const lsKey = storageKey ? `bsp_descs_${storageKey}` : null;

  const [open,  setOpen ] = useState(false);
  const [prefs, setPrefs] = useState<DescPrefs>(() =>
    lsKey ? loadDescPrefs(lsKey) : { defaultLabel: null, favorites: [] },
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  function updatePrefs(next: DescPrefs) {
    setPrefs(next);
    if (lsKey) saveDescPrefs(lsKey, next);
  }

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Reload prefs from storage when storageKey changes (e.g. group switch)
  useEffect(() => {
    if (!lsKey) { setPrefs({ defaultLabel: null, favorites: [] }); return; }
    setPrefs(loadDescPrefs(lsKey));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsKey]);

  const needle   = value.trim().toLowerCase();
  const filtered = needle
    ? SUGGESTIONS.filter(s => s.label.toLowerCase().includes(needle))
    : SUGGESTIONS;

  // Quick chips: show favorites (up to 4) when any are set, else default chips
  const quickChips = useMemo<Suggestion[]>(() => {
    if (!lsKey || prefs.favorites.length === 0) return DEFAULT_CHIPS;
    return prefs.favorites.slice(0, 4).map(label => {
      const found = SUGGESTIONS.find(s => s.label === label);
      return found ?? { label, icon: Package, category: 'Custom' };
    });
  }, [prefs.favorites, lsKey]);

  function select(label: string) {
    onChange(label);
    // If a default is already pinned and the user picks something different,
    // auto-switch the default — no two-step unset→re-set needed.
    if (lsKey && prefs.defaultLabel !== null && prefs.defaultLabel !== label) {
      updatePrefs({ ...prefs, defaultLabel: label });
    }
    setOpen(false);
    setTimeout(() => (nextRef?.current as HTMLInputElement | null)?.focus(), 0);
  }

  function toggleFavorite(label: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const favorites = prefs.favorites.includes(label)
      ? prefs.favorites.filter(f => f !== label)
      : [label, ...prefs.favorites].slice(0, 5); // newest first, max 5
    updatePrefs({ ...prefs, favorites });
  }

  function toggleDefault(label: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const newDefault = prefs.defaultLabel === label ? null : label;
    updatePrefs({ ...prefs, defaultLabel: newDefault });
    // If setting a new default and the field is currently empty, apply it immediately
    if (newDefault && !value) {
      onChange(newDefault);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')     { e.preventDefault(); onCommit?.(); }
    if (e.key === 'Escape')    setOpen(false);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (containerRef.current?.querySelector('[data-suggestion]') as HTMLElement | null)?.focus();
    }
  }

  function handleOptionKeyDown(e: KeyboardEvent<HTMLButtonElement>, label: string) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(label); }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.focus(); }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (e.currentTarget.parentElement?.nextElementSibling?.querySelector('[data-suggestion]') as HTMLElement | null)?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = e.currentTarget.parentElement?.previousElementSibling?.querySelector('[data-suggestion]') as HTMLElement | null;
      prev ? prev.focus() : inputRef.current?.focus();
    }
  }

  return (
    <div className="relative w-full max-w-full" ref={containerRef}>

      {/* ── Input ── */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name="expense-description"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Description (e.g. Dinner)"
          aria-autocomplete="list"
          aria-expanded={open}
          autoComplete="off"
          className={cn(
            'w-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800',
            'text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500',
            'text-sm px-3 py-2 pr-8 transition-colors focus:outline-none',
            'hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/80',
            'focus:border-violet-500 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20',
            open ? 'rounded-t-lg rounded-b-none' : 'rounded-lg',
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setOpen(v => !v); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
          aria-label="Show suggestions"
        >
          <ChevronDown
            size={15}
            strokeWidth={1.5}
            className={cn('transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </div>

      {/* ── Quick-tap chips ── */}
      <div className="flex gap-1.5 flex-wrap mt-2">
        {quickChips.map(chip => {
          const Icon = chip.icon;
          const isDefault = prefs.defaultLabel === chip.label;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => select(chip.label)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors cursor-pointer',
                isDefault
                  ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400'
                  : 'border-slate-200 dark:border-slate-700 bg-transparent text-slate-600 dark:text-slate-400 hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400',
              )}
            >
              <Icon size={12} strokeWidth={1.5} />
              {chip.label}
              {isDefault && <Bookmark size={9} className="fill-current" />}
            </button>
          );
        })}
      </div>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute left-0 top-full mt-[-1px] z-50',
            'w-full rounded-b-xl rounded-t-none border shadow-xl',
            'bg-white dark:bg-slate-900',
            'border-slate-200 dark:border-slate-800',
            'flex flex-col overflow-hidden',
            'animate-[comboFadeIn_150ms_ease_forwards]',
          )}
        >
          <div className="overflow-y-auto max-h-52 py-1 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent] dark:[scrollbar-color:theme(colors.slate.600)_transparent]">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">
                No match — press Enter to use &quot;{value}&quot;
              </p>
            ) : (
              CATEGORIES.map(cat => {
                const items = filtered.filter(s => s.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {cat}
                    </p>
                    {items.map(s => {
                      const Icon     = s.icon;
                      const isActive = value === s.label;
                      const isFav    = prefs.favorites.includes(s.label);
                      const isDef    = prefs.defaultLabel === s.label;
                      return (
                        <div key={s.label} className="flex items-center">
                          <button
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            data-suggestion
                            onClick={() => select(s.label)}
                            onKeyDown={e => handleOptionKeyDown(e, s.label)}
                            className={cn(
                              'flex-1 flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors focus:outline-none',
                              isActive
                                ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-300 focus-visible:bg-violet-50 dark:focus-visible:bg-violet-950/30',
                            )}
                          >
                            <Icon size={16} strokeWidth={1.5} className="shrink-0 text-slate-400 dark:text-slate-500" />
                            <span className="font-medium flex-1">{s.label}</span>
                          </button>

                          {/* Favorite + Default buttons */}
                          {lsKey && (
                            <div className="flex items-center gap-0.5 pr-2 shrink-0" onClick={e => e.stopPropagation()}>
                              {/* Star — favorite */}
                              <div className="relative group/tip">
                                <button
                                  type="button"
                                  onClick={e => toggleFavorite(s.label, e)}
                                  aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                  className={cn(
                                    'p-1 rounded transition-colors',
                                    isFav
                                      ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                                      : 'text-slate-300 dark:text-slate-600 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                                  )}
                                >
                                  <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
                                </button>
                                <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded text-[10px] whitespace-nowrap bg-gray-800 dark:bg-slate-700 text-white opacity-0 group-hover/tip:opacity-100 transition-opacity z-[9999]">
                                  {isFav ? 'Remove from favorites' : 'Favorite — shows as quick chip'}
                                </span>
                              </div>
                              {/* Bookmark — default description */}
                              <div className="relative group/tip2">
                                <button
                                  type="button"
                                  onClick={e => toggleDefault(s.label, e)}
                                  aria-label={isDef ? 'Remove as default description' : 'Set as default description'}
                                  className={cn(
                                    'p-1 rounded transition-colors',
                                    isDef
                                      ? 'text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30'
                                      : 'text-slate-300 dark:text-slate-600 hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                                  )}
                                >
                                  <Bookmark size={12} fill={isDef ? 'currentColor' : 'none'} />
                                </button>
                                <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded text-[10px] whitespace-nowrap bg-gray-800 dark:bg-slate-700 text-white opacity-0 group-hover/tip2:opacity-100 transition-opacity z-[9999]">
                                  {isDef ? 'Remove default' : 'Set as default description'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
