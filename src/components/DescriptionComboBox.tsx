import { useState, useRef, useEffect, type RefObject, type KeyboardEvent } from 'react';
import {
  Utensils, Coffee, Wine,
  Home, Zap, Globe,
  Film, Ticket, Plane,
  Fuel, Car,
  ShoppingBasket, Gift, Package,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/cn';

// ─── Category data ────────────────────────────────────────────────────────────

interface Suggestion {
  label: string;
  icon: LucideIcon;
  category: string;
}

const SUGGESTIONS: Suggestion[] = [
  // Food & Drink
  { label: 'Dinner',    icon: Utensils,      category: 'Food & Drink' },
  { label: 'Lunch',     icon: Utensils,      category: 'Food & Drink' },
  { label: 'Coffee',    icon: Coffee,        category: 'Food & Drink' },
  { label: 'Drinks',    icon: Wine,          category: 'Food & Drink' },
  // Living
  { label: 'Rent',      icon: Home,          category: 'Living'       },
  { label: 'Utilities', icon: Zap,           category: 'Living'       },
  { label: 'Internet',  icon: Globe,         category: 'Living'       },
  // Fun
  { label: 'Movie',     icon: Film,          category: 'Fun'          },
  { label: 'Concert',   icon: Ticket,        category: 'Fun'          },
  { label: 'Travel',    icon: Plane,         category: 'Fun'          },
  // Transport
  { label: 'Gas',       icon: Fuel,          category: 'Transport'    },
  { label: 'Taxi',      icon: Car,           category: 'Transport'    },
  // Essentials
  { label: 'Groceries', icon: ShoppingBasket, category: 'Essentials'  },
  { label: 'Gift',      icon: Gift,          category: 'Essentials'   },
  { label: 'Misc',      icon: Package,       category: 'Essentials'   },
];

const CATEGORIES = ['Food & Drink', 'Living', 'Fun', 'Transport', 'Essentials'];

const QUICK_CHIPS: Suggestion[] = [
  SUGGESTIONS.find(s => s.label === 'Dinner')!,
  SUGGESTIONS.find(s => s.label === 'Coffee')!,
  SUGGESTIONS.find(s => s.label === 'Groceries')!,
  SUGGESTIONS.find(s => s.label === 'Misc')!,
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** After a chip/suggestion is selected, focus jumps here */
  nextRef?: RefObject<HTMLElement | null>;
  onCommit?: () => void;   // called on Enter to submit the form
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DescriptionComboBox({ value, onChange, nextRef, onCommit }: Props) {
  const [open, setOpen]   = useState(false);
  const containerRef      = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);

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

  // Filter suggestions by the typed query
  const needle = value.trim().toLowerCase();
  const filtered = needle
    ? SUGGESTIONS.filter(s => s.label.toLowerCase().includes(needle))
    : SUGGESTIONS;

  function select(label: string) {
    onChange(label);
    setOpen(false);
    // Shift focus to the amount field so the user can keep typing without lifting hands
    setTimeout(() => (nextRef?.current as HTMLInputElement | null)?.focus(), 0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); onCommit?.(); }
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Move focus into list
      (containerRef.current?.querySelector('[data-suggestion]') as HTMLElement | null)?.focus();
    }
  }

  function handleOptionKeyDown(e: KeyboardEvent<HTMLButtonElement>, label: string) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(label); }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.focus(); }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling as HTMLElement | null;
      prev ? prev.focus() : inputRef.current?.focus();
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full max-w-full" ref={containerRef}>
      {/* ── Input ── */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Description (e.g. Dinner)"
          aria-autocomplete="list"
          aria-expanded={open}
          autoComplete="off"
          className={cn(
            'w-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 text-sm px-3 py-2 pr-8 transition-colors focus:outline-none',
            'hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/80',
            'focus:border-violet-500 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:focus:ring-violet-500/20',
            open ? 'rounded-t-lg rounded-b-none' : 'rounded-lg'
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
      <div className="flex gap-2 flex-wrap mt-2">
        {QUICK_CHIPS.map(chip => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => select(chip.label)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-transparent text-xs text-slate-600 dark:text-slate-400 hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer"
            >
              <Icon size={12} strokeWidth={1.5} />
              {chip.label}
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
            'animate-[comboFadeIn_150ms_ease_forwards]'
          )}
        >
          <div className="overflow-y-auto max-h-52 py-1 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent] dark:[scrollbar-color:theme(colors.slate.600)_transparent]">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">
                No match — press Enter to use "{value}"
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
                      const Icon = s.icon;
                      const isActive = value === s.label;
                      return (
                        <button
                          key={s.label}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          data-suggestion
                          onClick={() => select(s.label)}
                          onKeyDown={e => handleOptionKeyDown(e, s.label)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors focus:outline-none',
                            isActive
                              ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-300 focus-visible:bg-violet-50 dark:focus-visible:bg-violet-950/30'
                          )}
                        >
                          <Icon size={16} strokeWidth={1.5} className="shrink-0 text-slate-400 dark:text-slate-500" />
                          <span className="font-medium">{s.label}</span>
                        </button>
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
