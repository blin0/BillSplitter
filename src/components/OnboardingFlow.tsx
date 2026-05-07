import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ArrowRight, Plus, X, Loader2, ChevronRight, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createGroup, insertParticipant, updateGroupIcon, type GroupInfo } from '../lib/db';
import { GROUP_ICON_DEFS } from '../lib/groupIcons';
import { cn } from '../lib/cn';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface MemberRow {
  name:  string;
  email: string;
}

interface Props {
  onSkip:     () => void;
  onComplete: (group: GroupInfo) => void;
}

const slideVariants = {
  enter:  (dir: number) => ({ opacity: 0, x: dir * 56 }),
  center: { opacity: 1, x: 0 },
  exit:   (dir: number) => ({ opacity: 0, x: dir * -56 }),
};

const EASE = [0.25, 0.1, 0.25, 1] as const;

/** Resize a File to a 128×128 JPEG data URL so it's safe to store in the DB. */
function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const SIZE = 128;
        const canvas = document.createElement('canvas');
        canvas.width  = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d')!;
        const scale = SIZE / Math.min(img.width, img.height);
        const sw = SIZE / scale;
        const sh = SIZE / scale;
        const sx = (img.width  - sw) / 2;
        const sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OnboardingFlow({ onSkip, onComplete }: Props) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step,         setStep        ] = useState(0);
  const [dir,          setDir         ] = useState(1);
  const [groupName,    setGroupName   ] = useState('');
  // selectedIcon is either a GROUP_ICON_DEFS name like "Globe" or a data: URL
  const [selectedIcon, setSelectedIcon] = useState<string>('Globe');
  const [customThumb,  setCustomThumb ] = useState<string | null>(null);
  const [members,      setMembers     ] = useState<MemberRow[]>([{ name: '', email: '' }]);
  const [loading,      setLoading     ] = useState(false);
  const [error,        setError       ] = useState<string | null>(null);

  const displayName =
    user?.user_metadata?.full_name ??
    user?.email?.split('@')[0]     ??
    'You';

  function go(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setSelectedIcon(dataUrl);
      setCustomThumb(dataUrl);
    } catch {
      // silently ignore — user can pick an icon instead
    }
    // Reset so the same file can be re-uploaded if needed
    e.target.value = '';
  }

  const emailErrors    = members.map(m => m.email.length > 0 && !EMAIL_RE.test(m.email));
  const hasEmailErrors = emailErrors.some(Boolean);

  async function handleSave() {
    setError(null);
    setLoading(true);

    const { data: group, error: groupErr } = await createGroup(groupName.trim());
    if (groupErr || !group) {
      setError(groupErr ?? 'Failed to create group');
      setLoading(false);
      return;
    }

    // Persist the selected icon
    if (selectedIcon !== 'Globe') {
      await updateGroupIcon(group.id, selectedIcon);
    }

    // Add creator as first named participant
    await insertParticipant(group.id, displayName);

    // Add any additional members that have a name
    const validMembers = members.filter(m => m.name.trim());
    await Promise.all(validMembers.map(m => insertParticipant(group.id, m.name.trim())));

    setLoading(false);
    onComplete({ ...group, icon: selectedIcon });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden">

          <div className="relative">
            <AnimatePresence mode="wait" custom={dir}>

              {/* ── Step 0: Welcome / choice ── */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  custom={dir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: EASE }}
                  className="p-8"
                >
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-3xl bg-violet-500/20 blur-2xl" />
                      <div className="relative p-5 rounded-3xl bg-violet-900/30 border border-violet-700/40">
                        <Users size={36} className="text-violet-400" />
                      </div>
                    </div>
                  </div>

                  <h1 className="text-2xl font-bold text-white text-center mb-2">
                    Welcome to Axiom.
                  </h1>
                  <p className="text-sm text-slate-400 text-center mb-8 leading-relaxed max-w-xs mx-auto">
                    Split expenses effortlessly with groups, smart settlements, and real-time sync.
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => go(1)}
                      className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-violet-900/40"
                    >
                      Create your first group
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={onSkip}
                      className="w-full flex items-center justify-center px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-sm transition-all border border-slate-700/60"
                    >
                      Skip for now
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 1: Group identity ── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={dir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: EASE }}
                  className="p-8"
                >
                  <h2 className="text-xl font-bold text-white mb-1">Name your group</h2>
                  <p className="text-sm text-slate-400 mb-6 leading-snug">
                    Pick a name and icon that describe what you're splitting.
                  </p>

                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Bali Trip, House 2024…"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    maxLength={60}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-white text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all mb-5"
                  />

                  <p className="text-xs font-medium text-slate-400 mb-3">Choose a group icon</p>

                  {/* Icon grid */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {GROUP_ICON_DEFS.map(({ name, label, Icon }) => (
                      <button
                        key={name}
                        type="button"
                        title={label}
                        onClick={() => { setSelectedIcon(name); setCustomThumb(null); }}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl transition-all group',
                          selectedIcon === name && !customThumb
                            ? 'bg-violet-600 ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900'
                            : 'bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-slate-600',
                        )}
                      >
                        <Icon
                          size={18}
                          strokeWidth={1.5}
                          className={cn(
                            'transition-colors',
                            selectedIcon === name && !customThumb
                              ? 'text-white'
                              : 'text-slate-400 group-hover:text-slate-200',
                          )}
                        />
                      </button>
                    ))}

                    {/* Upload custom image */}
                    <button
                      type="button"
                      title="Upload image"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl transition-all group border',
                        customThumb
                          ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900 border-transparent'
                          : 'bg-slate-800 hover:bg-slate-700 border-dashed border-slate-600 hover:border-violet-500',
                      )}
                    >
                      {customThumb ? (
                        <img
                          src={customThumb}
                          alt="Custom icon"
                          className="w-[18px] h-[18px] rounded-full object-cover"
                        />
                      ) : (
                        <Upload size={18} strokeWidth={1.5} className="text-slate-500 group-hover:text-violet-400 transition-colors" />
                      )}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <p className="text-[11px] text-slate-600 mb-6">
                    Last tile: upload your own image — resized to 128 × 128 px automatically.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => go(0)}
                      className="flex-1 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors border border-slate-700/60"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => go(2)}
                      disabled={!groupName.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                      Next
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Member population ── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={dir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: EASE }}
                  className="p-8"
                >
                  <h2 className="text-xl font-bold text-white mb-1">Add group members</h2>
                  <p className="text-sm text-slate-400 mb-5 leading-snug">
                    Who's splitting expenses with you?
                  </p>

                  {/* Creator row — auto-added */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-violet-900/20 border border-violet-700/30 mb-3">
                    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {displayName[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{displayName}</p>
                      <p className="text-xs text-violet-400">You · added automatically</p>
                    </div>
                  </div>

                  {/* Additional member rows */}
                  <div className="space-y-2 mb-3 max-h-44 overflow-y-auto pr-0.5">
                    {members.map((member, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Name"
                            value={member.name}
                            onChange={e => setMembers(prev => prev.map((m, i) => i === idx ? { ...m, name: e.target.value } : m))}
                            className="px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 focus:border-violet-500 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
                          />
                          <input
                            type="email"
                            placeholder="Email (optional)"
                            value={member.email}
                            onChange={e => setMembers(prev => prev.map((m, i) => i === idx ? { ...m, email: e.target.value } : m))}
                            className={cn(
                              'px-3 py-2.5 rounded-xl bg-slate-800 border text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:border-violet-500 focus:ring-violet-500/50 transition-all',
                              emailErrors[idx] ? 'border-red-500/70 focus:ring-red-500/30' : 'border-slate-700',
                            )}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setMembers(prev => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          aria-label="Remove member"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setMembers(prev => [...prev, { name: '', email: '' }])}
                    className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors mb-6 py-1"
                  >
                    <Plus size={13} />
                    Add person
                  </button>

                  {error && (
                    <p className="text-xs text-red-400 mb-3 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => go(1)}
                      disabled={loading}
                      className="flex-1 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm font-medium transition-colors border border-slate-700/60"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading || hasEmailErrors}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {loading
                        ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
                        : 'Create Group'}
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 pb-6 pt-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all duration-300',
                  step === i  ? 'w-6 h-1.5 bg-violet-500'
                  : step > i  ? 'w-2 h-1.5 bg-violet-700'
                  :              'w-2 h-1.5 bg-slate-700',
                )}
              />
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
