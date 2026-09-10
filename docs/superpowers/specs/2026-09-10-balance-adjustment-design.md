# Balance Adjustment — Design Spec

Status: approved by user (with 4 safeguards folded in below), pre-implementation
Sub-project 1 of 2 (sub-project 2: authorized-user/responsibility-based credit card liability — separate spec, later)

## Problem

Editing an account's balance after creation is broken. The edit UI (Settings →
Accounts → pencil icon → inline row edit, in `ManageList.tsx`) does not fail
loudly — it silently produces a wrong number.

### Root cause

Account balance is **not** stored directly. It's computed live on every read:

```
balance = startingBalance + Σ(transactions and transfers touching this account)
```

(`getAccountBalances` / `getAccountDetail`, `src/app/actions/accounts.ts:46-174`)

There's also a `current_balance` column on `payment_methods`, but it is dead:
written once at account creation (mirroring `startingBalance`) and never read
or written again by any app code.

The edit bug:
- `ManageList.tsx:69` pre-fills the edit-balance input from the **computed**
  current balance (`startingBalance + delta`), not from the raw
  `startingBalance` column.
- `ManageList.tsx:78-84` submits whatever's in that field as `startingBalance`.
- `manage.ts:83` (`updatePaymentMethod`) writes it verbatim into the
  `startingBalance` column.

Net effect: saving re-derives `startingBalance` from a number that already
included the delta. On the next read, the delta gets added again, so the
balance silently drifts further from what the user typed — it never lands on
the entered number once any transaction exists on the account.

## Goals

- Let a user set an account's balance to a specific value, at any time, and
  have it actually land on that value.
- Never corrupt `startingBalance` or existing transaction history to do it.
- The mechanism must work identically for asset accounts (balance goes up)
  and liability accounts (owed amount goes up = balance goes down further).
- Net Worth, category spending, and income totals must stay correct with no
  separate/duplicate calculation path.
- Minimal footprint: extend the existing starting-balance + delta model,
  don't introduce a second balance-storage mechanism.

## Non-goals

- Authorized-user / responsibility-based liability exclusion (sub-project 2).
- Editing/correcting `startingBalance` retroactively as a first-class flow
  (creation still sets it once; see "Removed: ManageList balance field"
  below for why we don't keep a second way to touch it).
- Any change to how `expense` / `income` / `refund` transactions are
  categorized, entered, or displayed.

## Data model

Add `'balance_adjustment'` as a valid value of `transactions.type`.

**No SQL migration is required.** `transactions.type` is a plain
`text not null default 'expense'` column at the database level (confirmed in
`supabase/migrations/0001_initial.sql:21` — no CHECK constraint, no Postgres
enum type exists). The `{ enum: [...] }` in `src/db/schema.ts:28` is a
TypeScript-only type hint for Drizzle's inference; it emits no DB constraint.
So this is purely an application-level change:

- `src/db/schema.ts:28` — add `'balance_adjustment'` to the enum list (keeps
  Drizzle's inferred `Transaction['type']` accurate).
- `src/lib/categories.ts:24-25` — **do not** add it to `TRANSACTION_TYPES`
  (that list drives the user-facing type picker in Add/Edit transaction
  forms — `balance_adjustment` must never be manually selectable there).
  Instead export it as a separate, distinctly-named constant (e.g.
  `BALANCE_ADJUSTMENT_TYPE = 'balance_adjustment' as const`) so it's still a
  typed value everywhere it's used, without polluting the picker.
- The fixed `category` value (`'Balance Adjustment'`, below) also can't leak
  into the category picker or `CategoryFilter` — verified both are sourced
  from `getAllCategories()` (a fixed `CATEGORIES` list + user's
  `customCategories` rows), which never scans `transactions.category`
  directly. No extra filtering code needed for this.

### Row shape for an adjustment transaction

| column | value |
|---|---|
| `type` | `'balance_adjustment'` |
| `amount` | **signed** delta (e.g. `148.90` or `-101.10`) |
| `category` | fixed constant `'Balance Adjustment'` — see below |
| `paymentMethodId` | the account being adjusted |
| `merchant` / `description` | `'Balance adjustment'` (fixed, not user-entered) |
| `date` | now |

**`category` stays the fixed string constant, not `null`.** Checked
`src/db/schema.ts:29` — `category: text('category').notNull()`, same for
`merchant`/`description`. Making it nullable would be a schema migration
touching a column every other transaction also uses, which is out of scope
for this fix (user directive: don't touch unrelated legacy fields). The
constant already can't leak into any picker (see above), so nullability buys
nothing here.

### Precision: integer cents for adjustment math

All of `adjustAccountBalance`'s own delta/zero-comparison arithmetic, and the
`EditBalanceDialog`'s client-side "did the number actually change" check, are
done in **integer cents** (`Math.round(dollars * 100)`), not floating-point
dollars — e.g. `deltaCents = Math.round(newBalance * 100) - Math.round(currentBalance * 100)`,
compared against `0` as an integer, only converted back to a dollar float
(`deltaCents / 100`) at the point of building the row to insert. This is
scoped to the new adjustment code only — the existing delta-summation loops
in `getAccountBalances`/`getAccountDetail` keep their current float behavior
unchanged; rewriting how the rest of the app sums money is out of scope here.

**Sign convention is the one deliberate exception in the schema.** Every
other transaction type stores `amount` as a positive magnitude and derives
direction from `type`. `balance_adjustment` is the only type where a single
type value must represent both directions, so it stores the signed delta
directly. This is safe because nothing else treats `amount` as
unconditionally positive at a schema level — direction is already looked up
per-type at every read site (`getAccountBalances`'s delta loop, `getHomeData`'s
stats loop), so adding one type that's signed does not require touching those
call sites' assumptions about other types.

## Server logic

### New: `adjustAccountBalance` server action (`src/app/actions/accounts.ts`)

```
adjustAccountBalance(accountId: string, newBalance: number): Promise<{ success: boolean; error?: string }>
```

1. Load the account and its current **computed** balance (reuse the same
   delta-sum logic `getAccountBalances` already has — factor it out to a
   shared helper if not already reusable per-account).
2. `deltaCents = Math.round(newBalance*100) - Math.round(currentBalance*100)`
   (integer cents — see Precision note above).
3. If `deltaCents === 0`: no-op, return success, create nothing.
4. Otherwise insert one `transactions` row per the shape above with
   `amount = deltaCents / 100`.
5. No changes to `startingBalance` — ever.

This is the **only** write path for post-creation balance changes.

### `getAccountBalances` / `getAccountDetail` (`src/app/actions/accounts.ts`)

Add one branch to the existing delta loop, alongside the current
`expense`/`income`/`refund` handling:

```ts
else if (t.type === 'balance_adjustment') delta += amt; // amt already signed
```

This is the entire change needed for Net Worth correctness — `computeNetWorth`
and `ACCOUNT_GROUPS` read `balance` off the same object they always have, with
no awareness that an adjustment contributed to it.

### `getHomeData` spending stats (`src/app/actions/transactions.ts:307-357`)

**No change required** for the stats loop itself — the type-switch (`if
expense / else if income / else if refund`) has no trailing `else`; an
unrecognized type already contributes zero to `monthSpend`, `todaySpend`,
`monthIncome`, and `categoryTotals` by construction. Verified by reading the
loop, not assumed.

**Change required** for the same function's separate `recent` query
(`transactions.ts:316-320`, feeds the Home page's "Recent" list) — see the
audit table below, this one does need an explicit type filter.

### `listHistoryItems` / `listTransactions` (`src/app/actions/history.ts`,
`src/app/actions/transactions.ts:359+`)

Add an `includeAdjustments?: boolean` option (default `false`) to both
functions, threaded down to a `notInArray`/`ne(transactions.type,
'balance_adjustment')` filter in `listTransactions`'s query when the flag is
off. The main History page (`/history`) calls it with the default (excluded).
The Account Detail page's own history fetch passes `includeAdjustments: true`.

### Removed: Settings → ManageList balance field

`ManageList.tsx` drops the balance input from the **edit** path entirely
(`startEdit`/`saveEdit`/the rendered input) for existing accounts. The
**create** path is untouched — `handleAdd` still collects an initial balance
and writes it to `startingBalance` (and, unchanged, the dead `currentBalance`
column — not worth removing as part of this fix; out of scope).

This leaves exactly one place to change a balance after creation, avoiding
two UIs with different, easily-confused semantics ("starting balance" vs
"current balance").

## UI

### Account Detail page (`src/app/accounts/[id]/page.tsx`)

Add a small "Edit" affordance next to the existing "Current Balance" /
"Amount Owed" hero (§53-73 of the current file). Tapping it opens an
`AlertDialog` (`src/components/ui/alert-dialog.tsx` — same primitive already
used by `DeleteTransactionButton.tsx` / `DeleteTransferButton.tsx`, so this
follows an existing pattern rather than introducing a new one).

Dialog behavior:
- New client component, e.g. `EditBalanceDialog.tsx`, taking the account id,
  current computed balance, and `isLiability`.
- Numeric input, pre-filled with:
  - Asset account: the current balance, framed as "Balance".
  - Liability account: `Math.abs(balance)`, framed as "Owed".
- Liability input is validated non-negative (you can't "owe negative
  dollars" in this framing) — reject/clamp before computing anything.
- On submit, compute the **target signed balance**:
  - Asset: `target = enteredValue`
  - Liability: `target = -enteredValue`
  - `deltaCents = round(target*100) - round(currentBalance*100)` (integer
    cents — see Precision note above)
- If `deltaCents === 0`: close the dialog, no server call, no
  confirmation step.
- Otherwise show a second confirmation step inline in the same dialog (not a
  second dialog), wording adapted to the account framing so it never says
  "balance" for a liability account it's calling "Owed" everywhere else:
  > Update {isLiability ? 'owed amount' : 'balance'} to {formatCurrency(enteredValue)}?
  > This will create a balance adjustment of {delta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))}.
  Cancel / Confirm.
- Confirm calls `adjustAccountBalance(accountId, target)`, then
  `router.refresh()` and closes the dialog. Errors surface via the existing
  `sonner` toast pattern used elsewhere in the app.

### Account Detail transaction history

`HistoryList` (or a light wrapper around it used only on this page) renders a
`balance_adjustment` row distinctly from normal transactions: no category
icon/tag, muted/lighter text weight, label literally "Balance adjustment",
signed amount with its own +/− (not the expense-red/income-black convention
used for normal rows, since this isn't spending or income). Exact visual
treatment is an implementation-time detail, not a design fork — "lighter than
a normal transaction row" is the requirement.

## Audit: every transaction read/export path

Every site that queries the `transactions` table, checked so `balance_adjustment`
can't surface somewhere unintended:

| Path | Includes adjustments? | Why |
|---|---|---|
| `getHomeData` stats loop (spend/income/category) | No (verified — no trailing `else`, contributes 0) | Correct, no change needed |
| `getHomeData` **`recent` query** (Home page "Recent" list, `transactions.ts:316-320`) | **Gap found — needs fix.** Currently unfiltered. | Add a `type !== 'balance_adjustment'` filter here. This list renders through `TransactionRow`, whose `sign()` helper (`type === 'expense' ? '−' : '+'`) assumes every non-expense type stores a positive magnitude — fed a signed adjustment amount, it would double-sign or mis-sign the display (e.g. a `-101.10` row still shown with a `+`). `TransactionRow` is not being made adjustment-aware; instead adjustments simply never reach it. |
| `listTransactions`/`listHistoryItems` (main History page) | No, via new `includeAdjustments` flag (default false) | As designed above |
| Account Detail's own history fetch | Yes, explicitly | As designed above — rendered by a distinct row, not `TransactionRow` |
| `getAccountBalances`/`getAccountDetail` delta sum | Yes, intentionally | This is the entire point of the feature |
| `deletePaymentMethod`'s "has any linked transactions → archive instead of delete" check (`manage.ts:107`) | Yes, unfiltered — correct as-is | An account with an adjustment has real history; archiving instead of hard-deleting is the right call, same as for any other transaction type |
| `exportTransactionsCSV`/`exportTransactionsJSON` (`settings.ts`) | Yes, unfiltered — correct as-is | This is a full data export; adjustment rows carry their real `type`/signed `amount`/`category`, so they're accurately labeled, not miscounted as spending. No spend/category aggregation happens in an export. Intentionally included, not accidentally. |
| `getTransaction(id)` → `/history/[id]` generic edit page | Reachability closed, not code-guarded | The generic edit form doesn't know about `balance_adjustment` (it's excluded from the type picker) — editing one through it would be undefined behavior. Closed by construction: adjustment rows are never rendered as a `Link` anywhere (Account Detail's adjustment row is inert, not clickable). Reaching this page still requires guessing a transaction's raw id directly by URL — deliberately left as an out-of-scope edge case rather than adding a server-side guard, per "keep this tightly scoped"; flagging it explicitly rather than silently ignoring it. |

## Data flow summary

```
User edits balance on Account Detail
        │
        ▼
adjustAccountBalance(accountId, newBalance)
        │
        ├─ delta = newBalance − currentComputedBalance
        ├─ delta == 0 → no-op
        └─ delta != 0 → insert transactions row
                          (type=balance_adjustment, amount=delta)
                                  │
                                  ▼
        Next read of getAccountBalances/getAccountDetail
        naturally includes it in the existing delta sum
                                  │
                                  ▼
        computeNetWorth / ACCOUNT_GROUPS / Account Detail hero
        all update with zero additional logic
```

## Testing / verification

- Asset account, no prior transactions: adjust $0 → $500. Balance reads $500,
  Net Worth's assets total increases by $500.
- Asset account with existing transactions (delta ≠ 0 already): adjust to a
  specific target value; balance reads exactly that value (this is the
  regression test for the reported bug).
- Liability account, owed **increasing**: $249.41 → user enters "Owed: $300"
  → one adjustment row with `amount = -50.59` is created; `computeNetWorth`'s
  `Math.max(0, -balance)` liability sum reflects $300 owed.
- Liability account, owed **decreasing**: $300 → user enters "Owed: $100" →
  adjustment row with `amount = +200.00` (balance goes from -300 to -100);
  liability sum reflects $100 owed.
- Liability account **reaching zero**: $100 owed → user enters "Owed: $0" →
  adjustment row with `amount = +100.00`; balance becomes exactly `0`;
  `computeNetWorth` contributes `Math.max(0, -0) = 0` to liabilities — confirm
  this doesn't render as a negative or NaN anywhere in the UI.
- Entering the same value as current balance → confirm no transaction row is
  created (verify via a direct query count before/after) — test this for
  both an asset and a liability account.
- A liability edit that would drive owed below `$0` (e.g. typing `-50` into
  the "Owed" field) is rejected/clamped client-side before any calculation.
- Cents-precision regression: an account with a current balance that isn't a
  "clean" float in JS (e.g. one produced by summing several `0.1`-style
  transaction amounts) — adjust to a target value and confirm the created
  adjustment's `amount` is exact to the cent, not off by a fraction of a cent.
- Adjustment row does not appear in `/history` by default; does appear on the
  account's own detail page; does **not** appear in the Home page's "Recent"
  list.
- Adjustment row does not move `monthSpend`, `todaySpend`, `monthIncome`, or
  any category's total on the Home page.
- `exportTransactionsCSV`/`exportTransactionsJSON` include the adjustment row
  with its real `type`/signed `amount` — confirm it round-trips legibly, not
  that it's excluded.
- Settings → Accounts edit row no longer shows a balance field; account
  creation flow (with initial balance) is unchanged.

## Rollout

No data migration needed — this only adds a new value to an already-unconstrained
text column and adds new code paths. Existing accounts/transactions are
unaffected until a user performs their first balance edit.
