export interface Participant {
  id: string;
  name: string;
}

export interface Split {
  participantId: string;
  /** Amount owed in base currency */
  share: number;
  /** Amount already paid toward this share */
  paidAmount: number;
  /** True when paidAmount >= share */
  isSettled: boolean;
}

export interface Expense {
  id: string;
  description: string;
  /** Total in group base currency — locked at save time. Used by the calculation engine. */
  totalAmount: number;
  /** Original amount as the user entered it, in sourceCurrency. */
  sourceAmount: number;
  /** Currency the user actually paid in (e.g. "CNY"). */
  sourceCurrency: string;
  /**
   * Conversion factor locked at save time.
   * 1 unit of sourceCurrency = lockedRate units of baseCurrency.
   * So: totalAmount = sourceAmount × lockedRate.
   */
  lockedRate: number;
  paidBy: string;
  splitType: 'equally' | 'exact';
  involvedParticipants: string[];
  splits: Split[];
  /** Whether this expense is selected in the Selective Settlement panel */
  isHighlighted: boolean;
  /** ISO timestamp when the expense was created (from DB created_at). Used for analytics. */
  date?: string;
  /** Tax rate applied at save time (e.g. 8 means 8%). Undefined = no tax. */
  taxPercent?: number;
  /**
   * Flat tip entered in sourceCurrency at save time.
   * Undefined = no tip. Display-only — splits already include the converted tip.
   */
  tipSourceAmount?: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}
