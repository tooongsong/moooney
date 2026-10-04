import { formatCurrency, formatSignedCurrency, formatDate } from '@/lib/utils';
import type { TransactionListRow } from '@/app/actions/transactions';

export function AdjustmentRow({
  transaction,
  balanceAfter,
  proportion,
}: {
  transaction: TransactionListRow;
  /** Balance standing after this entry. Shown only on an account's own
   *  ledger — across accounts a running balance means nothing. */
  balanceAfter?: number;
  /** 0–1 against the largest amount on screen. A hairline under the merchant
   *  name, so magnitude reads without the amount type changing size. */
  proportion?: number | null;
}) {
  const amount = Number(transaction.amount);
  const sign = amount >= 0 ? '+' : '';

  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-0 -mx-6 px-6">
      <div className="flex flex-col min-w-0 flex-1 pr-4">
        <span className="text-sm text-ink-faint">Balance adjustment</span>
        <span className="flex items-baseline gap-1 text-[10px] font-semibold uppercase tracking-widest text-ink-faint/70 mt-0.5">
          <span className="truncate">
            {formatDate(transaction.date, { day: 'numeric', month: 'short' })}
          </span>
          {balanceAfter !== undefined && (
            <span className="shrink-0 tabular-nums">· {formatSignedCurrency(balanceAfter)}</span>
          )}
        </span>
        {proportion != null && (
          <span
            aria-hidden
            className="block h-[2px] rounded-full mt-1.5 transition-[width]"
            style={{
              width: `${Math.max(2, proportion * 100)}%`,
              background: proportion >= 1 ? 'var(--accent)' : 'var(--ink)',
            }}
          />
        )}
      </div>
      <span className="text-sm font-semibold tabular-nums shrink-0 text-ink-faint">
        {sign}{formatCurrency(amount)}
      </span>
    </div>
  );
}
