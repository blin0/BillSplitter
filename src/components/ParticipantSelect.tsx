import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, User } from 'lucide-react';
import type { Participant } from '../types';
import { cn } from '../lib/cn';

interface Props {
  participants: Participant[];
  value: string;           // participant id, or '' for unset
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  /** Called whenever the open state changes */
  onOpenChange?: (open: boolean) => void;
  /**
   * Embedded mode: no own border/bg — the parent super-container provides
   * the chrome. The wrapper drops `position:relative` so the absolute panel
   * anchors to the nearest positioned ancestor (the super-container).
   */
  embedded?: boolean;
}

export default function ParticipantSelect({
  participants,
  value,
  onChange,
  placeholder = 'Paid by…',
  className,
  onOpenChange,
  embedded = false,
}: Props) {
  const [open, setOpen]   = useState(false);
  const containerRef      = useRef<HTMLDivElement>(null);
  const listboxId         = useId();

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
    updateOpen(false);
  }

  const current = participants.find(p => p.id === value);

  return (
    /* When embedded, omit `relative` so the panel anchors to the super-container */
    <div
      className={cn(
        !embedded && 'relative',
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
          'flex items-center gap-2 w-full px-3 py-2 text-sm',
          /* Standard styles */
          !embedded && [
            'border',
            open ? 'rounded-t-lg rounded-b-none' : 'rounded-lg',
            'border-gray-200 dark:border-slate-700',
            'bg-white dark:bg-slate-800',
            'focus-visible:ring-2 focus-visible:ring-violet-400 dark:focus-visible:ring-offset-slate-900',
          ],
          /* Embedded — transparent, no border */
          embedded && [
            'rounded-lg bg-transparent',
            'hover:bg-slate-50 dark:hover:bg-slate-700/40',
          ],
          'focus:outline-none transition-all active:scale-95',
          current
            ? 'text-gray-900 dark:text-slate-100 font-medium'
            : 'text-gray-400 dark:text-slate-500'
        )}
      >
        {/* Avatar initial or User icon */}
        <span className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
          current
            ? 'bg-violet-200 dark:bg-violet-800/60 text-violet-700 dark:text-violet-300'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
        )}>
          {current ? current.name[0].toUpperCase() : <User size={11} />}
        </span>

        <span className="flex-1 text-left truncate">
          {current ? current.name : placeholder}
        </span>

        <ChevronDown
          size={14}
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
          aria-label="Select who paid"
          className={cn(
            'absolute left-0 top-full mt-[-1px] z-50',
            'w-full rounded-b-xl rounded-t-none shadow-2xl overflow-hidden',
            /* Seamless seam: no top border */
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
            <div className="py-1 max-h-52 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent] dark:[scrollbar-color:theme(colors.slate.600)_transparent]">
              {participants.map(p => {
                const isSelected = p.id === value;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(p.id)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') updateOpen(false);
                      if (e.key === 'ArrowDown') (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
                      if (e.key === 'ArrowUp')   (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors focus:outline-none',
                      isSelected
                        ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/40 focus-visible:bg-violet-50 dark:focus-visible:bg-violet-900/40'
                    )}
                  >
                    {/* Avatar */}
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      isSelected
                        ? 'bg-violet-200 dark:bg-violet-800/60 text-violet-700 dark:text-violet-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    )}>
                      {p.name[0].toUpperCase()}
                    </span>

                    <span className="flex-1 font-medium truncate">{p.name}</span>

                    {isSelected && (
                      <Check size={13} className="text-violet-500 dark:text-violet-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
