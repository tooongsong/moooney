import { BALANCE_ADJUSTMENT_TYPE } from '@/lib/categories';

/**
 * Per-entry running balances for one account's ledger.
 *
 * The account detail page previously showed a list of entries and a single
 * total, with the opening balance visible nowhere at all — which is how an
 * account could open at -$1,725.95 for a charge that was also recorded as a
 * transaction, and the duplicate stayed invisible for a month.
 */

export interface LedgerAccount {
  id: string;
  name: string;
}

export type LedgerItem =
  | {
      kind: 'transaction';
      type: string;
      amount: number;
      paymentMethod?: string | null;
      paymentMethodId?: string | null;
    }
  | {
      kind: 'transfer';
      amount: number;
      fromAccount: string;
      fromAccountId?: string | null;
      toAccount: string;
      toAccountId?: string | null;
    };

/** Rows carry an id once backfilled and only a name before that, so a row
 *  belongs to this account if the id matches, or — when it has no id — the
 *  name does. Checking the name on a row that does have an id would make a
 *  renamed account match rows belonging to someone else. */
function belongsTo(id: string | null | undefined, name: string | null | undefined, account: LedgerAccount): boolean {
  return id ? id === account.id : name === account.name;
}

/** How much this entry moves the account's balance. Positive adds. */
export function entryDelta(item: LedgerItem, account: LedgerAccount): number {
  if (item.kind === 'transfer') {
    let delta = 0;
    if (belongsTo(item.fromAccountId, item.fromAccount, account)) delta -= item.amount;
    if (belongsTo(item.toAccountId, item.toAccount, account)) delta += item.amount;
    return delta;
  }

  if (!belongsTo(item.paymentMethodId, item.paymentMethod, account)) return 0;

  // Same branching as the shared aggregator, including the absence of a
  // default case: an unrecognised type contributes nothing rather than
  // guessing a direction.
  if (item.type === 'income' || item.type === 'refund') return item.amount;
  if (item.type === 'expense') return -item.amount;
  if (item.type === BALANCE_ADJUSTMENT_TYPE) return item.amount; // already signed
  return 0;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Walks `itemsOldestFirst` forward from `opening`, tagging each with the
 * balance that stands after it. Rounded to cents at every step: a chain of
 * floating-point additions otherwise puts 0.30000000000000004 on screen.
 */
export function runningBalances<T extends LedgerItem>(
  opening: number,
  itemsOldestFirst: T[],
  account: LedgerAccount,
): (T & { balanceAfter: number })[] {
  let balance = round(opening);
  return itemsOldestFirst.map((item) => {
    balance = round(balance + entryDelta(item, account));
    return { ...item, balanceAfter: balance };
  });
}
