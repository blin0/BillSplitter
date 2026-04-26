import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'billsplitter_onboarded_v1';

// ─── Step definitions ─────────────────────────────────────────────────────────

interface TourStep {
  selector:  string;
  title:     string;
  body:      string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

const PAD       = 10;   // px padding around highlighted element
const TOOLTIP_W = 288;  // px max-width of tooltip bubble (clamped to 90vw)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function queryRect(selector: string): DOMRect | null {
  try {
    const el = document.querySelector(selector);
    return el ? el.getBoundingClientRect() : null;
  } catch {
    return null;
  }
}

// ─── Hook — call this in AppInner to gate visibility ─────────────────────────

export function useOnboardingTour(ready: boolean) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ready) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch { /* private-browsing */ }
  }, [ready]);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  }

  return { show, dismiss };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onDone:          () => void;
  showSignupStep?: boolean;
  onSignUp?:       () => void;
}

export default function OnboardingTour({ onDone, showSignupStep, onSignUp }: Props) {
  const { t } = useTranslation();
  const [step,       setStep      ] = useState(0);
  const [rect,       setRect      ] = useState<DOMRect | null>(null);
  const [visible,    setVisible   ] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const STEPS: TourStep[] = [
    {
      selector:  '[data-tour="members"]',
      title:     t('tour.step1Title'),
      body:      t('tour.step1Body'),
      placement: 'bottom',
    },
    {
      selector:  '[data-tour="add-expense"]',
      title:     t('tour.step2Title'),
      body:      t('tour.step2Body'),
      placement: 'top',
    },
    {
      selector:  '[data-tour="add-expense"]',
      title:     t('tour.step3Title'),
      body:      t('tour.step3Body'),
      placement: 'top',
    },
    {
      selector:  '[data-tour="settlement"]',
      title:     t('tour.step4Title'),
      body:      t('tour.step4Body'),
      placement: 'top',
    },
  ];

  const current = STEPS[step];

  // Measure target element; re-measure on resize / scroll
  useEffect(() => {
    let raf: number;

    function measure() {
      const r = queryRect(current.selector);
      setRect(r);
      setVisible(!!r);
    }

    // Small delay so the DOM has settled after step transition
    raf = requestAnimationFrame(() => { measure(); });

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, current.selector]);

  function advance() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else if (showSignupStep && !showSignup) {
      setShowSignup(true);
    } else {
      onDone();
    }
  }

  // Tooltip position — keeps the bubble on-screen, clamped to 90vw
  function tooltipStyle(): React.CSSProperties {
    const effectiveW = Math.min(TOOLTIP_W, window.innerWidth * 0.9);

    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };

    const hl = {
      top:    rect.top    - PAD,
      left:   rect.left   - PAD,
      bottom: rect.bottom + PAD,
      right:  rect.right  + PAD,
    };

    const clampX = (x: number) =>
      Math.max(8, Math.min(x, window.innerWidth - effectiveW - 8));

    const centreX = clampX(hl.left + (rect.width + PAD * 2) / 2 - effectiveW / 2);

    if (current.placement === 'bottom') {
      return { position: 'fixed', top: hl.bottom + 12, left: centreX };
    }
    // default: 'top'
    return { position: 'fixed', bottom: window.innerHeight - hl.top + 12, left: centreX };
  }

  // ── Sign-up nudge (final card — centered, no highlight) ──────────────────────
  if (showSignup) return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t('tour.saveTitle')}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onDone} />

      <motion.div
        className="relative w-full max-w-xs rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'rgba(15,10,30,0.98)',
          border: '1px solid rgba(255,255,255,0.10)',
          maxWidth: '90vw',
          maxHeight: '85vh',
        }}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top sheen */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-violet-600/15 to-transparent pointer-events-none z-10" />

        <div className="relative p-6 overflow-y-auto flex-1 min-h-0">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-violet-600/20 border border-violet-500/30">
              <Sparkles size={22} className="text-violet-300" />
            </div>
          </div>

          <h3 className="text-base font-bold text-white text-center mb-2 leading-snug">
            {t('tour.saveTitle')}
          </h3>
          <p className="text-xs text-slate-400 text-center leading-relaxed mb-5">
            {t('tour.saveDesc')}
          </p>

          {/* Perks */}
          <ul className="space-y-1.5 mb-5">
            {([1, 2, 3] as const).map(n => (
              <li key={n} className="flex items-center gap-2 text-[11px] text-slate-300">
                <CheckCircle size={12} className="text-violet-400 shrink-0" />
                {t(`tour.perk${n}`)}
              </li>
            ))}
          </ul>

          {/* Buttons */}
          <button
            onClick={() => { onDone(); onSignUp?.(); }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors mb-2.5"
          >
            {t('tour.signUpFree')}
          </button>
          <button
            onClick={onDone}
            className="w-full py-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            {t('tour.continueGuest')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );

  if (!visible) return null;

  const hlLeft   = (rect?.left   ?? 0) - PAD;
  const hlTop    = (rect?.top    ?? 0) - PAD;
  const hlWidth  = (rect?.width  ?? 0) + PAD * 2;
  const hlHeight = (rect?.height ?? 0) + PAD * 2;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label={t('tour.ariaLabel')}>

      {/* ── SVG overlay with rectangular cutout ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="onboard-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={hlLeft} y={hlTop}
              width={hlWidth} height={hlHeight}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#onboard-mask)"
        />
      </svg>

      {/* ── Violet highlight ring around target ── */}
      <div
        className="absolute pointer-events-none rounded-xl"
        style={{
          top:    hlTop,
          left:   hlLeft,
          width:  hlWidth,
          height: hlHeight,
          border: '2px solid rgba(139,92,246,0.85)',
          boxShadow: '0 0 0 4px rgba(139,92,246,0.18), 0 0 24px rgba(139,92,246,0.25)',
        }}
      />

      {/* ── Backdrop click = dismiss ── */}
      <div className="absolute inset-0" onClick={onDone} />

      {/* ── Tooltip bubble ── */}
      <motion.div
        key={step}
        className="absolute rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          ...tooltipStyle(),
          width: TOOLTIP_W,
          maxWidth: '90vw',
          maxHeight: '85vh',
          pointerEvents: 'auto',
          background: 'rgba(15,10,30,0.97)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
        initial={{ opacity: 0, y: current.placement === 'bottom' ? -6 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top sheen */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-violet-600/10 to-transparent pointer-events-none z-10" />

        {/* Scrollable content area */}
        <div className="relative flex flex-col flex-1 min-h-0 p-5">
          {/* Progress dots + close — always at top */}
          <div className="flex items-center justify-between mb-3.5 shrink-0">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    height: 4,
                    width:  i === step ? 20 : 8,
                    background: i === step ? '#7c3aed' : i < step ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)',
                  }}
                />
              ))}
              <span className="ml-1 text-[10px] font-mono text-slate-600">
                {step + 1}/{STEPS.length}
              </span>
            </div>
            <button
              onClick={onDone}
              className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-white/[0.08] transition-colors"
              aria-label={t('common.close')}
            >
              <X size={12} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 min-h-0 mb-4">
            <h3 className="text-sm font-semibold text-white mb-1.5 leading-snug">{current.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{current.body}</p>
          </div>

          {/* Nav buttons — always pinned to bottom */}
          <div className="flex items-center justify-between shrink-0 pt-1 border-t border-white/[0.06]">
            <button
              onClick={onDone}
              className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              {t('tour.skip')}
            </button>
            <button
              onClick={advance}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              {step === STEPS.length - 1 ? (
                showSignupStep
                  ? <>{t('tour.next')} <ArrowRight size={13} /></>
                  : <><CheckCircle size={13} /> {t('tour.done')}</>
              ) : (
                <>{t('tour.next')} <ArrowRight size={13} /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
