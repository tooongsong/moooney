import Link from 'next/link';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Transaction } from '@/db/schema';

const TYPE_STYLES: Record<Transaction['type'], string> = {
  expense: 'text-ink',
  income: 'text-emerald-600',
  refund: 'text-sky-600',
};

const DOT_STYLES: Record<Transaction['type'], string> = {
  expense: 'bg-accent',
  income: 'bg-emerald-600',
  refund: 'bg-sky-600',
};

function sign(type: Transaction['type']) {
  return type === 'expense' ? '-' : '+';
}

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  return (
    <Link href={`/history/${transaction.id}`}>
      <div className="group flex items-center justify-between py-3.5 border-b border-line last:border-0 hover:bg-sand/50 -mx-2 px-2 transition-colors cursor-pointer">
        <div className="flex items-center gap-3.5 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', DOT_STYLES[transaction.type])} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-ink truncate">{transaction.merchant}</span>
            <span className="text-xs text-ink-faint flex items-center gap-1.5 min-w-0">
              <span className="truncate uppercase tracking-wide">{transaction.category}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-ink-faint shrink-0" />
              <span className="shrink-0">{formatDate(transaction.date, { day: 'numeric', month: 'short' })}</span>
              {transaction.paymentMethod && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-ink-faint shrink-0" />
                  <span className="truncate">{transaction.paymentMethod}</span>
                </>
              )}
              {transaction.needsReview && (
                <span className="shrink-0 text-accent font-medium">· Review</span>
              )}
            </span>
          </div>
        </div>
        <span className={cn('text-sm font-bold tabular-nums shrink-0 ml-2', TYPE_STYLES[transaction.type])}>
          {sign(transaction.type)}
          {formatCurrency(transaction.amount)}
        </span>
      </div>
    </Link>
  );
}
