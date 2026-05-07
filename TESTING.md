# Testing

Tests make vibe coding safe. 100% coverage is the goal — with tests, you can ship fast and trust your instincts. Without them, it's just yolo coding.

## Framework

**vitest v4** + **@testing-library/react** + **@testing-library/user-event** + **@testing-library/jest-dom**

## Run tests

```bash
npm test           # run all tests once
npm run test:watch # watch mode (re-runs on save)
```

Test files live in `src/test/` and alongside components as `*.test.ts` / `*.test.tsx`.

## Test layers

| Layer | What | Where |
|-------|------|-------|
| Unit | Pure functions (calculations, formatting, currency math) | `src/test/*.test.ts` |
| Component | React components (render, user interactions) | `src/test/*.test.tsx` |
| Integration | Multi-step flows (expense creation, settlement) | `src/test/*.test.tsx` |

## Conventions

- File naming: `{module}.test.ts` or `{Component}.test.tsx`
- Imports: `import { describe, it, expect } from 'vitest'`
- Assertions: `expect(x).toBe(y)`, `expect(x).toEqual(y)`, `expect(el).toBeInTheDocument()`
- Setup: global setup in `src/test/setup.ts` (imports jest-dom matchers)
- No `beforeEach` unless truly shared — inline setup is clearer

## Expectations

- Write a test for every new function
- Write a regression test for every bug fix (format: `fix: ISSUE-NNN — desc`)
- Test both paths of every conditional (if/else, switch)
- Never commit code that makes existing tests fail
- Mock all external dependencies (Supabase, Stripe, Frankfurter API) — never hit real services in tests
