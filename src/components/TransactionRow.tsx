import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { withBackTarget } from '@/lib/backTarget';
import type { Transaction } from '@/db/schema';
import type { TransactionListRow } from '@/app/actions/transactions';

function sign(type: Transaction['type']) {
  return type === 'expense' ? '−' : '+';
}

// Only rendered on Home, so the origin is known without reading the URL —
// which this server component could not do anyway.
const HOME = '/';

export function TransactionRow({ transaction }: { transaction: TransactionListRow }) {
  return (
    <Link href={withBackTarget(`/history/${transaction.id}`, HOME)}>
      <div className="flex items-center justify-between py-4 border-b border-line last:border-0 -mx-6 px-6 active:bg-sand/50 transition-colors">
        <div className="flex flex-col min-w-0 flex-1 pr-4">
          <span className="text-base font-semibold text-ink truncate leading-snug">
            {transaction.merchant}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mt-0.5 truncate">
            {transaction.category}
            {' · '}
            {formatDate(transaction.date, { day: 'numeric', month: 'short' })}
            {transaction.paymentMethod ? ` · ${transaction.paymentMethod}` : ''}
            {transaction.needsReview ? ' · Review' : ''}
          </span>
        </div>
        <span className="text-base font-bold tabular-nums shrink-0 text-ink">
          {sign(transaction.type)}{formatCurrency(transaction.amount)}
        </span>
      </div>
    </Link>
  );
}
