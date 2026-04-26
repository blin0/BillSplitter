import { useState, useRef, useEffect } from 'react';
import { MessageCircleQuestion, X, Send, CheckCircle2, Loader2, Bug, Lightbulb, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { submitFeedback } from '../lib/db';
import { useAuth } from '../context/AuthContext';

type Category = 'bug' | 'feature' | 'general';

const CATEGORY_VALUES: { value: Category; icon: React.ReactNode }[] = [
  { value: 'bug',     icon: <Bug           size={16} /> },
  { value: 'feature', icon: <Lightbulb     size={16} /> },
  { value: 'general', icon: <MessageSquare size={16} /> },
];

export default function FeedbackButton() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [open,     setOpen    ] = useState(false);
  const [category, setCategory] = useState<Category>('general');
  const [message,  setMessage ] = useState('');
  const [email,    setEmail   ] = useState(user?.email ?? '');
  const [status,   setStatus  ] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-fill email when user signs in
  useEffect(() => {
    setEmail(user?.email ?? '');
  }, [user?.email]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Auto-focus textarea on open
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => textareaRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus('loading');

    const { error } = await submitFeedback({
      userId:   user?.id ?? null,
      email:    email.trim() || null,
      category,
      message:  message.trim(),
    });

    if (error) {
      setStatus('error');
    } else {
      setStatus('done');
      setTimeout(() => {
        setOpen(false);
        setStatus('idle');
        setMessage('');
        setCategory('general');
      }, 1800);
    }
  }

  return (
    <div ref={panelRef} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">

      {/* Popover panel */}
      {open && (
        <div className="w-80 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-black/30 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion size={15} className="text-violet-500 dark:text-violet-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('feedback.title')}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </button>
          </div>

          {status === 'done' ? (
            <div className="flex flex-col items-center gap-3 py-8 px-4">
              <CheckCircle2 size={32} className="text-green-500" />
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200 text-center">
                {t('feedback.thanks')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">

              {/* Category */}
              <div className="flex gap-1.5">
                {CATEGORY_VALUES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-[10px] font-medium transition-all ${
                      category === c.value
                        ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                        : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-violet-300 dark:hover:border-violet-700'
                    }`}
                  >
                    <span className={category === c.value ? 'text-violet-500 dark:text-violet-400' : 'text-gray-400 dark:text-slate-500'}>
                      {c.icon}
                    </span>
                    <span className="leading-tight text-center">{t(`feedback.${c.value}`)}</span>
                  </button>
                ))}
              </div>

              {/* Message */}
              <div>
                <textarea
                  ref={textareaRef}
                  name="feedback-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('feedback.placeholder')}
                  rows={4}
                  required
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500 focus:border-transparent transition-colors"
                />
              </div>

              {/* Email (optional if not signed in) */}
              {!user && (
                <div>
                  <input
                    type="email"
                    name="feedback-email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('feedback.emailPlaceholder')}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500 focus:border-transparent transition-colors"
                  />
                </div>
              )}

              {status === 'error' && (
                <p className="text-xs text-red-500 dark:text-red-400">
                  {t('feedback.error')}
                </p>
              )}

              <button
                type="submit"
                disabled={!message.trim() || status === 'loading'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {status === 'loading'
                  ? <><Loader2 size={14} className="animate-spin" /> {t('feedback.sending')}</>
                  : <><Send size={14} /> {t('feedback.submit')}</>
                }
              </button>
            </form>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => { setOpen(o => !o); setStatus('idle'); }}
        className="w-11 h-11 rounded-full flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40 transition-all hover:scale-105 active:scale-95"
        aria-label={t('feedback.title')}
        title={t('feedback.title')}
      >
        {open
          ? <X size={18} />
          : <MessageCircleQuestion size={18} />
        }
      </button>
    </div>
  );
}
