import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Expense, Participant } from '../types';
import ExpenseForm from './ExpenseForm';

interface Props {
  isOpen:        boolean;
  onClose:       () => void;
  participants:  Participant[];
  onAdd:         (expense: Expense) => void;
  groupId?:      string;
  groupTaxRate?: number | null;
}

export default function ExpenseModal({ isOpen, onClose, participants, onAdd, groupId, groupTaxRate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus the first input (description) when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      const input = containerRef.current?.querySelector<HTMLInputElement>('input');
      input?.focus();
    }, 60);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleAdded(expense: Expense) {
    onAdd(expense);
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add expense"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl ring-1 ring-white/10 shadow-2xl shadow-black/60"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button (top-right, above the form card) */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X size={16} />
        </button>

        <ExpenseForm
          participants={participants}
          onAdd={handleAdded}
          groupId={groupId}
          groupTaxRate={groupTaxRate}
        />
      </div>
    </div>,
    document.body,
  );
}
