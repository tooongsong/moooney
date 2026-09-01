import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Pencil } from 'lucide-react';
import { AccountTypeIcon } from '@/components/AccountTypeIcon';
import { HistoryList } from '@/components/HistoryList';
import { BottomNav } from '@/components/BottomNav';
import { getAccountDetail } from '@/app/actions/accounts';
import { listHistoryItems } from '@/app/actions/history';
import { formatCurrency } from '@/lib/utils';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, history] = await Promise.all([
    getAccountDetail(id),
    listHistoryItems({ account: undefined, allTime: true }),
  ]);

  if (!detail) notFound();

  // Filter history to this account (by name, since HistoryList items carry paymentMethod name)
  const accountHistory = history.filter((item) => {
    if (item.kind === 'transaction') return item.paymentMethod === detail.name;
    return item.fromAccount === detail.name || item.toAccount === detail.name;
  });

  const balanceDisplay = detail.isLiability && detail.balance < 0
    ? `${formatCurrency(Math.abs(detail.balance))} owed`
    : formatCurrency(detail.balance);

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-paper -mx-6 px-6 py-4 flex items-center justify-between border-b-2 border-ink">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/accounts" className="shrink-0 -ml-1 p-1 text-ink-faint hover:text-ink transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <AccountTypeIcon type={detail.type} className="h-4 w-4 text-ink-faint shrink-0" />
            <span className="text-xl font-bold tracking-tight text-ink truncate">{detail.name}</span>
          </div>
        </div>
        <Link
          href={`/manage`}
          className="shrink-0 -mr-1 p-1 text-ink-faint hover:text-ink transition-colors"
          title="Manage accounts"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      </header>

      {/* Balance hero */}
      <section className="pt-8 pb-6 border-b border-line">
        {detail.institution && (
          <p className="text-xs text-ink-faint mb-1">{detail.institution}</p>
        )}
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-2">
          {detail.isLiability ? 'Amount Owed' : 'Current Balance'}
        </p>
        <p className={`text-6xl font-bold tracking-tighter tabular-nums leading-none ${detail.balance < 0 ? 'text-accent' : 'text-ink'}`}>
          {balanceDisplay}
        </p>
        {detail.isLiability && detail.creditLimit && (
          <p className="text-xs text-ink-faint mt-2">
            {formatCurrency(detail.creditLimit + detail.balance)} available of {formatCurrency(detail.creditLimit)} limit
          </p>
        )}
      </section>

      {/* This month summary */}
      <section className="grid grid-cols-2 gap-4 py-6 border-b border-line">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">This Month In</p>
          <p className="text-lg font-bold text-ink tabular-nums">{formatCurrency(detail.thisMonthIn)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">This Month Out</p>
          <p className="text-lg font-bold text-accent tabular-nums">{formatCurrency(detail.thisMonthOut)}</p>
        </div>
      </section>

      {/* Transaction history */}
      <section className="pt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-4">All Transactions</p>
        <HistoryList transactions={accountHistory} />
      </section>

      <BottomNav />
    </div>
  );
}
