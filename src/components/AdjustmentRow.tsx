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
