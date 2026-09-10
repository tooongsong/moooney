# Balance Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user permanently fix an account's balance to a specific value at any time, via a signed `balance_adjustment` transaction type, without corrupting `startingBalance`, transaction history, Net Worth, or spending stats.

**Architecture:** Balance stays computed live (`startingBalance` + summed transactions/transfers, unchanged). A new transaction type carries a *signed* delta as its own row — one more branch in the existing summation loop, not a new balance-storage mechanism. All money math for this feature is done in integer cents. The edit UI moves from Settings' generic account-edit row to a dedicated Edit affordance on the Account Detail page.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Drizzle ORM / Postgres (via Supabase), React 19, Tailwind, `@radix-ui/react-alert-dialog`. No test framework is installed — pure logic is tested with Node's built-in test runner (`node --test`, native TS support, zero new dependencies); everything else is verified by `tsc --noEmit` plus a final manual acceptance pass (see Global Constraints).

**Spec:** `docs/superpowers/specs/2026-09-10-balance-adjustment-design.md`

## Global Constraints

- **No SQL migration.** `transactions.type` is a plain unconstrained `text` column at the DB level — only `src/db/schema.ts`'s TS-level enum hint changes.
- **`balance_adjustment` is never added to `TRANSACTION_TYPES`** (`src/lib/categories.ts`) — it must never appear in the user-facing type picker. It gets its own separate constant.
- **All new adjustment math is integer-cents** (`Math.round(dollars * 100)`), compared/summed as integers, converted back to a dollar float only when building the row to persist. Existing float-based summation loops elsewhere are untouched.
- **The server never trusts a client-computed delta.** The server action takes a *target* signed balance and independently re-derives the delta from its own freshly-read current balance.
- **Don't touch:** `startingBalance` write path, the `current_balance` column, `expense`/`income`/`refund` behavior, the create-account flow, or any file not listed in a task below.
- **Live-data safety:** this app's only database is the real Supabase Postgres instance (one `.env.local`, no separate test DB). Tasks 1–2 are verified by automated tests / typecheck only — no DB access. Tasks 3–6 are verified by `tsc --noEmit` plus code review against this plan — deliberately deferred from live DB checks, since half-built plumbing has no UI yet to exercise safely. All live verification happens once, in Task 7, against one throwaway account created and deleted through the app's own UI (Settings → Add/Delete Account) — never via raw DB inserts, and never against any of your real existing accounts.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/balanceAdjustment.ts` | **New.** Pure, dependency-free money math: `toCents`, `computeBalanceAdjustment`, `isValidEnteredValue`. |
| `src/lib/balanceAdjustment.test.ts` | **New.** `node --test` coverage for the above. |
| `src/lib/categories.ts` | Add `BALANCE_ADJUSTMENT_TYPE`, `BALANCE_ADJUSTMENT_CATEGORY` constants. `TRANSACTION_TYPES` untouched. |
| `src/db/schema.ts` | Widen `transactions.type`'s TS enum hint by one value. |
| `src/app/actions/accounts.ts` | Add `adjustAccountBalance` action; add one branch to both existing delta loops. |
| `src/app/actions/transactions.ts` | Exclude adjustments from `getHomeData`'s `recent` query; add `includeAdjustments` param to `listTransactions`. |
| `src/app/actions/history.ts` | Thread `includeAdjustments` through `listHistoryItems`. |
| `src/components/ManageList.tsx` | Remove the balance field from the **edit** path only (create path untouched). |
| `src/components/AdjustmentRow.tsx` | **New.** Lightweight, non-interactive display row for a `balance_adjustment` transaction. |
| `src/components/HistoryList.tsx` | Render `AdjustmentRow` instead of `SwipeableTransactionRow` for adjustment rows. |
| `src/components/EditBalanceDialog.tsx` | **New.** Two-step `AlertDialog`: enter new value → confirm computed adjustment. |
| `src/app/accounts/[id]/page.tsx` | Add `EditBalanceDialog` next to the balance hero; fetch history with `includeAdjustments: true`. |

---

### Task 1: Pure balance-adjustment math

**Files:**
- Create: `src/lib/balanceAdjustment.ts`
- Test: `src/lib/balanceAdjustment.test.ts`

**Interfaces:**
- Produces: `toCents(dollars: number): number`; `computeBalanceAdjustment(input: BalanceAdjustmentInput): BalanceAdjustmentResult` where `BalanceAdjustmentInput = { currentBalance: number; enteredValue: number; isLiability: boolean }` and `BalanceAdjustmentResult = { targetBalance: number; deltaCents: number; deltaDollars: number }`; `isValidEnteredValue(enteredValue: number, isLiability: boolean): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/balanceAdjustment.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { toCents, computeBalanceAdjustment, isValidEnteredValue } from './balanceAdjustment.ts';

test('toCents rounds dollars to integer cents, including float-drift inputs', () => {
  assert.equal(toCents(148.9), 14890);
  assert.equal(toCents(0.1 + 0.2), 30); // 0.30000000000000004 in raw JS float
});

test('asset account: balance increasing', () => {
  const r = computeBalanceAdjustment({ currentBalance: 701.10, enteredValue: 850.00, isLiability: false });
  assert.equal(r.targetBalance, 850.00);
  assert.equal(r.deltaCents, 14890);
  assert.equal(r.deltaDollars, 148.90);
});

test('liability account: owed increasing (249.41 -> 300)', () => {
  const r = computeBalanceAdjustment({ currentBalance: -249.41, enteredValue: 300, isLiability: true });
  assert.equal(r.targetBalance, -300);
  assert.equal(r.deltaCents, -5059);
  assert.equal(r.deltaDollars, -50.59);
});

test('liability account: owed decreasing (300 -> 100)', () => {
  const r = computeBalanceAdjustment({ currentBalance: -300, enteredValue: 100, isLiability: true });
  assert.equal(r.targetBalance, -100);
  assert.equal(r.deltaCents, 20000);
  assert.equal(r.deltaDollars, 200.00);
});

test('liability account reaching exactly zero normalizes to +0, not -0', () => {
  const r = computeBalanceAdjustment({ currentBalance: -100, enteredValue: 0, isLiability: true });
  assert.equal(r.targetBalance, 0);
  assert.equal(Object.is(r.targetBalance, -0), false);
  assert.equal(r.deltaCents, 10000);
});

test('no-op when entered value equals current balance exactly (asset)', () => {
  const r = computeBalanceAdjustment({ currentBalance: 500, enteredValue: 500, isLiability: false });
  assert.equal(r.deltaCents, 0);
});

test('no-op when entered value equals current owed exactly (liability)', () => {
  const r = computeBalanceAdjustment({ currentBalance: -249.41, enteredValue: 249.41, isLiability: true });
  assert.equal(r.deltaCents, 0);
});

test('cents precision survives a float-drift-prone current balance', () => {
  let drifted = 0;
  for (let i = 0; i < 3; i++) drifted += 0.1; // 0.30000000000000004
  const r = computeBalanceAdjustment({ currentBalance: drifted, enteredValue: 1, isLiability: false });
  assert.equal(r.deltaCents, 70);
});

test('isValidEnteredValue rejects negative owed for liability accounts', () => {
  assert.equal(isValidEnteredValue(-50, true), false);
  assert.equal(isValidEnteredValue(0, true), true);
  assert.equal(isValidEnteredValue(50, true), true);
});

test('isValidEnteredValue allows negative for asset accounts (overdrawn checking)', () => {
  assert.equal(isValidEnteredValue(-50, false), true);
});

test('isValidEnteredValue rejects non-finite input', () => {
  assert.equal(isValidEnteredValue(NaN, false), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/balanceAdjustment.test.ts`
Expected: FAIL — `Cannot find module './balanceAdjustment.ts'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/balanceAdjustment.ts`:

```ts
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export interface BalanceAdjustmentInput {
  /** Signed dollars: positive for assets, negative for liabilities (owed). */
  currentBalance: number;
  /** What the user typed, in the UI's framing — "Balance" for assets, "Owed" for liabilities. */
  enteredValue: number;
  isLiability: boolean;
}

export interface BalanceAdjustmentResult {
  /** Signed dollars the account balance should become. */
  targetBalance: number;
  /** Signed integer cents to add via the adjustment row. */
  deltaCents: number;
  /** deltaCents / 100 — for building the transaction row's `amount`. */
  deltaDollars: number;
}

export function computeBalanceAdjustment({
  currentBalance,
  enteredValue,
  isLiability,
}: BalanceAdjustmentInput): BalanceAdjustmentResult {
  // `|| 0` normalizes -0 (from `-enteredValue` when enteredValue is 0) to +0 —
  // otherwise a liability reaching exactly $0 owed would carry a -0 balance,
  // and Intl.NumberFormat renders that as "-$0.00".
  const targetBalance = (isLiability ? -enteredValue : enteredValue) || 0;
  const deltaCents = toCents(targetBalance) - toCents(currentBalance);
  return { targetBalance, deltaCents, deltaDollars: deltaCents / 100 };
}

export function isValidEnteredValue(enteredValue: number, isLiability: boolean): boolean {
  if (!Number.isFinite(enteredValue)) return false;
  if (isLiability && enteredValue < 0) return false;
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/balanceAdjustment.test.ts`
Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/balanceAdjustment.ts src/lib/balanceAdjustment.test.ts
git commit -m "Add pure balance-adjustment math with integer-cents tests"
```

---

### Task 2: Type/category constants + schema

**Files:**
- Modify: `src/lib/categories.ts`
- Modify: `src/db/schema.ts:28`

**Interfaces:**
- Consumes: nothing.
- Produces: `BALANCE_ADJUSTMENT_TYPE: 'balance_adjustment'`, `BALANCE_ADJUSTMENT_CATEGORY: 'Balance Adjustment'` from `src/lib/categories.ts`, used by every later task.

- [ ] **Step 1: Add the constants**

In `src/lib/categories.ts`, after the existing `TRANSACTION_TYPES`/`TransactionType` block (do **not** add to `TRANSACTION_TYPES` itself — it drives the type picker):

```ts
export const TRANSACTION_TYPES = ['expense', 'income', 'refund'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// A system-generated transaction kind, deliberately excluded from
// TRANSACTION_TYPES so it can never be manually selected in the type picker.
export const BALANCE_ADJUSTMENT_TYPE = 'balance_adjustment' as const;
export const BALANCE_ADJUSTMENT_CATEGORY = 'Balance Adjustment' as const;

export const DEFAULT_CATEGORY: Category = 'Other';
```

- [ ] **Step 2: Widen the schema's type hint**

In `src/db/schema.ts:28`, change:

```ts
type:            text('type', { enum: ['expense', 'income', 'refund'] }).notNull().default('expense'),
```

to:

```ts
type:            text('type', { enum: ['expense', 'income', 'refund', 'balance_adjustment'] }).notNull().default('expense'),
```

This is a TypeScript-only change — no SQL migration, no `db:generate`/`db:migrate` needed (verified: `transactions.type` is a plain unconstrained `text` column at the DB level; see spec's Data Model section).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (This should also confirm nothing elsewhere does an exhaustive switch over `Transaction['type']` that would now demand a new case — confirmed none exists during spec research, but the typecheck is the real verification.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/categories.ts src/db/schema.ts
git commit -m "Add balance_adjustment as a transaction type (no migration needed)"
```

---

### Task 3: `adjustAccountBalance` action + delta-loop support

**Files:**
- Modify: `src/app/actions/accounts.ts`

**Interfaces:**
- Consumes: `toCents` from `src/lib/balanceAdjustment.ts` (Task 1); `BALANCE_ADJUSTMENT_TYPE`, `BALANCE_ADJUSTMENT_CATEGORY` from `src/lib/categories.ts` (Task 2).
- Produces: `adjustAccountBalance(accountId: string, targetBalance: number): Promise<{ success: boolean; error?: string }>` — used by `EditBalanceDialog` in Task 7. `targetBalance` must already be the correctly-signed target (the caller has already applied the asset/liability sign mapping via `computeBalanceAdjustment`) — this action does not re-derive sign, only the delta.

- [ ] **Step 1: Add imports**

At the top of `src/app/actions/accounts.ts`, add to the existing import block:

```ts
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
```

and add one new import line:

```ts
import { toCents } from '@/lib/balanceAdjustment';
import { BALANCE_ADJUSTMENT_TYPE, BALANCE_ADJUSTMENT_CATEGORY } from '@/lib/categories';
```

- [ ] **Step 2: Add the `balance_adjustment` branch to both delta loops**

In `getAccountBalances` (around line 75-76), change:

```ts
      if (t.type === 'income' || t.type === 'refund') delta += amt;
      else if (t.type === 'expense') delta -= amt;
    }
```

to:

```ts
      if (t.type === 'income' || t.type === 'refund') delta += amt;
      else if (t.type === 'expense') delta -= amt;
      else if (t.type === BALANCE_ADJUSTMENT_TYPE) delta += amt; // amt already signed
    }
```

In `getAccountDetail` (around line 145-146), make the identical change:

```ts
    if (t.type === 'income' || t.type === 'refund') delta += amt;
    else if (t.type === 'expense') delta -= amt;
    else if (t.type === BALANCE_ADJUSTMENT_TYPE) delta += amt; // amt already signed
  }
```

- [ ] **Step 3: Add the `adjustAccountBalance` action**

Append to `src/app/actions/accounts.ts`:

```ts
export async function adjustAccountBalance(
  accountId: string,
  targetBalance: number,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  const detail = await getAccountDetail(accountId);
  if (!detail) return { success: false, error: 'Account not found' };

  // Never trust a client-computed delta — re-derive it here from the
  // account's freshly-read current balance and the requested target.
  const deltaCents = toCents(targetBalance) - toCents(detail.balance);
  if (deltaCents === 0) return { success: true };

  await db.insert(transactions).values({
    id:              randomUUID(),
    userId:          user.id,
    date:            new Date(),
    amount:          deltaCents / 100,
    type:            BALANCE_ADJUSTMENT_TYPE,
    category:        BALANCE_ADJUSTMENT_CATEGORY,
    merchant:        'Balance adjustment',
    description:     'Balance adjustment',
    paymentMethodId: accountId,
  });

  revalidatePath('/accounts');
  revalidatePath('/');

  return { success: true };
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Per Global Constraints, this task's DB behavior is verified later in Task 7 against a throwaway account, not here — there is no test DB to exercise it against in isolation, and calling a `'use server'` action outside a real Next.js request has no auth context to run against.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/accounts.ts
git commit -m "Add adjustAccountBalance action and wire it into balance computation"
```

---

### Task 4: Exclude adjustments from Home "Recent" and main History

**Files:**
- Modify: `src/app/actions/transactions.ts`
- Modify: `src/app/actions/history.ts`

**Interfaces:**
- Consumes: `BALANCE_ADJUSTMENT_TYPE` from `src/lib/categories.ts` (Task 2).
- Produces: `listTransactions(...)` gains an `includeAdjustments?: boolean` param (default `false`); `listHistoryItems(...)` gains the same, passed through. Consumed by Task 6 (Account Detail page passes `true`).

- [ ] **Step 1: Import `ne` and the constant in `transactions.ts`**

Change the drizzle-orm import line:

```ts
import { and, desc, eq, gte, inArray, isNull, lte, like, or } from 'drizzle-orm';
```

to:

```ts
import { and, desc, eq, gte, inArray, isNull, lte, like, ne, or } from 'drizzle-orm';
```

and add to the existing `@/lib/categories` import:

```ts
import { CATEGORIES, DEFAULT_CATEGORY, BALANCE_ADJUSTMENT_TYPE, type TransactionType } from '@/lib/categories';
```

- [ ] **Step 2: Exclude adjustments from `getHomeData`'s `recent` query**

The stats loop itself (`monthTxns`) needs no change — verified it already contributes zero for any unrecognized type. Only the `recent` query changes. In `getHomeData`, change:

```ts
  const [monthTxns, recent] = await Promise.all([
    db.query.transactions.findMany({
      where: and(eq(transactions.userId, user.id), gte(transactions.date, monthStart), lte(transactions.date, monthEnd)),
    }),
    db.query.transactions.findMany({
      where: eq(transactions.userId, user.id),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      limit: 5,
    }),
  ]);
```

to:

```ts
  const [monthTxns, recent] = await Promise.all([
    db.query.transactions.findMany({
      where: and(eq(transactions.userId, user.id), gte(transactions.date, monthStart), lte(transactions.date, monthEnd)),
    }),
    db.query.transactions.findMany({
      where: and(eq(transactions.userId, user.id), ne(transactions.type, BALANCE_ADJUSTMENT_TYPE)),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      limit: 5,
    }),
  ]);
```

- [ ] **Step 3: Add `includeAdjustments` to `listTransactions`**

Change the function signature and query:

```ts
export async function listTransactions({
  query,
  month,
  category,
  account,
  allTime,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
  allTime?: boolean;
}) {
  const user = await getUser();

  let dateFilter;
  if (!allTime) {
    const parsed = month ? parse(month, 'yyyy-MM', new Date()) : new Date();
    dateFilter = and(
      gte(transactions.date, startOfMonth(parsed)),
      lte(transactions.date, endOfMonth(parsed)),
    );
  }

  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      dateFilter,
      category ? eq(transactions.category, category) : undefined,
      account ? eq(transactions.paymentMethod, account) : undefined,
      query ? or(like(transactions.merchant, `%${query}%`), like(transactions.description, `%${query}%`)) : undefined,
    ),
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
  });
}
```

to:

```ts
export async function listTransactions({
  query,
  month,
  category,
  account,
  allTime,
  includeAdjustments,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
  allTime?: boolean;
  includeAdjustments?: boolean;
}) {
  const user = await getUser();

  let dateFilter;
  if (!allTime) {
    const parsed = month ? parse(month, 'yyyy-MM', new Date()) : new Date();
    dateFilter = and(
      gte(transactions.date, startOfMonth(parsed)),
      lte(transactions.date, endOfMonth(parsed)),
    );
  }

  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      dateFilter,
      category ? eq(transactions.category, category) : undefined,
      account ? eq(transactions.paymentMethod, account) : undefined,
      query ? or(like(transactions.merchant, `%${query}%`), like(transactions.description, `%${query}%`)) : undefined,
      includeAdjustments ? undefined : ne(transactions.type, BALANCE_ADJUSTMENT_TYPE),
    ),
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
  });
}
```

- [ ] **Step 4: Thread `includeAdjustments` through `listHistoryItems`**

In `src/app/actions/history.ts`, change:

```ts
export async function listHistoryItems({
  query,
  month,
  category,
  account,
  allTime,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
  allTime?: boolean;
}): Promise<HistoryItem[]> {
  const [txns, transferRows] = await Promise.all([
    listTransactions({ query, month, category, account, allTime }),
    category ? Promise.resolve([]) : listTransfers({ query, month, account, allTime }),
  ]);
```

to:

```ts
export async function listHistoryItems({
  query,
  month,
  category,
  account,
  allTime,
  includeAdjustments,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
  allTime?: boolean;
  includeAdjustments?: boolean;
}): Promise<HistoryItem[]> {
  const [txns, transferRows] = await Promise.all([
    listTransactions({ query, month, category, account, allTime, includeAdjustments }),
    category ? Promise.resolve([]) : listTransfers({ query, month, account, allTime }),
  ]);
```

(The rest of the function is unchanged — omitted here, do not delete it.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/transactions.ts src/app/actions/history.ts
git commit -m "Exclude balance_adjustment from Home Recent and History by default"
```

---

### Task 5: Remove the broken balance field from Settings' edit path

**Files:**
- Modify: `src/components/ManageList.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task only removes code. The **create** path (`handleAdd`, the "Balance" input at the add-row) is untouched.

- [ ] **Step 1: Remove `editBalance` state**

Delete this line (currently line 59):

```ts
  const [editBalance, setEditBalance] = useState('');
```

- [ ] **Step 2: Stop pre-filling it in `startEdit`**

In `startEdit`, delete this line (currently line 69):

```ts
    setEditBalance(item.subtitle?.replace(/[^0-9.-]/g, '') ?? '');
```

- [ ] **Step 3: Stop submitting it in `saveEdit`**

Change:

```ts
    const result = withAccountType && onUpdate
      ? await onUpdate(id, {
          name:            editName.trim(),
          type:            editType,
          startingBalance: editBalance ? parseFloat(editBalance) : undefined,
          institution:     editInstitution,
        })
      : onRename
        ? await onRename(id, editName.trim())
        : { success: false };
```

to:

```ts
    const result = withAccountType && onUpdate
      ? await onUpdate(id, {
          name:        editName.trim(),
          type:        editType,
          institution: editInstitution,
        })
      : onRename
        ? await onRename(id, editName.trim())
        : { success: false };
```

- [ ] **Step 4: Remove the balance input from the edit form's JSX**

Delete this block from the inline edit form:

```tsx
                  {withStartingBalance && (
                    <Input
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value.replace(/[^0-9.-]/g, ''))}
                      inputMode="decimal"
                      placeholder="Balance"
                      className="rounded-lg border-line bg-paper text-sm h-9"
                    />
                  )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`onUpdate`'s prop type still declares `startingBalance?: number` as optional — omitting the key entirely is valid; `updatePaymentMethod` on the server still supports it for anything else that might call it, untouched per Global Constraints.)

- [ ] **Step 6: Manual check**

Run `npm run dev`, open Settings → Accounts, click the pencil icon on any existing account. Confirm: no "Balance" field appears in the edit form (name/type/institution still do); the **add-row** at the top still has its "Balance" field, unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/ManageList.tsx
git commit -m "Remove broken balance field from account edit (creation flow unchanged)"
```

---

### Task 6: Distinct display for adjustment rows + Account Detail wiring

**Files:**
- Create: `src/components/AdjustmentRow.tsx`
- Modify: `src/components/HistoryList.tsx`
- Modify: `src/app/accounts/[id]/page.tsx`

**Interfaces:**
- Consumes: `BALANCE_ADJUSTMENT_TYPE` from `src/lib/categories.ts` (Task 2); `HistoryItem` type from `src/app/actions/history.ts`; `includeAdjustments` param from Task 4.
- Produces: `AdjustmentRow` component, rendered by `HistoryList` for any transaction-kind item whose `type === BALANCE_ADJUSTMENT_TYPE`. Not a `Link` anywhere — deliberately non-navigable (see spec's audit: the generic transaction edit page at `/history/[id]` doesn't know how to handle this type).

- [ ] **Step 1: Create `AdjustmentRow`**

```tsx
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Transaction } from '@/db/schema';

export function AdjustmentRow({ transaction }: { transaction: Transaction }) {
  const amount = Number(transaction.amount);
  const sign = amount >= 0 ? '+' : '';

  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-0 -mx-6 px-6">
      <div className="flex flex-col min-w-0 flex-1 pr-4">
        <span className="text-sm text-ink-faint">Balance adjustment</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint/70 mt-0.5">
          {formatDate(transaction.date, { day: 'numeric', month: 'short' })}
        </span>
      </div>
      <span className="text-sm font-semibold tabular-nums shrink-0 text-ink-faint">
        {sign}{formatCurrency(amount)}
      </span>
    </div>
  );
}
```

(`formatCurrency` already prepends its own "−" for negative amounts via `Intl.NumberFormat` — only the "+" for non-negative needs adding manually, matching the pattern verified during spec research.)

- [ ] **Step 2: Branch on it in `HistoryList`**

Change:

```tsx
import { useState } from 'react';
import { SwipeableTransactionRow } from '@/components/SwipeableTransactionRow';
import { SwipeableTransferRow } from '@/components/SwipeableTransferRow';
import type { HistoryItem } from '@/app/actions/history';
```

to:

```tsx
import { useState } from 'react';
import { SwipeableTransactionRow } from '@/components/SwipeableTransactionRow';
import { SwipeableTransferRow } from '@/components/SwipeableTransferRow';
import { AdjustmentRow } from '@/components/AdjustmentRow';
import { BALANCE_ADJUSTMENT_TYPE } from '@/lib/categories';
import type { HistoryItem } from '@/app/actions/history';
```

and change the render loop:

```tsx
      {items.map((item) =>
        item.kind === 'transfer' ? (
          <SwipeableTransferRow key={item.id} transfer={item} onDeleted={handleDeleted} />
        ) : (
          <SwipeableTransactionRow key={item.id} transaction={item} onDeleted={handleDeleted} />
        )
      )}
```

to:

```tsx
      {items.map((item) =>
        item.kind === 'transfer' ? (
          <SwipeableTransferRow key={item.id} transfer={item} onDeleted={handleDeleted} />
        ) : item.type === BALANCE_ADJUSTMENT_TYPE ? (
          <AdjustmentRow key={item.id} transaction={item} />
        ) : (
          <SwipeableTransactionRow key={item.id} transaction={item} onDeleted={handleDeleted} />
        )
      )}
```

- [ ] **Step 3: Include adjustments on the Account Detail page's own history fetch**

In `src/app/accounts/[id]/page.tsx`, change:

```ts
  const [detail, history] = await Promise.all([
    getAccountDetail(id),
    listHistoryItems({ account: undefined, allTime: true }),
  ]);
```

to:

```ts
  const [detail, history] = await Promise.all([
    getAccountDetail(id),
    listHistoryItems({ account: undefined, allTime: true, includeAdjustments: true }),
  ]);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdjustmentRow.tsx src/components/HistoryList.tsx src/app/accounts/[id]/page.tsx
git commit -m "Render balance adjustments as a distinct, non-navigable row on Account Detail"
```

---

### Task 7: Edit Balance dialog, wired into Account Detail — full acceptance test

**Files:**
- Create: `src/components/EditBalanceDialog.tsx`
- Modify: `src/app/accounts/[id]/page.tsx`

**Interfaces:**
- Consumes: `adjustAccountBalance` from `src/app/actions/accounts.ts` (Task 3); `computeBalanceAdjustment`, `isValidEnteredValue` from `src/lib/balanceAdjustment.ts` (Task 1); existing `AlertDialog*` primitives (`src/components/ui/alert-dialog.tsx`) and `Input` (`src/components/ui/input.tsx`).
- Produces: `<EditBalanceDialog accountId={string} currentBalance={number} isLiability={boolean} />` — a trigger + two-step dialog, self-contained.

- [ ] **Step 1: Create `EditBalanceDialog`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { adjustAccountBalance } from '@/app/actions/accounts';
import { computeBalanceAdjustment, isValidEnteredValue } from '@/lib/balanceAdjustment';
import { formatCurrency } from '@/lib/utils';

interface EditBalanceDialogProps {
  accountId: string;
  currentBalance: number;
  isLiability: boolean;
}

export function EditBalanceDialog({ accountId, currentBalance, isLiability }: EditBalanceDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [value, setValue] = useState(() => String(Math.abs(currentBalance)));
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setStep('input');
    setValue(String(Math.abs(currentBalance)));
    setIsSaving(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  const enteredValue = parseFloat(value);
  const valid = Number.isFinite(enteredValue) && isValidEnteredValue(enteredValue, isLiability);
  const adjustment = valid
    ? computeBalanceAdjustment({ currentBalance, enteredValue, isLiability })
    : null;

  function handleContinue() {
    if (!adjustment) return;
    if (adjustment.deltaCents === 0) {
      setOpen(false);
      reset();
      return;
    }
    setStep('confirm');
  }

  async function handleConfirm() {
    if (!adjustment) return;
    setIsSaving(true);
    const result = await adjustAccountBalance(accountId, adjustment.targetBalance);
    setIsSaving(false);
    if (result.success) {
      toast.success('Balance updated');
      setOpen(false);
      reset();
      router.refresh();
    } else {
      toast.error(result.error || 'Could not update balance');
    }
  }

  const label = isLiability ? 'owed amount' : 'balance';

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === 'input' ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Update {label}</AlertDialogTitle>
            </AlertDialogHeader>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              autoFocus
              className="text-lg tabular-nums"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!valid}
                className="inline-flex items-center justify-center rounded-md bg-ink text-paper text-sm font-medium h-10 px-4 disabled:opacity-40"
              >
                Continue
              </button>
            </AlertDialogFooter>
          </>
        ) : adjustment ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Update {label} to {formatCurrency(enteredValue)}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a balance adjustment of {adjustment.deltaCents >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(adjustment.deltaDollars))}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Wire it into the balance hero**

In `src/app/accounts/[id]/page.tsx`, add the import:

```ts
import { EditBalanceDialog } from '@/components/EditBalanceDialog';
```

Change:

```tsx
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-2">
          {detail.isLiability ? 'Amount Owed' : 'Current Balance'}
        </p>
```

to:

```tsx
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            {detail.isLiability ? 'Amount Owed' : 'Current Balance'}
          </p>
          <EditBalanceDialog accountId={detail.id} currentBalance={detail.balance} isLiability={detail.isLiability} />
        </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Full manual acceptance test**

Run `npm run dev`. Everything below happens against **one throwaway account you create now and delete at the end** — never against an existing real account.

1. Settings → Accounts → add a new **Checking** account named e.g. "TEST DELETE ME", starting balance `$100.00`.
2. Open its Account Detail page. Confirm "Current Balance" shows $100.00, with a small "Edit" control next to the label.
3. Tap Edit, enter `100` (same value) → Continue. Confirm the dialog closes immediately with **no** confirm step and **no** new row in the account's history (no-op path).
4. Add a real expense against this account: `/add` (or Quick Add) → $20 expense, paid from "TEST DELETE ME". Confirm the Account Detail balance now reads $80.00 — this recreates the exact pre-existing-delta condition the original bug happened under.
5. Tap Edit, enter `250.00` → Continue. Confirm the confirm step reads "Update balance to $250.00? This will create a balance adjustment of +$170.00." (i.e. it lands exactly on $250 despite the existing $20 expense, which is the regression test for the reported bug) → Confirm. Balance updates to exactly $250.00; a "Balance adjustment  +$170.00" row appears in this page's own transaction list, styled distinctly (muted, no category tag) and **not tappable**.
6. Go to Home (`/`) and to History (`/history`) — confirm the adjustment does **not** appear in either "Recent" (Home) or the default History list (the $20 expense still does), and that Home's "Spent this month" total is still exactly $20, not $20 + $170.
7. Go to Accounts (`/accounts`) — confirm Net Worth's total assets reflect exactly $250.00 for this account.
8. Now create a second throwaway **Credit Card** account with a starting balance of `-249.41` (i.e. $249.41 owed). On its Account Detail page, confirm the label reads "Amount Owed" and shows $249.41.
9. Tap Edit → enter `249.41` (same value) → Continue. Confirm no-op (dialog closes, no new row) — the liability no-op case.
10. Tap Edit → try entering `-50` → confirm the Continue button stays disabled (non-negative validation).
11. Enter `300` → Continue → confirm reads "...adjustment of −$50.59" → Confirm. Confirm "Amount Owed" now reads $300.00, and Accounts' Net Worth liability total reflects it.
12. Tap Edit → enter `100` → Continue → confirm reads "...adjustment of +$200.00" → Confirm. Confirm "Amount Owed" now reads $100.00 (owed **decreasing** case).
13. Tap Edit → enter `0` → Confirm. Confirm "Amount Owed" reads $0.00 — not "-$0.00", not blank, not NaN (owed **reaching zero** case).
14. Settings → Accounts → edit the "TEST DELETE ME" account's name (not balance) → confirm the edit form has **no** balance field at all, and saving the name still works.
15. In Settings, use the Export buttons (`src/app/settings/ExportButtons.tsx`, calls `exportTransactionsCSV`/`exportTransactionsJSON`) — confirm the adjustment rows appear with `type: "balance_adjustment"` and their correct signed `amount`, not miscategorized as `expense`.
16. Delete both throwaway accounts via Settings.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditBalanceDialog.tsx src/app/accounts/\[id\]/page.tsx
git commit -m "Add Edit Balance dialog to Account Detail page"
```
