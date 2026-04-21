import type { Expense, Participant, Settlement } from '../types';

/** Round to 2 decimal places — use for money amounts */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round to 4 decimal places — use for exchange rates to preserve API granularity */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Outstanding amount still owed on a split.
 */
function outstanding(share: number, paidAmount: number): number {
  return round2(Math.max(0, share - paidAmount));
}

/**
 * Aggregate net balances across ALL expenses, counting only unsettled/partial amounts.
 * Positive = owed money (creditor), Negative = owes money (debtor).
 *
 * The payer's own split is always pre-settled (paidAmount === share) so it
 * contributes 0 here; the payer is credited only for what others still owe them.
 */
export function computeBalances(
  participants: Participant[],
  expenses: Expense[]
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const p of participants) balances[p.id] = 0;

  for (const expense of expenses) {
    for (const split of expense.splits) {
      const owed = outstanding(split.share, split.paidAmount);
      if (owed < 0.01) continue;
      balances[expense.paidBy] = round2((balances[expense.paidBy] ?? 0) + owed);
      balances[split.participantId] = round2((balances[split.participantId] ?? 0) - owed);
    }
  }

  return balances;
}

/**
 * Greedy debt simplification — minimum settlement transactions.
 * Used for the Global Settlement Advice panel.
 */
export function simplifyDebts(
  balances: Record<string, number>
): Settlement[] {
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, bal] of Object.entries(balances)) {
    const b = round2(bal);
    if (b < -0.01) debtors.push({ id, amount: -b });
    else if (b > 0.01) creditors.push({ id, amount: b });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const amount = round2(Math.min(debtor.amount, creditor.amount));

    settlements.push({ from: debtor.id, to: creditor.id, amount });

    debtor.amount = round2(debtor.amount - amount);
    creditor.amount = round2(creditor.amount - amount);

    if (debtor.amount < 0.01) di++;
    if (creditor.amount < 0.01) ci++;
  }

  return settlements;
}

/**
 * Simplified debts for a specific set of highlighted expenses.
 *
 * Algorithm:
 *   1. Compute net balances within the selected subset (same as computeBalances
 *      but scoped to the provided expenses).
 *   2. Feed those net balances into simplifyDebts (greedy max-debtor/max-creditor
 *      matching) to produce the minimum number of transactions — guaranteed ≤ N-1
 *      for N participants.
 *
 * This means if A owes C $10, B owes C $20, but C owes B $5, the output is:
 *   A → C $10,  B → C $15   (not three separate rows).
 */
export function computeSelectedDebts(
  selectedExpenses: Expense[]
): Settlement[] {
  const balances: Record<string, number> = {};

  for (const expense of selectedExpenses) {
    for (const split of expense.splits) {
      const owed = outstanding(split.share, split.paidAmount);
      if (owed < 0.01) continue;
      balances[expense.paidBy]      = round2((balances[expense.paidBy]      ?? 0) + owed);
      balances[split.participantId] = round2((balances[split.participantId] ?? 0) - owed);
    }
  }

  return simplifyDebts(balances);
}

/**
 * Gross total spending — always the sum of ALL expenses regardless of
 * settlement status (settled money was still spent).
 */
export function totalSpending(expenses: Expense[]): number {
  return round2(expenses.reduce((sum, e) => sum + e.totalAmount, 0));
}
