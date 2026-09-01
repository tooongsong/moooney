import Link from 'next/link';
import { ArrowRight, Settings2, Wallet2 } from 'lucide-react';
import { getHomeData } from '@/app/actions/transactions';
import { getAccountBalances } from '@/app/actions/accounts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TransactionRow } from '@/components/TransactionRow';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { AccountTypeIcon } from '@/components/AccountTypeIcon';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { BottomNav } from '@/components/BottomNav';

export default async function HomePage() {
  const [{ monthSpend, todaySpend, monthIncome, monthBalance, categoryData, recent }, accounts] = await Promise.all([
    getHomeData(),
    getAccountBalances(),
  ]);

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <header className="sticky top-0 z-30 bg-paper -mx-6 px-6 py-4 flex items-center justify-between border-b-2 border-ink">
        <span className="text-xs text-ink-faint font-semibold uppercase tracking-widest">
          {formatDate(new Date(), { month: 'long', year: 'numeric' })}
        </span>
        <HeaderIconButton href="/manage" className="-mr-2">
          <Settings2 />
        </HeaderIconButton>
      </header>

      {/* Hero: this month's spend */}
      <section className="pt-8 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-2">Spent this month</p>
        <p className="text-7xl font-bold tracking-tighter text-ink tabular-nums leading-none">
          {formatCurrency(monthSpend)}
        </p>
      </section>

      {/* Today / Income / Balance */}
      <section className="grid grid-cols-3 gap-4 pb-8 border-b border-line">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Today</p>
          <p className="text-lg font-bold text-accent tabular-nums">{formatCurrency(todaySpend)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Income</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(monthIncome)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Balance</p>
          <p className={`text-lg font-bold tabular-nums ${monthBalance >= 0 ? 'text-ink' : 'text-accent'}`}>
            {monthBalance >= 0 ? '+' : '-'}
            {formatCurrency(Math.abs(monthBalance))}
          </p>
        </div>
      </section>

      {/* Accounts */}
      {accounts.length > 0 && (
        <section className="py-8 border-b border-line">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Accounts</h2>
            <Link href="/accounts" className="text-xs text-ink-faint hover:text-ink transition-colors flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex overflow-x-auto no-scrollbar -mx-6 px-6">
            {accounts.map((account, i) => (
              <Link
                key={account.id}
                href={`/history?account=${encodeURIComponent(account.name)}`}
                className={`shrink-0 min-w-[9.5rem] pr-6 ${i > 0 ? 'pl-6 border-l border-line' : ''}`}
              >
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-faint truncate mb-1">
                  <AccountTypeIcon type={account.type} className="h-3 w-3 shrink-0" />
                  {account.name}
                </p>
                <p className="text-2xl font-bold tracking-tight text-ink tabular-nums">
                  {formatCurrency(account.balance)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Category breakdown */}
      <section className="py-8 border-b border-line">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-5">By category</h2>
        <CategoryBreakdown data={categoryData} />
      </section>

      {/* Recent transactions */}
      <section className="pt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Recent</h2>
          {recent.length > 0 && (
            <Link href="/history" className="text-xs text-ink-faint hover:text-ink transition-colors flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-12 text-ink-faint text-sm border border-dashed border-line mt-4">
            <Wallet2 className="h-6 w-6 mx-auto mb-3 text-ink-faint" />
            <p>No transactions yet.</p>
            <Link href="/add" className="inline-block mt-4 text-ink font-medium underline underline-offset-4">
              Add your first one
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {recent.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
