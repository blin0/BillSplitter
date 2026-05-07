import { describe, it, expect } from 'vitest'
import {
  round2,
  computeBalances,
  simplifyDebts,
  computeSelectedDebts,
  totalSpending,
} from '../utils/calculations'
import type { Expense, Participant } from '../types'

function makeExpense(
  overrides: Partial<Expense> & { id: string; paidBy: string; splits: Expense['splits'] }
): Expense {
  return {
    description: 'Test',
    totalAmount: 100,
    sourceAmount: 100,
    sourceCurrency: 'USD',
    lockedRate: 1,
    splitType: 'equally',
    involvedParticipants: [],
    isHighlighted: false,
    ...overrides,
  }
}

const A = 'alice'
const B = 'bob'
const C = 'carol'
const participants: Participant[] = [
  { id: A, name: 'Alice' },
  { id: B, name: 'Bob' },
  { id: C, name: 'Carol' },
]

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    // Note: 1.005 is 1.00499... in IEEE 754, so it rounds down to 1.00
    expect(round2(1.234)).toBe(1.23)
    expect(round2(1.235)).toBe(1.24)
    expect(round2(10 / 3)).toBe(3.33)
    expect(round2(33.333)).toBe(33.33)
  })

  it('handles negative values', () => {
    expect(round2(-1.234)).toBe(-1.23)
    expect(round2(-3.336)).toBe(-3.34)
  })
})

describe('computeBalances', () => {
  it('credits payer and debits each unsettled split participant', () => {
    const expense = makeExpense({
      id: 'e1',
      paidBy: A,
      totalAmount: 30,
      splits: [
        { participantId: A, share: 10, paidAmount: 10, isSettled: true },
        { participantId: B, share: 10, paidAmount: 0, isSettled: false },
        { participantId: C, share: 10, paidAmount: 0, isSettled: false },
      ],
    })

    const balances = computeBalances(participants, [expense])
    expect(balances[A]).toBe(20)  // creditor: owed 10+10
    expect(balances[B]).toBe(-10)
    expect(balances[C]).toBe(-10)
  })

  it('ignores splits where paidAmount >= share (settled)', () => {
    const expense = makeExpense({
      id: 'e1',
      paidBy: A,
      totalAmount: 20,
      splits: [
        { participantId: A, share: 10, paidAmount: 10, isSettled: true },
        { participantId: B, share: 10, paidAmount: 10, isSettled: true }, // already settled
      ],
    })

    const balances = computeBalances(participants, [expense])
    expect(balances[A]).toBe(0)
    expect(balances[B]).toBe(0)
  })

  it('returns zero balances for empty expenses', () => {
    const balances = computeBalances(participants, [])
    expect(balances[A]).toBe(0)
    expect(balances[B]).toBe(0)
  })

  it('handles partial payments correctly', () => {
    const expense = makeExpense({
      id: 'e1',
      paidBy: A,
      totalAmount: 30,
      splits: [
        { participantId: A, share: 10, paidAmount: 10, isSettled: true },
        { participantId: B, share: 10, paidAmount: 5, isSettled: false }, // half paid
        { participantId: C, share: 10, paidAmount: 0, isSettled: false },
      ],
    })

    const balances = computeBalances(participants, [expense])
    expect(balances[A]).toBe(15)   // still owed 5 from B + 10 from C
    expect(balances[B]).toBe(-5)   // owes 5 more
    expect(balances[C]).toBe(-10)
  })
})

describe('simplifyDebts', () => {
  it('produces a single transaction for two-person debt', () => {
    const settlements = simplifyDebts({ [A]: 30, [B]: -30 })
    expect(settlements).toHaveLength(1)
    expect(settlements[0]).toEqual({ from: B, to: A, amount: 30 })
  })

  it('minimises transactions: 2 debtors, 1 creditor', () => {
    const settlements = simplifyDebts({ [A]: 30, [B]: -20, [C]: -10 })
    expect(settlements).toHaveLength(2)
    const total = settlements.reduce((s, t) => s + t.amount, 0)
    expect(total).toBe(30)
    settlements.forEach(s => expect(s.to).toBe(A))
  })

  it('returns empty array for empty or balanced balances', () => {
    expect(simplifyDebts({})).toHaveLength(0)
    expect(simplifyDebts({ [A]: 0, [B]: 0 })).toHaveLength(0)
  })

  it('ignores near-zero dust balances (< 0.01)', () => {
    // Floating point drift can leave tiny residuals
    const settlements = simplifyDebts({ [A]: 0.009, [B]: -0.009 })
    expect(settlements).toHaveLength(0)
  })
})

describe('computeSelectedDebts', () => {
  it('computes debts only for the provided expenses', () => {
    const e1 = makeExpense({
      id: 'e1',
      paidBy: A,
      totalAmount: 20,
      splits: [
        { participantId: A, share: 10, paidAmount: 10, isSettled: true },
        { participantId: B, share: 10, paidAmount: 0, isSettled: false },
      ],
    })
    const e2 = makeExpense({
      id: 'e2',
      paidBy: C,
      totalAmount: 40,
      splits: [
        { participantId: C, share: 20, paidAmount: 20, isSettled: true },
        { participantId: B, share: 20, paidAmount: 0, isSettled: false },
      ],
    })

    // Only e1 selected: B owes A 10
    const s1 = computeSelectedDebts([e1])
    expect(s1).toHaveLength(1)
    expect(s1[0]).toEqual({ from: B, to: A, amount: 10 })

    // Both selected: B owes A 10 + B owes C 20
    const s2 = computeSelectedDebts([e1, e2])
    expect(s2).toHaveLength(2)
  })
})

describe('totalSpending', () => {
  it('sums all expense totalAmounts regardless of settlement', () => {
    const expenses = [
      makeExpense({ id: 'e1', paidBy: A, totalAmount: 100, splits: [] }),
      makeExpense({ id: 'e2', paidBy: B, totalAmount: 55.50, splits: [] }),
    ]
    expect(totalSpending(expenses)).toBe(155.50)
  })

  it('returns 0 for empty array', () => {
    expect(totalSpending([])).toBe(0)
  })
})
