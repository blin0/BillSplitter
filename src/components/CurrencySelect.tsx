import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '../lib/cn';

export interface CurrencyOption {
  code: string;
  label: string;
  symbol?: string;
  region?: string;
}

interface Props {
  options: CurrencyOption[];
  value: string;
  onChange: (code: string) => void;
  /** Extra classes applied to the root wrapper (e.g. width) */
  className?: string;
  /** Max-height of the scrollable list. Default: max-h-56 (fits inside forms) */
  listMaxHeight?: string;
  /** Whether to anchor the panel to the right edge (header) or left (inline) */
  alignRight?: boolean;
  /** Called whenever the open state changes — lets a parent track it */
  onOpenChange?: (open: boolean) => void;
  /**
   * Embedded mode: the trigger has no border/bg so the parent container
   * provides the chrome. The wrapper also drops `position:relative` so the
   * absolute panel is anchored to the nearest positioned ancestor (the
   * compound container in ExpenseForm).
   */
  embedded?: boolean;
}

export default function CurrencySelect({
  options,
  value,
  onChange,
  className,
  listMaxHeight = 'max-h-56',
  alignRight = false,
  onOpenChange,
  embedded = false,
}: Props) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const containerRef      = useRef<HTMLDivElement>(null);
  const searchRef         = useRef<HTMLInputElement>(null);
  const listboxId         = useId();

  function updateOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  // Derive unique region order from options (preserves first-seen ordering)
  const regions: string[] = [];
  for (const o of options) {
    if (o.region && !regions.includes(o.region)) regions.push(o.region);
  }
  const hasRegions = regions.length > 0;

  // Close on outside click / Escape
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

  // Auto-focus search when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  function select(code: string) {
    onChange(code);
    updateOpen(false);
  }

  // Filter
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? options.filter(o =>
        o.code.toLowerCase().includes(needle) ||
        o.label.toLowerCase().includes(needle) ||
        (o.symbol ?? '').toLowerCase().includes(needle)
      )
    : options;

  // Group
  const grouped: Record<string, CurrencyOption[]> = {};
  for (const region of regions) grouped[region] = [];
  for (const o of filtered) {
    const r = o.region ?? '';
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(o);
  }

  const current = options.find(o => o.code === value);

  function renderOption(o: CurrencyOption) {
    const isSelected = o.code === value;
    return (
      <button
        key={o.code}
        role="option"
        aria-selected={isSelected}
        type="button"
        onClick={() => select(o.code)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
          isSelected
            ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
        )}
      >
        <span className={cn(
          'w-8 text-center text-xs font-bold shrink-0',
          isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500'
        )}>
          {o.symbol ?? o.code.slice(0, 3)}
        </span>
        <span className="flex-1 min-w-0 truncate">
          <span className="font-semibold">{o.code}</span>
          <span className="text-slate-400 dark:text-slate-500 font-normal"> — {o.label}</span>
        </span>
        {isSelected && <Check size={13} className="text-violet-500 dark:text-violet-400 shrink-0" />}
      </button>
    );
  }

  return (
    /* When embedded, omit `relative` so the panel anchors to the compound container */
    <div
      className={cn(
        !embedded && (open ? 'relative z-[51]' : 'relative z-auto'),
        embedded && (open ? 'z-auto' : 'z-auto'),
        className
      )}
      ref={containerRef}
    >
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => updateOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          'flex items-center gap-1.5 pl-2.5 pr-2 py-2 text-sm font-medium w-full',
          /* Standard (non-embedded) styles */
          !embedded && [
            'border relative',
            open ? 'rounded-t-lg rounded-b-none border-b-0 pb-[9px]' : 'rounded-lg',
            'border-gray-200 dark:border-slate-700',
            'bg-white dark:bg-slate-800',
            'hover:bg-gray-50 dark:hover:bg-slate-700',
            'focus-visible:ring-2 focus-visible:ring-violet-400 dark:focus-visible:ring-offset-slate-900',
          ],
          /* Embedded — no own border/bg; parent container provides chrome */
          embedded && [
            'rounded-lg bg-transparent',
            'hover:bg-slate-50 dark:hover:bg-slate-700/40',
          ],
          'text-gray-700 dark:text-slate-200',
          'focus:outline-none',
          'transition-all active:scale-95'
        )}
      >
        {current?.symbol && (
          <span className="font-semibold text-violet-600 dark:text-violet-400 shrink-0">
            {current.symbol}
          </span>
        )}
        <span className="flex-1 text-left truncate">{value}</span>
        <ChevronDown
          size={13}
          className={cn(
            'text-gray-400 dark:text-slate-500 transition-transform shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Select currency"
          className={cn(
            'absolute top-full mt-[-1px] z-[50]',
            alignRight ? 'right-0' : 'left-0',
            embedded ? 'w-full' : 'w-64',
            'rounded-b-xl rounded-t-none border-x border-b shadow-2xl',
            'bg-white dark:bg-slate-800',
            'border-gray-200 dark:border-slate-700',
            'flex flex-col overflow-hidden'
          )}
        >
          {/* Search bar */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/80">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/60">
              <Search size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && updateOpen(false)}
                placeholder="Search currency..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Scrollable list — fixed max-height keeps it inside the form card */}
          <div className={cn('overflow-y-auto py-1 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent] dark:[scrollbar-color:theme(colors.slate.600)_transparent]', listMaxHeight)}>
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">
                No match for "{query}"
              </p>
            ) : hasRegions ? (
              regions.map(region => {
                const items = grouped[region] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={region}>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {region}
                    </p>
                    {items.map(renderOption)}
                  </div>
                );
              })
            ) : (
              filtered.map(renderOption)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
