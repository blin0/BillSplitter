# BillSplitter — Claude Code Guide

## Commands
```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Type-check (tsc -b) then Vite production build
npm run lint     # ESLint flat config
npm run preview  # Preview production build locally
```

## Architecture

```
src/
├── types.ts                    # All shared TypeScript interfaces
├── context/
│   └── CurrencyContext.tsx     # Global currency + exchange-rate state
├── utils/
│   └── calculations.ts         # Pure math: balances, debt simplification, rounding
├── lib/
│   └── cn.ts                   # clsx + tailwind-merge helper
├── components/
│   ├── ParticipantInput.tsx    # Add/remove group members
│   ├── ExpenseForm.tsx         # Expense entry with currency conversion
│   ├── ExpenseList.tsx         # Expense history with rate tooltips
│   ├── Dashboard.tsx           # Total spending + per-person net balances
│   ├── SettlementAdvice.tsx    # Minimised debt-settlement instructions
│   └── CurrencyDropdown.tsx    # Group base-currency switcher (header)
└── App.tsx                     # Root: CurrencyProvider wraps AppInner
```

**State ownership**
- `participants` and `expenses` live as `useState` in `App.tsx`; passed as props
- Currency preference + exchange rates live in `CurrencyContext` (accessed via `useCurrency()`)

## Key Domain Concepts

### Expense storage
- `expense.amount` — locked base-currency value used by the calculation engine
- `expense.sourceAmount` + `expense.sourceCurrency` — what the user actually typed
- `expense.lockedRate` — `convert(1, source, base)` frozen at save time so historical bills never drift
- `expense.splits` — per-participant shares, always in base currency

### Calculation pipeline (`utils/calculations.ts`)
1. `computeBalances()` — credit payer +amount, debit each split participant -share
2. `simplifyDebts()` — greedy debtor/creditor matching → minimum settlement transactions
3. All arithmetic via `round2()` to prevent floating-point drift

### Currency conversion (`CurrencyContext`)
- Rates fetched from `https://api.frankfurter.dev/v2/latest` (EUR-relative)
- Cached in `localStorage` under `billsplitter_rates_v1` for 24 hours
- Formula: `convert(amount, from, to) = amount × rates[to] / rates[from]` (EUR = 1)
- Group display currencies: USD, EUR, GBP, JPY
- Expense source currencies: all 31 frankfurter currencies (CNY, THB, etc.)

### Split types
- **equally** — `share = baseTotal / involvedCount` per involved participant
- **exact** — manual amounts always entered in base currency; validated to sum to `baseTotal`

## Conventions

- `makeId()` — `Math.random().toString(36).slice(2)` for IDs (in `App.tsx` and `ExpenseForm.tsx`)
- `cn(...classes)` — always use this instead of string concatenation for Tailwind classes
- `formatPrice(amount)` — always wrap displayed prices in this (handles JPY no-decimal, EUR comma, etc.)
- `round2(n)` — wrap every financial arithmetic result
- Guard `rates[key] ?? 1` when indexing rates (graceful fallback if a code is missing)
- `involvedParticipants` — IDs of consumers; payer is credited regardless of whether they're in this list

## localStorage Keys
| Key | Purpose | TTL |
|-----|---------|-----|
| `billsplitter_currency` | User's group base currency | permanent |
| `billsplitter_rates_v1` | Exchange rate cache | 24 hours |
