# Subscriptions — handover

Everything from the execution ledger that outlives it. The ledger itself lived in
a git-ignored workspace and is gone; this is what was worth keeping.

Branch `worktree-subscriptions`, 95 commits on top of origin/main (16ce8b8).
Final whole-branch review: **mergeable, no Critical, no Important.**

## What still needs you

Nobody has seen any of this signed in. The preview pane has no session, and every
implementer declined to create an account, because that would have written rows to
your database. Behaviour was verified against fixtures, by running the real server
actions in memory against stubs, by reading the code, and by read-only queries.


Why these are open: the database may not be written to and the pane has no session, so every item below needs either a signed-in session, a first real row, a real phone, or a database I may not touch. Each row has the **one action** a person takes. The harness is gone, so actions that used to point at `/dev-preview` now point at the real page. IDs are mine; "From" is the task whose report first carried it.

**A. Needs a signed-in session, no write.**

| # | Not proved | From | The one action |
|---|---|---|---|
| A1 | **The real `/subscriptions` renders its empty state**, the page's Promise.all wiring in the Next runtime, and the add dialog's Category and Pays-from lists from real data | T4/5, T6, T7, T9 | Sign in (`npm run dev` in this worktree, or production after deploy); open `/subscriptions`, `/subscriptions?view=calendar` and `/subscriptions?month=2026-13`: each shows `SUBSCRIPTIONS`, `NOTHING RECURRING.`, `Add subscription` and nothing else, and no error page. Open Add subscription and look at the two lists. |
| A2 | **Step 5: the five existing pages did not move**, and Overview's Recurring row in its real zero state | T6, T9 | Sign in and walk `/`, `/overview`, `/accounts`, `/history`, `/settings` at 1280 and 375. Only two things differ: at 375 Overview has a `Recurring ... Track what renews` row (month arrows leave it unchanged; tapping it lands on `/subscriptions`), and at 1280 the sidebar has a fifth entry, lit only on `/subscriptions`. The bottom nav has four tabs; at 320 `document.documentElement.scrollWidth <= document.documentElement.clientWidth`. |
| A3 | **The signed-in half of the request path**: `getUser()`, `revalidatePath`, `'use server'` serialisation of the finished page (the signed-out half is observed: 307 to `/login`, and a signed-out Save redirects with no toast) | T3 | Covered by A1 and B1: load the finished page signed in. |

**B. Needs a first real row (a write, by you, in the app).** The order below is the order that sets each up for the next; use a throwaway account where marked.

| # | Not proved | From | The one action |
|---|---|---|---|
| B1 | **`saveSubscription` round-trips**: INSERT accepted by Postgres, `anchor_date` reads back unshifted, the month-end clamp, an owned account passes the ownership lookup | T3, T4/5 | Add `Spotify`, 11.99, Monthly, first payment `2026-01-31`, with a Pays-from account. Expect next payment on the 28th, 30th or 31st as the month allows. Then `select anchor_date::text, amount from subscriptions;` |
| B2 | **The Add form reopens blank** after a save | T4/5 | Reopen Add subscription right after saving: Name and Amount empty, date back to today. |
| B3 | **A joined emoji survives the real insert** | T4/5 | Save with a person-at-laptop (U+1F9D1 U+200D U+1F4BB) or a rainbow flag; reopen: the mark and the form show the whole emoji. |
| B4 | **Editing an amount moves the hero exactly**, and a populated Recurring row follows | T4/5, T6 | Edit the amount to 13.99: hero monthly equivalent moves by exactly $2.00; Overview at 375 shows the new `monthly equivalent` figure. |
| B5 | **Pause and Activate** | T4/5 | Pause: active count and hero drop, row reads PAUSED with no next date and shows the pause date. Activate: everything returns and the pause date clears. |
| B6 | **`coalesce` keeps the first stop date across paused to ended** | T3 | Pause one; in the Supabase table editor set its `stopped_on` to an earlier date; click End. It must still read the earlier date (a plain assignment would show today). |
| B7 | **The Step 2 figures with real rows** | T9 | On a throwaway account, or with the others paused, add $7 weekly, $70 monthly, $700 yearly: hero **$158.77**, Annual **$1,905.25** (not $1,905.24), **3** active; Overview's Recurring row reads $158.77. Repeat on production after the deploy. |
| B8 | **The page's own toggle and split, month navigation by clicking, and Confirmed against a real link** | T7 | With a subscription: at 375 tap List and Calendar; at 1280 confirm two columns with a rule between. On the Calendar tab at 375, scroll down about 250px and tap next month: the URL becomes `/subscriptions?view=calendar&month=YYYY-MM`, Calendar stays lit, the page does not jump. |
| B9 | **Linking, end to end against Postgres**: Link on a charge two days off the occurrence; Unlink leaving the transaction untouched; **the two UPDATEs executing at all** (a string into a `date`, a `Date` into `timestamptz`, `returning`, now with the expense predicate); the calendar after `router.refresh()`; the panel in the real dialog | T8, T9 | Open a subscription, tap Link on a past occurrence, pick a charge two days from it: the row reads Confirmed with that charge's amount. Close the dialog and open that month on the Calendar tab: the day reads Confirmed. Unlink, then open History: the transaction is there with the same amount, date and category. |
| B10 | **A billing-day move keeps a confirmed month Confirmed; a stranded link is recoverable** | T8 | Edit First payment date from the 15th to the 20th of the same month: that month still reads Confirmed. Edit it to a later month and reopen: the earlier payment appears under "No longer matches a payment date"; Unlink it and it is offered again beside the occurrence it sits near. |
| B11 | **Deleting a subscription leaves its linked expense** (`ON DELETE SET NULL`, read from the catalog), and the Delete two-step | T3, T4/5, T8 | Delete a subscription that has a linked payment (first click arms "Really delete?", second deletes): the payment remains in History with the link cleared. |
| B12 | **The account guard**: deleting an account a subscription pays from archives it, and it stays selectable | T2, T3 | Create an account with no transactions, point a subscription at it, delete the account in Manage: it archives, no error, and opening the subscription still shows it under Pays from. Repeat with a transfer into a new account in place of the subscription. |
| B13 | **`deleteAllData` clears subscriptions, only the caller's** (and its failure message) | T3 | **Throwaway account only, never the real one:** add a subscription, Settings, Delete all data: the Subscriptions page is empty. |

**C. Needs a device or infrastructure.**

| # | Not proved | From | The one action |
|---|---|---|---|
| C1 | **A real phone**: the day sheet clearing the home indicator (`env(safe-area-inset-bottom)`), the 5px mark initials, the dialog scrolling past the payments to Save, `ResponsiveAmount` fitting under WebKit's font metrics (everything here ran in Chromium emulation) | T7, T8, T9 | On an iPhone, open `/subscriptions?view=calendar` with a subscription, zoom to a day with a mark and tap it: the sheet clears the home indicator. Open a subscription and scroll past the payments to Save. |
| C2 | **Screen-reader behaviour of the grid** (Chrome's computed names were read: `October 5, 3 charges` on a charged day, `01` and disabled on an empty one) | T7 | VoiceOver across the October grid: a charged day announces its date and count, an empty one is dimmed. |
| C3 | **`Intl.Segmenter` on the Dockerfile's `node:20-alpine`** (older ICU; only Node 25.9 was available here) | T3 | Run the one command in `task-3-report.md` (the `docker run --rm node:20-alpine node -e ...` block near the end): it must print `1` seven times, then `2`, `2`. It pulls an image, which I may not do unasked. |
| C4 | **The migration file runs twice cleanly** (reasoned from Postgres source and by evaluating every guard predicate against production; never executed) | T2 | Before relying on `supabase/migrations/0004_subscriptions.sql` for a restore or a fresh database, run it twice on a throwaway Postgres: the second run is a no-op and adds no `transactions_subscription_id_fkey1`. |

**D. After the deploy.**

| # | Not proved | From | The one action |
|---|---|---|---|
| D1 | **Vercel builds it, and the live figures are right** | T9 | After it goes out, open the live site on a phone and a desktop and repeat B7's comparison against production data. |
| D2 | **The live app is unaffected by the two nullable columns** (reasoned: main's code names its columns; the migration has been in production since Task 2) | T2 | Use the live site as normal and add one expense. |

**Closed by this task:** Task 1's open item, `next build` with the `.ts`-extension imports, passed (section 7). The Step 0 behaviours, the arithmetic, and the SQL as sent are now proved in memory and against the live schema (sections 1 and 3); what remains for them is only the writes executing (B9).

---


## The one rough edge, ruled on rather than fixed

The stop-date field in the edit dialog is wired to the three status buttons and
**not** to Save. Edit the date, press Save, and you get "Saved" and the old date —
the only route is to press the current status button again, and nothing says so.
On an active subscription the field also reads "Billing stopped on <today>", which
is not true of a subscription that has not stopped.

It surfaced in the re-review of the one fix wave the process allows after a final
review, so it was adjudicated rather than fixed. The remedy is one hint line under
the field ("Used when you pause or end it") plus wiring the field into Save.

## Rulings

Decisions taken on your behalf while you were not in the loop. Reverse any of them.


1. | T1 | T1 | `dates.ts`: `format` renamed to exported `makeCalendarDate` | **Found: plan said "four call sites" then listed five.** Ruling: five — corrected (todayIn ×1, monthRange ×2, yearRange ×2) |

2. | T4 | fixture vs figures | **Found: the harness hero showed $1,446.89 / $17,362.68, which is not what its own six fixtures sum to.** Ruling: corrected to $228.92 / $2,747.02 — a wrong number on a verification screen sends someone chasing a bug that is not there |

3. | T7 | fixture vs figures | **Found: the MONTH fixture declared expected 54.47 / remaining 39.49; its own byDay map sums to 74.47 / 39.48.** Ruling: corrected |

4. | T9 | arithmetic | **Found: annual equivalent stated as $1,905.24; the code multiplies the *unrounded* monthly sum by 12, giving $1,905.25.** Ruling: corrected, with the reason written beside it — a verification step that is itself wrong is worse than no step |

5. Ruling: deliberate. The in-app browser has no session, so the real page
redirects it to /login. It is gated by `NODE_ENV` and deleted in Task 9.
A reviewer flagging it is right in general and wrong here.
Cost if wrong: a dead route ships; Task 9 Step 6 is the guard.

6. Ruling: match the existing convention rather than refactor three other action
files inside a feature branch. Cost if wrong: a fourth copy to clean up later.

7. Task 1: Ruling: implementer's concern 1 (no test fails when `horizon` is mutated to
`return stop`) — accepted. Every status test asked for a window running past the
status cut-off, so the clamp against the caller's window was untested in the only
direction that matters. Plan amended with two tests; brief regenerated.
Cost if wrong: two redundant tests.

8. Task 1: Ruling: implementer's concern 2 (the DST test does not discriminate) —
accepted. Spring-forward is a 23-hour day, where local-midnight+24h still lands on
the right date; only fall-back catches it. Also `process.env.TZ = prev` writes the
string "undefined" when TZ was unset, leaving later tests in a nonexistent zone.
Plan amended to 2026-11-01 forward / 2026-03-09 backward with a `delete` restore.
Cost if wrong: none — strictly a stronger test.

9. Task 1: Ruling: Important #1 (two surviving mutants) — accepted, tests only. `/ step`
dropped from kStart returns null for any yearly sub >13 months old; `ceil`→`round` in
the weekly first-k emits a date from before the window. Both survive because every
existing yearly test starts within a year of the anchor and the only mid-cycle weekly
test uses a 4-day remainder, the one value where round equals ceil. Two tests added.
Cost if wrong: two redundant tests.

10. Task 1: Ruling: the ⚠️ paused-semantics item — accepted as a SPEC defect and fixed at the
root. A paused subscription ran to today with no paused-on date, so it invented a charge
for every month it stayed paused. `ended_on` becomes `stopped_on`, meaning the day
billing stopped either way, and `horizon` loses its status branch. Task 2 had not run,
so the column was free to rename. Spec and plan both amended (4287e01).
Accepted ceiling, now written into the spec: the months between a pause and a resume
come back as unconfirmed, because one date cannot describe two intervals.
Cost if wrong: a user who pauses and resumes sees a few unconfirmed months to ignore;
the upgrade is a pause-interval table.

11. Task 1: Ruling: Minor #1 (inclusive stop-date boundary untested) — folded in, since
`horizon` was changing anyway. Normally a minor would not enter the loop.

12. Task 1: Ruling: four more surviving mutants (`/ 7` as /6 or /8; monthsToLo `+` as `-` and
`* 12` as `* 13`) — accepted, two tests added (06383e0). Every weekly window in the suite
opened within a week of the anchor and every monthly one within a year, so neither
arithmetic was exercised at a distance — and a subscription a few years old is the normal
case. I verified both expectations independently: 2026-01-01 is a Thursday and +273 days
is 2026-10-01, also a Thursday.
Cost if wrong: two redundant tests.

13. Task 1: Ruling: fix round 2 is the last for this task. The implementer reports the
remaining 18 mutants are output-equivalent, which is the terminating condition — a suite
that can no longer be broken does not need more polishing, and three rounds on one module
is already the ceiling of what this is worth.
Cost if wrong: a mutant nobody has thought of survives into the final review.

14. Task 1: Ruling: re-review Minor #1 (pause→end re-stamps the stop date, bringing the gap
months back) — real, and it lives in Task 3's text, which has not run. Amended now rather
than deferred: `coalesce(stopped_on, today)` so the first stop is the one that counts.
Free to fix before the task exists; would have been a bug if left.
Cost if wrong: a subscription that is paused, then ended, keeps the earlier date — which
is the intended reading of "when did this stop billing".

15. Task 2: Ruling: concern 1 (the new FK blocks account deletion) — accepted, real latent bug.
`deletePaymentMethod` (manage.ts:102) hard-deletes an account with no transactions and
has no try/catch, so the default NO ACTION would have become a 500 the first time a
subscription pointed at that account. Changed to `on delete set null`, matching the
transaction link: removing one record must neither destroy another nor be blocked by one.
Applied three ways — inline for a fresh DB, an idempotent pg_constraint re-create for the
already-applied one, and `{ onDelete: 'set null' }` in drizzle. Step 3 now verifies
confdeltype='n' on both FKs. Committed 132d954.
Cost if wrong: deleting an account silently unsets it on the subscription rather than
warning first.

16. Task 2: Ruling: FK stays NO ACTION. `deletePaymentMethod` gains a subscriptions check that
archives, mirroring the transactions check directly above it. Four lines, no DDL, and
better than set-null besides — the account stays findable and the subscription keeps the
field the user filled in, instead of the account vanishing and the link silently going
null. The earlier 132d954 amendment is reverted by d3bfc46.
Cost if wrong: an account referenced only by a subscription can no longer be hard
deleted, only archived. That is already how an account with transactions behaves.

17. Task 2: Ruling: `create policy` now guarded by a pg_policies check, so the migration file
is re-runnable for a fresh database or a restore. Nothing to re-apply in production.

18. Task 2: Ruling: drizzle's `subscriptionId` now declares `{ onDelete: 'set null' }`, which
the column actually has in production. A schema file that disagrees with the database is
a trap for the next reader.

19. Ruling: the substitutions are net stronger, not weaker — a grep over every query beats one
empirical before-and-after, and an existing column with 129 rows beats a probe row.
Cost if wrong: the paths that genuinely need a write (save round-trip, the coalesce on
paused→ended, link/unlink, the 15th→20th re-anchor) are recorded as UNVERIFIED with a
user checklist rather than claimed as tested.

20. Task 2: Ruling: implementer concern 2 (no ownership check on deletePaymentMethod) —
accepted and escalated. I verified the premise: `select current_user, rolbypassrls`
returns postgres / 1, so RLS does NOT protect the drizzle path — it is defence in depth
for the Supabase API only, and every query must scope itself. updatePaymentMethod and
archivePaymentMethod do; deletePaymentMethod took an id and deleted it. Any signed-in
user could delete another user's account, and this app has more than one account on it.
Fixed in Step 6: getUser(), userId in both the lookup and the delete, early return.
Pre-existing, not introduced here, but fixed because this task rewrites that function
and security is not something to leave adjacent and untouched.
Cost if wrong: deleting a non-owned id becomes a silent no-op returning success —
exactly what archivePaymentMethod already does, so the shapes match.

21. Task 2: Ruling: implementer concern 1 (transfers also NO ACTION and unchecked) — accepted.
An account with a transfer and no transactions already threw a raw constraint error
before this branch existed; production has one transfer. Guarding two of the three
referencing tables and not the third would be arbitrary. Step 7 now includes a
pg_constraint query listing every referencing table, which is the check that would have
caught this.
Cost if wrong: an account with only transfers archives instead of deleting, which is
already how an account with transactions behaves.

22. Task 2: Ruling: Important 2 — my Task 3 Step 3 substitution was WRONG and the reviewer
ran it to prove it. It read `transactions.date` through a raw postgres() client, which
parses date into a JS Date; it is drizzle's mapper that returns the string. The check
printed "IS A DATE OBJECT", the opposite of its stated Expected, and its failure branch
said "stop and fix it here" — it would have sent an executor hunting a bug that is not
there. Rewritten to go through drizzle. It also now says that numeric comes back a
STRING (drizzle's mapper calls String() on the number the driver parsed), which is the
actual reason toNum exists and which my text had backwards.
Cost if wrong: none; this strictly replaces a check that could not pass.

23. Task 2: Ruling: Important 1 — the migration is not idempotent. An inline `references` on
`add column if not exists` is lifted into its own add-constraint during parse analysis,
so a re-run adds transactions_subscription_id_fkey1. Columns now added bare, FK added in
a guarded do-block keyed on the live constraint name. 0002 has the same latent bug, so
the "guarded, unlike the earlier migrations" comment is gone too.
Cost if wrong: reasoned, not executed — no local Postgres and DDL on the project DB is
barred. Recorded as such in the implementer's report.

24. Task 2: Ruling: Important 3 — Task 9 Step 4 still said "with those three present" and
"edit one to $123,456.78", both of which need writes my own constraint forbids. Now
harness fixtures plus the real page's empty state.

25. Task 2: Ruling: Minor 9 — two real product gaps, both folded into Task 3 before it runs.
(a) deleteAllData clears transactions, transfers and categories but not subscriptions,
so the one thing surviving a full wipe would be the schedule of what the user pays for.
(b) getAccountOptions filtered out archived accounts, but deleting an account a
subscription pays from ARCHIVES it — so the edit form would show an empty "Pays from"
and clear the link on the next save, breaking the promise the archive comment makes.
It now takes an `include` id and returns an `archived` flag.

26. Task 2: Ruling: re-review's out-of-scope catch — my getAccountOptions(include?) amendment
had NO CALLER, so the archived account would still have been missing from the picker.
Rewritten parameterless: the rule moved into the query as an `exists` subquery over the
user's subscriptions, which needs no wiring through three components, and the option is
labelled "(archived)" so it does not read as live.
Cost if wrong: one extra subquery on a table with a handful of rows.

27. Task 2: Ruling: ExportButtons is at src/app/settings/, not src/components/ — Task 3's
git add would have failed on the pathspec. Fixed in both places.

28. Task 3: Ruling: concern 1 — MY getAccountOptions threw 42P01 on every call. Under the
relational API the table is aliased "paymentMethods", so the correlated subquery's
"payment_methods" resolves to nothing. The implementer reproduced it read-only and
rebuilt on the core builder; that version is now the plan's.
Cost if wrong: none — the broken one could not run at all.

29. Task 3: Ruling: concern 2 — saveSubscription stored whatever paymentMethodId it was
handed, with no ownership check. Third instance of this same oversight in the codebase
(after deletePaymentMethod and the still-queued updateTransaction/deleteTransaction).
One scoped lookup added before the write.
Cost if wrong: one extra single-row select per save that names a payment account.

30. Task 3: Ruling: concern 3 — an amount >= 10^10 passed validation and overflowed
numeric(12,2), and drizzle's error text (which contains the whole failed statement)
went into a toast. Upper bound added at the validation boundary; every catch now logs
the real error and returns "Could not save. Please try again."
Cost if wrong: a genuine database error is less diagnosable from the UI, and more
diagnosable from the server log, which is where it belongs.

31. Task 3: Ruling: concern 4 — Task 9's grep expectation updated to three named files.

32. Task 3: Ruling: all three of the implementer's round-1 observations accepted into round 2.
(a) The ownership lookup sat outside the try, so a connection failure there rejected the
action instead of returning a result — a 500 where a message belongs. Moved inside.
(b) Three operations all apologised for a failed save; each now names its own verb.
(c) deleteAllData still returned drizzle's raw message, on the one function whose
failure a person reads at the worst possible moment.
Cost if wrong: a real database error is less visible in the UI and more visible in the
server log, which is where it belongs.

33. Task 3: Ruling: Important 1 — the emoji check counted CODE POINTS. My code, my comment,
both wrong in both directions: 🧑‍💻 (3), 🏳️‍🌈 (4), 👨‍👩‍👧 (5), 1️⃣ (3) all rejected as "more than
one emoji"; 🎬🎵 and "ab" accepted. Now Intl.Segmenter, which counts graphemes — the
thing actually being limited. Task 5's maxLength={4} also removed: it counts UTF-16
units and 🏋️‍♀️ is seven, so it would sever the sequence mid-joiner.
Cost if wrong: an optional field with an obvious workaround.

34. Task 3: Ruling: Important 2 — Task 8's plan text re-authored the try placement and the
generic log label that round 2 had just fixed in Task 3. Fixed in the plan before Task 8
runs. This is the second time an amendment to one task undid a fix in another; the
shared `failed()` helper now makes the pattern hard to re-introduce.

35. Task 3: Ruling: Important 3 — Task 9's write-path grep matched "db.update", which finds
ONE of four writes because the rest are chained across two lines. It was the only
automated check of the reverse direction of the one rule, and it could not fail.
Now matches on the method.

36. Task 3: Ruling: minors folded in — 0.004 passed the amount check and stored as 0.00; the
four-line catch comment appeared 3 times and would have been 5 by Task 8, now a
`failed(op, error, message)` helper.

37. Task 3: Ruling: three one-word plan corrections taken — 🏋️‍♀️ is six UTF-16 units not seven
(that comment gets pasted into a component), three of the four writes are chained not
all four, and unlinkTransaction does also set updatedAt.

38. Task 3: Ruling: the emoji predicate gets extracted to lib/utils as `isSingleGrapheme`
with tests. It is the only non-trivial logic in the file, it SHIPPED wrong once, and
npm test could not catch a regression — a server action calling getUser() is not
unit-testable here. The tests assert both halves: each joined emoji is one grapheme,
and Array.from would have returned the code-point count that made the old rule reject
it, so the test documents why the obvious simplification is wrong. Same standard Task 1
held its schedule tests to; inconsistent standards are worse than either.
Cost if wrong: one more round on a task whose review had already passed.

39. Task 3: Ruling: the unbounded grapheme (a letter plus 100k combining marks is one) is
left. Self-inflicted and authenticated, and name/notes/website have no cap either, so
bounding emoji alone would be theatre. Deferred to the final review.

40. Tasks 4+5: Ruling: concern 6a — typing `1,288.88` saved $1.00. parseFloat stops at the
comma and returns 1, which is positive, finite and past every guard. Silent corruption
from an input the app itself teaches, since formatCurrency prints the separator.
parseAmountInput added to lib/utils with tests; the form uses it.
Cost if wrong: a locale that uses comma as the decimal separator would mis-read — the
app is en-US throughout, so not today.

41. Tasks 4+5: Ruling: concern 6b — SubscriptionMark took the first CODE POINT of a name, so
a name starting with a joined emoji rendered as whichever emoji that fragment is. Same
bug class as the Task 3 emoji validator. firstGrapheme added to utils with tests.

42. Tasks 4+5: Ruling: concern 1 — src/proxy.ts (Next 16's middleware) redirects /dev-preview
to /login, so the harness was unreachable. The exemption is now a COMMIT rather than a
temporary edit, Tasks 7 and 8 inherit it, and Task 9 removes it and greps src/ to prove
nothing is left. Two guards: the exemption and the route's own notFound() outside
development.

43. Tasks 4+5: Ruling: MY comma fix introduced a worse bug than the one it fixed. Stripping
every comma made `11,99` read as 1199 — a hundredfold error UPWARD, where the parseFloat
bug was a thousandth downward. Too large is the dangerous direction: a figure you
half-recognise passing a sanity check is how a bad number survives. A comma is now
accepted only where a thousands separator legally sits. I ran all 24 cases myself
before committing the text rather than taking the proposal on trust.
Cost if wrong: someone who means a decimal comma gets a rejection instead of a silent
hundredfold overstatement, which is the right way round.

44. Tasks 4+5: Ruling: Step 7 item 2 said `-5` stays finite; it is NaN, since a minus sign is
not in the grammar. Plan corrected.

45. Tasks 4+5: Ruling: `0,500` read as 500 — [1-9], not \d, for the leading group. Third
revision of parseAmountInput, third bug in it, found unprompted by the implementer.

46. Tasks 4+5: Ruling: Important 1 — the three dialog handlers had no try/finally, so a
failed REQUEST (not a failed action — the actions catch their own errors) left every
control disabled behind a spinner with no toast, and reopening did not clear it because
the re-seed covers nine fields and not `saving`. This is a PWA, so a stale bundle
calling an older deploy's action is a real path. EditBalanceDialog, the model for this
dialog, resets it. try/catch/finally on all three.
Cost if wrong: none; it strictly adds a recovery path.

47. Tasks 4+5: Ruling: Important 2 — parseAmountInput deleted every space and $ wherever they
sat, so `11 99` fused to 1199 and `1$2` to 12. FOURTH revision, and the third instance
of the same hundredfold-upward error, all from one instinct: being forgiving about
characters whose position is the entire meaning. Now trims the ends and takes a leading
symbol only. I ran all 42 cases myself before writing it in.

48. Tasks 4+5: Ruling: three minors folded in — a NaN amount said "must be greater than zero"
to someone who typed 11,99 (worse on a comma-decimal keypad, where the only separator
offered is the rejected one); firstGrapheme returned a stray accent for a name starting
with a combining mark; and Delete armed and confirmed on the SAME button in the same
place, so a double-click deleted — which is exactly what the two-step exists to stop.

49. Tasks 4+5: Ruling: the catch I specified in round 3 swallows Next's redirect. getUser()
calls redirect('/login'), Next signals that by REJECTING the action promise, so a
signed-out save now toasts "could not reach the server" on top of the login page it is
navigating to. My regression, from my own instruction. unstable_rethrow first in each
catch. Cost if wrong: none; it restores the pre-round behaviour exactly.

50. Tasks 4+5: Ruling: cap the fraction at two digits. numeric(12,2) turned 11.999 into 12.00
silently — the same silent-rounding complaint in a different coat — and the cap also
closes the 87-string dot-grouped family. Verified across 49 cases before writing it in.
Cost if wrong: someone typing 3 decimals gets a visible rejection instead of a silent
round. Visible beats silent, which has been the whole theme of this parser.

51. Tasks 4+5: Ruling: name check before amount check, so an untouched form complains about
its first field.

52. Task 6: Ruling: the 320px overflow is left alone, on the reviewer's measurements. Every
FOUR-digit total fits, by half a pixel; overshoot needs $10,000+/month on a screen
under ~328px. The amount is never truncated in any case — what pokes out is the
chevron, into the 24px gutter. The fix (drop `shrink-0`) trades an 8px poke for a row
that grows 49px to 61px on data that will not occur.
Cost if wrong: on a 320px phone with a five-figure monthly total, a chevron sits in
the gutter. Recorded with the exact remedy if it ever matters.

53. Task 7: Ruling: the implementer's radius deviation is ADOPTED. I checked globals.css —
--radius-lg is 16px and --radius-xl is 20px, so rounded-xl was genuinely off the
16/24/pill scale. It was right and my brief was wrong.

54. Task 7: Ruling: its import deviation was right too. My brief's drizzle line predated the
amendments that added `exists` and `or`, so following it literally would have broken
getAccountOptions. Dropping `desc` was correct; Task 8's brief now adds it itself
rather than assuming it.

55. Task 7: Ruling: two deferred observations closed rather than carried. (a) A four-digit
year still passes the month-key guard while being nonsense — makeCalendarDate does not
pad the year, so "0001-05" becomes "1-05-01", which no column accepts. (b) The day
cells announce only their number, because every mark is aria-hidden — so a screen
reader had no way to tell which days carry a charge, which is the whole grid.
Accessibility basics are not something to simplify away.

56. Task 7: Ruling: the implementer's `year < 9999` deviation ADOPTED, and its root cause
accepted for fixing. BEST CATCH OF THE RUN SO FAR. This module's one load-bearing
assumption is that zero-padded dates compare chronologically as strings. That dies at
year 10000: "10000-01-07" <= "9999-12-31" sorts TRUE because "1" precedes "9". The
weekly loop ended on exactly that compare, so a weekly subscription anchored in 9999
built 4.7 million dates and 1.9GB — reachable from a URL, and also from a mistyped
anchor date, where it cost 1.7s per page load with the right answer.
Fixed at the root in subscriptionSchedule.ts: both weekly bounds are now integers
computed up front, matching what the monthly and yearly paths always did. I verified
the rewrite against all six existing weekly cases myself — identical output.
Cost if wrong: the weekly path is the one every fixture in the calendar exercises, so
a mistake here is loud rather than quiet.

57. Task 7: Ruling: five minors closed before Task 8 rather than deferred.
(a) A yearly subscription matches by YEAR but links were fetched by MONTH — edit a
renewal from March to May after March was paid and the calendar says Unconfirmed while
Task 8's history says Confirmed. Two views of one payment disagreeing is worse than a
wider query; the range widens to the year when any yearly subscription exists.
(b) "Remaining" counted charges already paid, overstating what the rest of the month
costs. Now excludes confirmed.
(c) Month navigation reset the phone's scroll (confirmed in the Next 16.1.1 source);
the calendar sits ~530px down, so every step threw you to the top. scroll={false}.
(d) The day sheet emptied before its 200ms exit animation finished.
(e) The drizzle import line still prescribed the version that breaks getAccountOptions.

58. Task 7: Ruling: the implementer caught that MY comment was false — toCalendarDate does
NOT enforce years 1000-9999, it accepts any four digits (verified: '0999-05-01' and
'0000-01-01' both pass). Chasing why turned up the MIRROR of the year-10000 bug: a
date field holding 0202 reaches makeCalendarDate, which pads month and day but not
the year, and builds "202-01-01" — which sorts AFTER "2026-01-01".
Fixed by padding the year, which makes the invariant true rather than narrowing it.
Ordinary years byte-identical (checked). The header paragraph is being rewritten to
stop blaming toCalendarDate and to point at the integer loop bounds as the reason the
remaining year-10000 limit is harmless.
Cost if wrong: one padStart on a function every date in the app flows through — which
is exactly why it has a test either way.

59. Task 7: Ruling: the guard comment is now false in three places and is corrected. The
lower bound still earns its place for a DIFFERENT reason than I wrote — Date.UTC reads
years 0 to 99 as 1900 to 1999, so "0050-01" would quietly become 1950 (measured).
A guard whose comment is wrong is a guard someone deletes.

60. Task 7: Ruling: three comment corrections taken. The guard said "neither is about string
order"; the UPPER bound is. And the live reason for the lower bound is wider than
Date.UTC — `key` and `shiftMonth` both build "YYYY-MM" by hand without padding the
year, so a three-digit year yields a key its own shape check rejects. remaining's
JSDoc still described what it counted before it began excluding confirmed charges.
The source-side copies of these go into Task 8, which edits the same file.

61. Task 8: Ruling: min-w-0 deviation ADOPTED — a grid item will not shrink, and the brief's
markup overflowed the real dialog (column 361.7px against 327; scrollWidth 410 over
375). Measured both ways.

62. Task 8: Ruling: THE STRANDED LINK IS A HOLE IN MY SPEC, not just a UX gap. The spec names
this ceiling and says it is "fixed by re-linking" — but a linked transaction is
excluded from every candidate list, so the stranded link was invisible and unreachable
and the documented remedy did not exist. getSubscriptionHistory now returns `orphaned`
(links whose period key matches no occurrence in the series) and the panel lists them
with Unlink.
Cost if wrong: a section that stays empty for every subscription whose anchor never
moved across a month, which is almost all of them.

63. Task 8: Ruling: no try/finally — MY omission, and the second time. The dialog got this in
Tasks 4+5 and I failed to carry it to the panel. Both handlers now have
try/catch/finally with unstable_rethrow first.

64. Task 8: Ruling: three more accepted — "no unlinked transactions" shown while still
loading (candidates is now `| null`); candidates not filtered to expenses, so an
income row or refund could be linked as a payment and read Confirmed against money
that came IN; and the occurrence state, the thing being read, rendered in the faintest
ink available.

65. Task 8: Ruling: two remaining uncaught paths closed — the panel's first load (spinner up
for good behind an uncaught rejection) and openPicker (hung on "Looking…"). The picker
falls back to an empty list rather than a spinner, since a list you can close beats one
that never resolves.

66. Task 8: Ruling: the early return `data.occurrences.length === 0` hid stranded links when
the series had no live occurrences — which would have quietly undone the stranded-link
fix in exactly the case where a moved anchor is most likely to have left one. Now
returns null only when there is nothing of either kind.

67. Task 8: Ruling: Important 1 — the picker's 21-day window with a 25-row cap ordered
NEWEST first silently dropped the older half, which is exactly where a charge posted
on or before the stated day lives. Routine after a statement import. Now ordered by
distance from the occurrence, with a note when it is at the cap. It is also the last
hop of the stranded-link remedy, so the cap could strand a link permanently.

68. Task 8: Ruling: Important 2 — MY loading-state fix reintroduced the lie it fixed. The
catch set candidates to [], so a failed request printed "No unlinked expense within
ten days". Three states now: loading, failed, rows.

69. Task 8: Ruling: four minors folded in — a sequence guard on openPicker (taps outrunning
responses could link a payment to the WRONG occurrence, a correctness bug not a
flicker); isNull on the link UPDATE (a stale device could move an already-linked
transaction and silently revert what it confirmed); a failing reload after a
successful write reported as a failed write; and the state rule's three copies
collapsed into one tested function — the shape of defect Task 7's own comment warns
about. The harness shim holds a fourth copy and now points at the same function.

70. Task 8: Ruling: `expected $X` moved from ink-faint (~2.6:1) to ink-soft in both the panel
and the calendar dialog. It is the price-rise signal the spec says people look for.

71. Task 8: Ruling: LINK_CANDIDATE_LIMIT cannot live in the actions file — a "use server"
file may export only async functions. The implementer's move to the schedule module is
adopted. Worth recording: tsc and all 171 tests stayed GREEN; only `npm run build`
caught it. Third time in this branch the build was the only gate that fired.

72. Task 8: Ruling: two of its three observations accepted. The cap note advised "unlink
something else", which does nothing for a charge the cap dropped — unlinking a
different transaction cannot bring a 26th-nearest one into view. And same-day rows tie
on both sort keys, so which survived the cap was whatever order Postgres returned;
asc(id) as the last key makes it stable. The capped scenario lands on exactly that tie.

73. Task 8: Ruling: three stale imports in MY plan, found by applying the briefs verbatim and
running tsc. The committed code was right throughout. Applying a brief literally and
typechecking it is a check worth having, and it is the fourth time the plan drifted
from the code after an amendment.

74. Task 8: Ruling: six carried-over fixes folded into Task 9 Step 0 rather than a fifth
round. Three matter: `remaining` re-spelled the occurrence boundary two lines from the
call computing it (the exact divergence the docblock warns about); the equal-distance
tiebreak preferred the day AFTER over the day before, against the reasoning that put
distance first; and the link UPDATE trusted the picker's expense filter rather than
enforcing it where the write happens.


## Deferred minors

Known, triaged as safe to carry, listed so they are not rediscovered as surprises.


- Task 1: minor (deferred): the `- 1` in kStart can never be load-bearing and its comment
claims otherwise — delete it or reword as defence in depth.

- Task 1: minor (deferred): `nextOccurrence`'s `today` parameter is provably dead (non-active
returns null before it is read). Kept for symmetry with occurrencesBetween's signature;
the final review should decide.

- Task 1: minor (deferred): `npm test` prints MODULE_TYPELESS_PACKAGE_JSON once per file.
`--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` was verified to silence it. Do NOT
take the warning's own advice of adding "type": "module" — that changes how every
config file in the Next project loads.

- Task 1: minor (deferred): `makeCalendarDate` neither validates nor normalises
(2026-02-30 round-trips) and now sits exported beside the validating `toCalendarDate`.
One doc line would stop a later task using it on form input.

- Task 1: minor (deferred): `Date.UTC(yearOf(d), monthOf(d) - 1, dayOf(d))` written out four
times in dates.ts.

- Task 1: minor (deferred): SUBSCRIPTION_CYCLES / SUBSCRIPTION_STATUSES are typed `T[]`
rather than `as const`, so the literals are written twice and `z.enum` would reject them.
Task 3 consumes both, so they are not dead.

- Task 1: minor (deferred): the `stoppedOn ?? today` fallback comment claims it covers rows
predating the column; no such row can exist, since Task 2 creates the table with it and
setSubscriptionStatus is the only writer. Reword at the final review.

- Task 1: minor (deferred): no test pins that an ACTIVE row with a leftover stoppedOn still
returns every occurrence. Unreachable today — setSubscriptionStatus always clears it.

- Task 2: minor (deferred): no backstop if a referencing row is inserted between the
pre-checks and the delete — catching SQLSTATE 23503 and archiving would close it.

- Task 2: minor (deferred): Step 7's list numbers render 1-2-3-4 with a stray "3b", and the
plan's self-review section cites step numbers that later amendments renamed.

- Task 2: minor (deferred): the migration comment asserts "0002 has the same latent bug",
which goes stale if the queued 0002 fix lands — same class as the sentence just removed
from schema.ts.

- Task 2: minor (deferred): manage.ts:103 says "every query here scopes itself to the
caller", which is wider than the code — the three reference checks are keyed on the
verified account.id and MUST NOT be owner-filtered, since the FK fires on any
referencing row. The comment could invite someone to "fix" that into a bug.

- Task 2: minor (deferred): no backstop if a referencing row lands between the pre-checks
and the delete (catch SQLSTATE 23503 → archive).

- Task 3: minor (deferred): ExportButtons says "categories" where only CUSTOM categories are
deleted, and its toast says "All data deleted" although accounts survive. Pre-existing.

- Task 3: minor (deferred): `a` and `1` pass the emoji rule. Correct — it limits how many,
not which — and the new test says so explicitly.

- Task 3: minor (deferred): `grapheme && value.length <= 8` survives all four tests, because
the longest row is 8 UTF-16 units. One row with the family-of-four (11 units) would kill
caps up to 10. Matters only if someone later adds a length bound.

- Tasks 4+5: minor (deferred): a status button saves and closes, dropping unsaved field
edits with no warning.

- Tasks 4+5: minor (deferred): plan doc — Task 4 Step 9 still says preview_start by name,
and "### Reaching the harness" sits in Task 7 though Tasks 4-5 needed it first.

- Tasks 4+5: minor (deferred): the OS double-click window runs to ~500ms, and holding Enter
auto-repeats click — a timestamp guard cannot close an arbitrarily slow repeat; that
needs a different control, which is a design change.

- Tasks 4+5: minor (deferred): firstGrapheme still yields an invisible glyph for a name
starting with U+3164 (Hangul filler) or U+2800 (Braille blank) — categories Lo and So,
so outside the M/Cf/space strip.

- Tasks 4+5: minor (deferred): the same four-line redirect comment appears in all three
catches, and unstable_rethrow is a second import from 'next/navigation' rather than
merged into the existing one. Both are mine, from the plan.

- Tasks 4+5: minor (deferred): app-router.js does not check error.handled the way
redirect-boundary.js does, so a rethrown action redirect triggers a second router.push
after the reducer's own navigation. Benign — HistoryUpdater pushes only when the URL
differs — and the pre-round-3 code did the same.

- Tasks 4+5: minor (deferred): unstable_rethrow is unstable_-prefixed; re-check on the next
Next major.

- Task 6: minor (deferred): /overview now depends on the subscriptions query inside an
unguarded Promise.all, so the migration must be applied wherever this code runs. It
matches the page's other four calls.

- Task 6: minor (deferred): a comment says desktop "never renders" the row; it is in the
HTML and hidden by CSS. Brief-verbatim wording of mine.

- Task 7: minor (deferred): month navigation will probably scroll the phone to the top —
real, but a scroll-restoration question belonging to the page, not the calendar.

- Task 7: minor (deferred): the harness mirrors the page's toggle and split by hand copy,
so the page's own markup for those is unverified. Inherent to having no session.

- Task 7: minor (deferred): the cell shows "05" while its accessible name says "5".
Deliberate — "October five" is what a person says.

- Task 7: minor (deferred): the 32px sheet radius is off the 16/24/pill scale but matches
all four sheets in the app (MonthPicker, YearPicker, SubscriptionDialog, this one).
Needs a ruling on whether sheets are exempt, not a one-file change.

- Task 7: minor (deferred): 5px mark initials and 8px +N. Deliberate — the grid says
"something is here" and the aria-label and sheet say which.

- Task 7: minor (deferred): getMonthOccurrences re-authenticates and re-reads subscription
rows, including on the empty-state page that does not render it.

- Task 7: minor (deferred): Date.UTC's 0-99 century rule is a real edge in arithmetic
rather than string order. Not reachable from the calendar, and a mistyped anchor still
yields sane schedules. Its best fix is in toCalendarDate rather than any one caller,
which makes it a different change from this task's.

- Task 7: minor (deferred): subscriptionSchedule.ts:80 still says "the loop never ends" in
SOURCE; the plan has the corrected wording. Source and plan disagree — sync in Task 8.

- Task 7: minor (deferred): the `paid` map is last-write-wins over an unordered query, and
nothing enforces one link per period. Unreachable through the UI — a confirmed
occurrence offers Unlink, not Link — but the yearly widening gives it more exposure.
One-line remedy if it ever matters: order the link query by subscription_period, which
turns "whichever row came back last" into "the latest period in the year".

- Task 7: minor (deferred): findings 1 and 2 have no in-repo test; their evidence is a
scratchpad harness, so `npm test` would not catch a revert.

- Task 8: minor (deferred): the 12-row reach limit; "Payments" heading over a list that is
mostly expectations; rows not naming which transaction is linked; the shim's fetch
patch surviving a soft navigation in dev.

- Task 8: minor (deferred): a refused link keeps the stale candidate list. Visible and
recoverable — the toast says what happened and the next Link re-fetches.

- Task 8: minor (deferred): the cap note also shows when exactly 25 match and nothing was
dropped — true as written; an exact signal needs limit+1 and a slice.

- Task 8: minor (deferred): a silent swallowed refresh leaves a stale screen with nothing
saying so; replaying an identical link is refused as stale.

