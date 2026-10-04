# Desktop Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/accounts` into the reconciliation surface: net worth as the subject, accounts as circles sized by balance, and a right panel showing the selected account's flows and entries.

**Architecture:** The right panel reuses `getAccountLedger` and `AccountLedger`, which did not exist when the spec was written — the account's entries with a running balance are already built. Circle sizing reuses `circleSizes` over **absolute** balances. The split layout reuses the `d-split` utilities from the Overview rebuild. Mobile is untouched.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Tailwind v4, drizzle-orm + postgres-js, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-03-desktop-review-surfaces-design.md`

## Global Constraints

- Desktop breakpoint is `min-width: 1024px`, as `d-*` utilities in `globals.css` **outside** `@layer`. Do not scatter `lg:` prefixes.
- **Mobile output must not change.** `/accounts` keeps its current single column below the breakpoint.
- Circles are at least 38px, names outside, adjacent ranks at least 8px apart — `circleSizes` handles the last two.
- A number is never truncated; when a line is tight the label gives way.
- Colours are tokens only. One accent. No cards, shadows or gradients.
- Run tests with `npx tsx --test src/lib/*.test.ts`, typecheck with `npx tsc --noEmit`, lint baseline is 6 problems / 2 errors.

## Three things the spec could not know

The spec predates the account ledger and was written against an account whose
balances were all positive. Each of these changes the work:

**1. The right panel already exists.** `getAccountLedger` and `AccountLedger`
were built for `/accounts/[id]` and give exactly what the spec describes as the
selected state — entries with a running balance, plus the opening balance. This
plan reuses both instead of writing a second one. The panel adds only the
in/out header above them.

**2. Balances go negative, and `circleSizes` would return NaN.** It takes the
square root of `value / peak`. Sizing must pass `Math.abs(balance)`, which is
the right reading anyway: a circle shows magnitude, and the sign is carried by
the fill.

**3. An asset account can hold a negative balance.** The spec says liabilities
draw as outlined circles — keyed on account *type*. A checking account that has
gone negative is still an asset type, so it draws filled, which reads as
"money here" when there is not. Those get the accent fill that liabilities
carry: the rule becomes *owing money*, not *being a credit card*. One real
account currently has three such accounts, so this is not hypothetical.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/accountCircles.ts` (create) | Pure: balances → size and visual treatment. |
| `src/lib/accountCircles.test.ts` (create) | Tests for the above. |
| `src/components/AccountCircles.tsx` (create) | The selectable circle set. |
| `src/components/AccountsPanel.tsx` (create) | Right column: flows header plus `AccountLedger`. |
| `src/app/accounts/page.tsx` (modify) | Split layout, selection from the URL. |
| `src/app/actions/accounts.ts` (modify) | `getMonthFlowAcrossAccounts` for the default panel. |

---

### Task 1: Circle size and treatment from a balance

**Files:**
- Create: `src/lib/accountCircles.ts`
- Test: `src/lib/accountCircles.test.ts`

**Interfaces:**
- Consumes: `circleSizes` from `src/lib/circleSizes.ts`; `LIABILITY_TYPES` from `src/lib/accountTypes.ts`.
- Produces:

```ts
export interface AccountCircle {
  name: string;
  balance: number;
  size: number;
  /** Outlined rather than filled — money owed, whatever the account type. */
  owing: boolean;
}
export function accountCircles(
  accounts: { name: string; type: string; balance: number }[],
  opts: { min: number; max: number; minStep: number },
): AccountCircle[];
```

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { accountCircles } from './accountCircles.ts';

const OPTS = { min: 44, max: 140, minStep: 8 };
const a = (name: string, type: string, balance: number) => ({ name, type, balance });

test('circles are ordered by magnitude, largest first', () => {
  const out = accountCircles([
    a('Small', 'checking', 100),
    a('Big', 'savings', 9000),
    a('Mid', 'checking', 500),
  ], OPTS);
  assert.deepEqual(out.map((c) => c.name), ['Big', 'Mid', 'Small']);
});

test('a negative balance is sized by its magnitude, not dropped or NaN', () => {
  const out = accountCircles([a('Card', 'credit_card', -5000), a('Cash', 'checking', 100)], OPTS);
  assert.equal(out[0].name, 'Card');
  assert.ok(Number.isFinite(out[0].size));
  assert.equal(out[0].size, OPTS.max);
});

test('every size is finite even when every balance is negative', () => {
  const out = accountCircles([
    a('A', 'checking', -3311.05), a('B', 'savings', -7250.27), a('C', 'credit_card', -9225.15),
  ], OPTS);
  assert.ok(out.every((c) => Number.isFinite(c.size)));
  assert.ok(out.every((c) => c.size >= OPTS.min && c.size <= OPTS.max));
});

test('adjacent ranks stay at least a step apart', () => {
  const out = accountCircles([
    a('A', 'checking', 1000), a('B', 'checking', 990), a('C', 'checking', 980),
  ], OPTS);
  assert.ok(out[0].size - out[1].size >= OPTS.minStep - 0.02);
  assert.ok(out[1].size - out[2].size >= OPTS.minStep - 0.02);
});

test('owing is true for a liability with a balance owed', () => {
  assert.equal(accountCircles([a('Card', 'credit_card', -500)], OPTS)[0].owing, true);
});

test('owing is true for an asset that has gone negative — the sign is what matters', () => {
  assert.equal(accountCircles([a('Checking', 'checking', -3311.05)], OPTS)[0].owing, true);
});

test('owing is false for a liability that is paid off or in credit', () => {
  assert.equal(accountCircles([a('Card', 'credit_card', 0)], OPTS)[0].owing, false);
  assert.equal(accountCircles([a('Card', 'credit_card', 120)], OPTS)[0].owing, false);
});

test('owing is false for an asset in the black', () => {
  assert.equal(accountCircles([a('Savings', 'savings', 8000)], OPTS)[0].owing, false);
});

test('an empty list gives an empty list', () => {
  assert.deepEqual(accountCircles([], OPTS), []);
});

test('all-zero balances still produce finite sizes at the floor', () => {
  const out = accountCircles([a('A', 'checking', 0), a('B', 'checking', 0)], OPTS);
  assert.ok(out.every((c) => Number.isFinite(c.size) && c.size >= OPTS.min));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/accountCircles.test.ts`
Expected: FAIL — `Cannot find module './accountCircles.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { circleSizes, type CircleSizeOptions } from '@/lib/circleSizes';

export interface AccountCircle {
  name: string;
  balance: number;
  size: number;
  /** Outlined rather than filled — money owed, whatever the account type. */
  owing: boolean;
}

/**
 * Sizes and treatments for the accounts on the reconciliation surface.
 *
 * Magnitude drives the size, so a balance is passed through Math.abs — both
 * because circleSizes takes a square root and would return NaN otherwise, and
 * because a circle reads as "how much", with the sign carried by the fill.
 *
 * `owing` follows the sign rather than the account type. A checking account
 * that has gone negative owes money just as a card does, and drawing it filled
 * would read as money being there.
 */
export function accountCircles(
  accounts: { name: string; type: string; balance: number }[],
  opts: CircleSizeOptions,
): AccountCircle[] {
  const sorted = [...accounts].sort((x, y) => Math.abs(y.balance) - Math.abs(x.balance));
  const sizes = circleSizes(sorted.map((s) => Math.abs(s.balance)), opts);
  return sorted.map((s, i) => ({
    name: s.name,
    balance: s.balance,
    size: sizes[i],
    owing: s.balance < 0,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/accountCircles.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/accountCircles.ts src/lib/accountCircles.test.ts
git commit -m "Add account circle sizing that survives negative balances"
```

---

### Task 2: `getMonthFlowAcrossAccounts` — the panel's default state

**Files:**
- Modify: `src/app/actions/accounts.ts`

**Interfaces:**
- Consumes: `nowPartsIn`, `monthRange`, `safeTimeZone` from `src/lib/dates.ts`; the file's existing `getUser` and `toNum`.
- Produces: `getMonthFlowAcrossAccounts(): Promise<{ monthIn: number; monthOut: number; label: string }>` — `label` is like `"SEPTEMBER 2026"`.

- [ ] **Step 1: Write the implementation**

Append to `src/app/actions/accounts.ts`:

```ts
/**
 * This month's in and out across every active account, for the reconciliation
 * panel before an account is picked — so the page says something before the
 * first click.
 */
export async function getMonthFlowAcrossAccounts(): Promise<{
  monthIn: number;
  monthOut: number;
  label: string;
}> {
  const user = await getUser();
  const tz = safeTimeZone(user.user_metadata?.timezone as string | undefined);
  const { year, month } = nowPartsIn(tz);
  const [start, end] = monthRange(year, month);

  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      gte(transactions.date, start),
      lte(transactions.date, end),
    ),
    columns: { type: true, amount: true },
  });

  let monthIn = 0;
  let monthOut = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    if (r.type === 'income' || r.type === 'refund') monthIn += amt;
    else if (r.type === 'expense') monthOut += amt;
  }

  return {
    monthIn,
    monthOut,
    label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)))
      .toUpperCase(),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify against the live database**

Write a scratch script under the scratchpad directory that runs the same query for the current month and check `monthIn`/`monthOut` against what Home shows for the same period. Delete the script afterwards; do not add it to the repo.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/accounts.ts
git commit -m "Add combined month flow for the accounts panel default"
```

---

### Task 3: `AccountCircles` — the selectable set

**Files:**
- Create: `src/components/AccountCircles.tsx`

**Interfaces:**
- Consumes: `accountCircles` (Task 1), `ResponsiveAmount`, `formatSignedCurrency`.
- Produces: `AccountCircles({ accounts, selected, onSelect })` where `accounts` is `{ id, name, type, balance }[]` and `onSelect` takes an id or `null`.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { motion } from 'motion/react';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { accountCircles } from '@/lib/accountCircles';

const MAX_SIZE = 140;
const MIN_SIZE = 44;
const MIN_STEP = 8;
const ORGANIC_RADIUS = '48% 52% 50% 50% / 52% 48% 52% 48%';
/** A circle's inscribed square: text wider than this reaches past the curve. */
const INSCRIBED = 0.707;

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function AccountCircles({
  accounts,
  selected,
  onSelect,
}: {
  accounts: Account[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const circles = accountCircles(accounts, { min: MIN_SIZE, max: MAX_SIZE, minStep: MIN_STEP });
  const byName = new Map(accounts.map((a) => [a.name, a]));

  return (
    <div className="flex flex-wrap items-end gap-4">
      {circles.map((c, i) => {
        const account = byName.get(c.name)!;
        const isSelected = selected === account.id;
        const inner = Math.floor(c.size * INSCRIBED);

        return (
          <button
            key={account.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? null : account.id)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26, delay: i * 0.04 }}
              className="flex items-center justify-center text-center shrink-0"
              style={{
                width: c.size,
                height: c.size,
                borderRadius: isSelected ? ORGANIC_RADIUS : '9999px',
                // Owing is outlined, not filled: nothing is there to fill.
                background: c.owing ? 'transparent' : isSelected ? 'var(--accent)' : 'var(--sand)',
                border: c.owing
                  ? `2px solid ${isSelected ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 55%, transparent)'}`
                  : '1px solid color-mix(in srgb, var(--ink) 18%, transparent)',
                color: c.owing ? 'var(--accent)' : isSelected ? '#fff' : 'var(--ink)',
              }}
            >
              <ResponsiveAmount
                value={Math.abs(c.balance)}
                baseSize={Math.round(c.size * 0.15)}
                minSize={9}
                style={{ width: inner }}
                className="text-center leading-none"
                spanClassName="text-[currentColor]"
              />
            </motion.div>
            <span
              className={`text-[8px] font-bold uppercase tracking-widest text-center max-w-[7rem] ${
                isSelected ? 'text-accent' : 'text-ink-soft'
              }`}
            >
              {account.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountCircles.tsx
git commit -m "Add the selectable account circle set"
```

---

### Task 4: `AccountsPanel` — the right column

**Files:**
- Create: `src/components/AccountsPanel.tsx`

**Interfaces:**
- Consumes: `AccountLedger` component and the `AccountLedger` type from `@/app/actions/accounts`; `getMonthFlowAcrossAccounts`'s return shape (Task 2).
- Produces: `AccountsPanel({ ledger, detail, flow })` — `ledger` and `detail` are null when nothing is selected.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { AccountLedger } from '@/components/AccountLedger';
import { formatCurrency } from '@/lib/utils';
import type { AccountLedger as Ledger, AccountDetail } from '@/app/actions/accounts';

export function AccountsPanel({
  ledger,
  detail,
  flow,
}: {
  ledger: Ledger | null;
  detail: AccountDetail | null;
  flow: { monthIn: number; monthOut: number; label: string };
}) {
  const selected = ledger && detail;

  return (
    <section>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className={`text-[9px] font-bold uppercase tracking-[0.2em] truncate ${selected ? 'text-accent' : 'text-ink-faint'}`}>
            {selected ? detail!.name : `All accounts · ${flow.label}`}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint mt-3">In this month</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatCurrency(selected ? detail!.thisMonthIn : flow.monthIn)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint mt-[1.6rem]">Out</p>
          <p className="text-2xl font-bold tabular-nums text-accent mt-1">
            {formatCurrency(selected ? detail!.thisMonthOut : flow.monthOut)}
          </p>
        </div>
      </div>

      <div className="border-t border-ink mt-6 pt-2">
        {selected ? (
          <AccountLedger ledger={ledger!} />
        ) : (
          <p className="py-4 text-sm text-ink-faint">
            Pick an account to see its entries and running balance.
          </p>
        )}
      </div>
    </section>
  );
}
```

`AccountDetail` and `AccountLedger` are both already exported from `src/app/actions/accounts.ts`; no change is needed there for this task.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountsPanel.tsx src/app/actions/accounts.ts
git commit -m "Add the accounts right panel"
```

---

### Task 5: Split layout on `/accounts`

**Files:**
- Modify: `src/app/accounts/page.tsx`

**Interfaces:**
- Consumes: Tasks 1–4; `d-split`, `d-split-main`, `d-split-panel`, `d-panel-rule`, `d-desktop-only` from `globals.css`.
- Produces: `/accounts?account=<id>` selects an account.

- [ ] **Step 1: Widen the container and fetch the panel data**

Change the page's container from `d-max-lg` to `d-max-xl` so the split has room, widen `searchParams` to `{ account?: string }`, and fetch:

```tsx
  const selectedId = params.account?.trim() || null;

  const [accounts, flow, detail, ledger] = await Promise.all([
    getAccountBalances(),
    getMonthFlowAcrossAccounts(),
    selectedId ? getAccountDetail(selectedId) : Promise.resolve(null),
    selectedId ? getAccountLedger(selectedId) : Promise.resolve(null),
  ]);
```

- [ ] **Step 2: Wrap the body in the split**

The existing net worth block and grouped list become `d-split-main`. Add the circle set above the groups, desktop-only so the phone keeps exactly what it has:

```tsx
      <div className="d-split">
        <div className="d-split-main">
          {/* net worth block stays exactly as it is */}

          <div className="d-desktop-only mb-10">
            <AccountCirclesClient accounts={accounts} selected={selectedId} />
          </div>

          {/* grouped account list stays exactly as it is */}
        </div>

        <div className="d-split-panel d-panel-rule d-desktop-only">
          <AccountsPanel ledger={ledger} detail={detail} flow={flow} />
        </div>
      </div>
```

- [ ] **Step 3: Add the client wrapper that owns navigation**

`AccountCircles` takes an `onSelect` callback, which a server component cannot pass. Create `src/components/AccountCirclesClient.tsx`:

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AccountCircles } from '@/components/AccountCircles';

export function AccountCirclesClient({
  accounts,
  selected,
}: {
  accounts: { id: string; name: string; type: string; balance: number }[];
  selected: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('account', id);
    else params.delete('account');
    router.push(`/accounts?${params.toString()}`);
  }

  return <AccountCircles accounts={accounts} selected={selected} onSelect={select} />;
}
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0, 14 routes.

- [ ] **Step 5: Commit**

```bash
git add src/app/accounts/page.tsx src/components/AccountCirclesClient.tsx
git commit -m "Rebuild /accounts as a two-column reconciliation surface"
```

---

### Task 6: Verify

**Files:** none modified unless a defect is found.

- [ ] **Step 1: Build a throwaway preview**

Create `src/app/dev-preview/page.tsx` rendering `AccountCircles` and `AccountsPanel`, gated twice: add `dev-preview` to the matcher in `src/proxy.ts`, and `if (process.env.NODE_ENV !== 'development') notFound();` in the page. Start the dev server with `preview_start`, never through a shell.

Use two real account sets. The all-negative one is the case that breaks naive
sizing:

```ts
const ALL_NEGATIVE = [
  { id: '1', name: 'BOA0788', type: 'credit_card', balance: -9225.15 },
  { id: '2', name: 'CHA6527', type: 'checking',    balance: -7360.00 },
  { id: '3', name: 'BOA5839', type: 'savings',     balance: -7250.27 },
  { id: '4', name: 'BOA5800', type: 'checking',    balance: -3311.05 },
  { id: '5', name: 'CMB7181', type: 'credit_card', balance: -1423.51 },
];
const MIXED = [
  { id: '1', name: 'Chase Savings 3279', type: 'savings',     balance: 10781.20 },
  { id: '2', name: 'Chase CD',           type: 'investment',  balance: 8000.00 },
  { id: '3', name: 'Chase Checking 7511',type: 'checking',    balance: 4994.21 },
  { id: '4', name: 'BOA Savings',        type: 'savings',     balance: 3681.83 },
  { id: '5', name: 'BOA Checking',       type: 'checking',    balance: 1383.33 },
  { id: '6', name: 'BOA Credit 4654',    type: 'credit_card', balance: -287.71 },
  { id: '7', name: 'Chase Freedom 1658', type: 'credit_card', balance: -40.91 },
  { id: '8', name: '招行0199',            type: 'credit_card', balance: 0 },
];
```

- [ ] **Step 2: Confirm negatives are handled**

Measure every circle's rendered width with `javascript_tool`: all finite, none below 44, none above 140, adjacent ranks at least 8px apart for the all-negative set. A `NaN` here renders as a zero-size circle, which a screenshot will not reliably show — measure, do not look.

- [ ] **Step 3: Confirm the owing treatment**

In the all-negative set every circle is outlined in accent, including the two checking and one savings account. In the mixed set only the two negative cards are outlined, and the zero-balance card is filled.

- [ ] **Step 4: Confirm amounts fit**

For every circle, the amount's rendered width is within the inscribed square (`diameter × 0.707`) and nothing is clipped — the same check the Overview circles get.

- [ ] **Step 5: Check the widths and schemes**

1280, 1440, 1920 and 375: no horizontal page scroll, the panel does not overflow, and at 375 the circle set is not rendered at all (`d-desktop-only`), leaving the phone exactly as it was. Then `colorScheme: 'dark'` and `'light'` — the outlined circles are the ones to watch, since they carry colour only in their border.

- [ ] **Step 6: Remove the harness and verify it left nothing**

```bash
rm -rf src/app/dev-preview
```

Restore `src/proxy.ts`, confirm with `git diff` that it is byte-identical to the committed version, and that `grep -rn "dev-preview" src/` returns nothing.

- [ ] **Step 7: Full verification**

```bash
rm -rf .next && npx tsc --noEmit && npx tsx --test src/lib/*.test.ts && npm run build && npx eslint src
```

Expected: tsc exit 0, all tests pass, 14 routes, eslint at 6 problems / 2 errors.

- [ ] **Step 8: Commit any fixes**

```bash
git add -A src
git commit -m "Fix defects found verifying the accounts rebuild"
```
