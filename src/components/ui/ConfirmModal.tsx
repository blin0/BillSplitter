import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export interface ConfirmModalProps {
  /** Modal title shown in the header */
  title: string;
  /** Body text — can include line breaks via \n */
  message: string;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Visual variant of the confirm button */
  variant?: 'danger' | 'warning';
  /** Called when the user clicks the confirm button */
  onConfirm: () => void;
  /** Called when the user dismisses without confirming */
  onCancel: () => void;
  /** Optional error message to display inside the modal */
  error?: string | null;
  /** Disable the confirm button while an async action is in-flight */
  loading?: boolean;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  onConfirm,
  onCancel,
  error,
  loading = false,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Trap focus on mount; restore on unmount
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => { prev?.focus(); };
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isDanger  = variant === 'danger';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Panel */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">

        {/* Header */}
        <div className={cn(
          'flex items-start gap-3 px-5 pt-5 pb-4',
          isDanger
            ? 'border-b border-red-100 dark:border-red-900/40'
            : 'border-b border-amber-100 dark:border-amber-900/40',
        )}>
          <div className={cn(
            'p-2 rounded-xl shrink-0',
            isDanger
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-amber-100 dark:bg-amber-900/30',
          )}>
            <AlertTriangle size={18} className={isDanger
              ? 'text-red-500 dark:text-red-400'
              : 'text-amber-500 dark:text-amber-400'
            } />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 leading-tight">
              {title}
            </h2>
          </div>

          <button
            onClick={onCancel}
            className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {message.split('\n').map((line, i) => (
            <p key={i} className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
              {line}
            </p>
          ))}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium text-white transition-all',
              'hover:brightness-110 hover:scale-105 active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
              isDanger
                ? 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
            )}
          >
            {loading ? t('common.pleaseWait') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
