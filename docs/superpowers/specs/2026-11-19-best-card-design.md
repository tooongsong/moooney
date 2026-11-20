# Best Card — Design Spec

Status: design approved in conversation on 2026-11-19. Payment due date added
the same day at the owner's request.

## Problem / Goal

MOOONEY knows which cards exist and what is owed on them, and nothing about
what each one pays back. Standing at a checkout, the question "which card for
groceries?" is answered from memory or not at all.

Best Card records each credit card's cashback rates and turns them into one
page that answers that question per category.

The same cards carry a second question — "when is this one due?" — which the
app also cannot answer today. Each card gets a payment due day, and the next
due date is shown wherever the card is.

## The one rule everything else follows

**A reward rate belongs to a card, and is keyed by the user's own categories.**

No merchant rules, no dates, no caps. A card has a base rate and zero or more
category rates. Everything on the Best Card page is derived from those numbers
at read time; nothing derived is stored.

The due date follows the same shape: the card stores a day of the month, and
the next due date and the days until it are derived from today's date.

## Non-goals

Each of these was considered and left out of this version. The owner's cards
all pay fixed category rates, so none is needed yet.

- **No rotating quarterly categories** and no activation reminders.
- **No spending caps** ("5% on the first $1,500").
- **No merchant-specific rules.**
- **No offers or deals**, and no expiry reminders.
- **No earned-cashback totals** and no "you used the wrong card" hint on
  transactions. Both read existing transactions against these rates and can be
  added later without changing what is stored here.
- **No points.** Rates are percentages. A points card is entered as its rough
  cash equivalent.
- **No screenshot import.** A card has three or four rules; typing them is
  faster and more accurate than recognising them.
- **No built-in catalogue of known cards.** It would go stale and would not
  cover cards like 招行.
- **No notifications.** The app has no push or email channel. A due date that
  is near is shown in accent; nothing is sent.
- **No statement closing date, minimum payment, or "paid" tracking.** The due
  line turns accent when the date is within 7 days and the card has a balance
  owed; paying the balance down is what clears it.

## Data

Two new nullable columns on `payment_methods`:

```
rewards          jsonb    -- { "base": number, "categories": { [category: string]: number } }
payment_due_day  integer  -- day of the month the payment is due, 1–31
```

- Rates are percentages as plain numbers: `3` means 3%. Allowed range 0–100,
  at most two decimal places.
- `null` means the card has no reward rules. `base` defaults to `0` when rules
  exist but no base was entered.
- Only meaningful when `type = 'credit_card'`. Other account types never show
  the editor, and the Best Card calculation ignores them.
- A category key is the category's display name, the same string
  `transactions.category` holds.

Why a column rather than a rules table: the rules are small, always read
together with their card, and never queried on their own. A table would add a
join and a second write path for three or four rows per card.

- `payment_due_day` is a whole number 1–31, or `null` when not set. In a month
  shorter than the day (31 in February), the due date is that month's last day.
  Like `rewards`, it is only read for credit cards.

Migration: `supabase/migrations/0006_card_rewards.sql`, two
`alter table payment_methods add column if not exists …` statements, plus the
matching fields in `src/db/schema.ts`.

### Keeping category names in step

Rules are keyed by category name, so the two actions that change a name must
carry the rules along:

- `renameCustomCategory` — rename the key on every card of that user.
- `deleteCustomCategory` — remove the key on every card of that user.

Hiding a built-in category does not touch the rules; the Best Card page simply
does not list a category that is not in the user's current list (see below).
Showing it again brings the row back.

## Calculation

A pure function in `src/lib/bestCard.ts`:

```
bestCards(cards, categories) -> { rows, fallback }
```

- `cards`: active (non-archived) credit cards with their `rewards`.
- `categories`: the user's current list from `getAllCategories()`.
- `rows`: one per category **in that list** for which at least one card has a
  category rate. Each row carries the highest effective rate and every card
  that reaches it. A card's effective rate for a category is its category rate
  if it has one, otherwise its base rate — so a 2% flat card beats a card paying
  1.5% on groceries.
- `fallback`: the highest base rate and the cards that reach it. This is the
  "everything else" row.
- Rows are ordered by rate, highest first; ties by category name.
- Cards with `rewards = null` are ignored. If no card has rules, `rows` is
  empty and `fallback` is null.

## Next due date

A pure function in `src/lib/paymentDue.ts`:

```
nextDue(dueDay, today) -> { date, daysAway }
```

- `today` is the user's calendar date in their time zone, as the rest of the
  app computes it (`todayIn`).
- The due date is this month's due day if it is today or later, otherwise next
  month's. Either is clamped to the month's last day.
- `daysAway` is 0 on the due date itself.
- `isDueSoon(next, balance)`: true when `daysAway <= 7` and the card has a
  balance owed (`balance < 0`). This is the only thing that turns the line
  accent.

The server computes `nextDue` once per account read and returns it with the
account, so no screen does date arithmetic.

## Screens

### Rewards editor — on the credit card's detail page

`/accounts/[id]`, a new "Rewards" section, rendered only for credit cards.

- A "Payment due" field: day of the month, 1–31, optional.
- A "Base" rate field.
- A list of category → rate rows, each removable.
- An "Add category" control: pick from the user's categories not already used
  on this card, enter a rate.
- Saves through one new server action, `updateCardSettings(id, input)`, which
  validates the rates and the due day, checks the account belongs to the user
  and is a credit card, and stores `null` rewards when base is 0 and there are
  no category rates.

The same page shows the due line under the amount owed: "Due Nov 25 · in 6
days", in accent when due soon.

### Best Card page — `/accounts/best-card`

Reached from a "Best card" link at the top of the Accounts page, beside
"Transfer". Shown only when the user has at least one credit card.

- One row per category from `rows`: the rate as the large numeral ("5%"), the
  category, and the card name or names.
- A final "Everything else" row from `fallback`.
- Empty state, when no card has rules: the big-type empty state the rest of the
  app uses, with a link to the first credit card's detail page to add rates.
- Below the rates, a "Payments due" list: every card with a due day, soonest
  first, each with the same due line and the amount owed. Omitted when no card
  has a due day. Shown even when no card has reward rules.
- Uses the shared `PageHeader` with a back button to Accounts. Works on phone
  and desktop with the same single-column layout; no desktop side panel in this
  version.

### Accounts list

Each credit card row with a due day shows the due line under its name. When
the card also has an institution, both sit on that one line, institution
first, separated by " · ".

Visual language follows the existing design direction: the rate is the
graphic, labels are small, no cards-in-cards, no new colours. Accent is used
for the single highest rate on the page only.

## Error handling

- Invalid rate (not a number, below 0, above 100): rejected by the action with
  a message; the editor keeps the user's input.
- Invalid due day (not a whole number, below 1, above 31): rejected the same
  way. An empty field clears the due day.
- Account not found, not the user's, or not a credit card: the action returns
  an error and writes nothing.
- A rule whose category no longer exists in the user's list is kept in storage
  and skipped by the page. It is shown in the editor, marked as unused, so it
  can be removed.

## Testing

- `src/lib/bestCard.test.ts` (node:test, like the other lib tests): no cards;
  cards without rules; base only; category beats base; another card's base
  beats a category rate; ties list every card; categories outside the user's
  list are skipped; ordering.
- `src/lib/paymentDue.test.ts`: before the day, on the day, after the day;
  December rolling into January; day 31 in a 30-day month and in February;
  due-soon needs both a near date and a balance owed.
- Rename and delete of a custom category update the stored keys — covered by a
  small pure helper (`renameRewardCategory`, `removeRewardCategory`) with its
  own tests, called from the two actions.
- The two screens are checked by hand in the browser at phone and desktop
  widths, light and dark.

## Files

New:
- `supabase/migrations/0006_card_rewards.sql`
- `src/lib/bestCard.ts`, `src/lib/bestCard.test.ts`
- `src/lib/paymentDue.ts`, `src/lib/paymentDue.test.ts`
- `src/components/CardRewardsEditor.tsx`
- `src/components/PaymentDue.tsx` — the one due line all three screens use
- `src/app/accounts/best-card/page.tsx`

Changed:
- `src/db/schema.ts` — the two columns.
- `src/app/actions/accounts.ts` — `updateCardSettings`, and `rewards`,
  `paymentDueDay` and `nextDue` on the account shapes it already returns.
- `src/app/actions/manage.ts` — rename and delete carry the rules.
- `src/app/accounts/[id]/page.tsx` — the Rewards section and the due line.
- `src/app/accounts/page.tsx` — the "Best card" link and the due line.
