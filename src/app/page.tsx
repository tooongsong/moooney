import Link from 'next/link';
import { ArrowRight, Settings2 } from 'lucide-react';
import { getHomeData } from '@/app/actions/transactions';
import { getAccountBalances } from '@/app/actions/accounts';
import { formatDate } from '@/lib/utils';
import { TransactionRow } from '@/components/TransactionRow';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';

function splitCurrency(amount: number) {
  const abs = Math.abs(amount);
  const dollars = Math.floor(abs);
  const cents = Math.round((abs - dollars) * 100);
  return { dollars: dollars.toLocaleString(), cents: cents.toString().padStart(2, '0') };
}

export default async function HomePage() {
  const [{ monthSpend, todaySpend, monthIncome, monthBalance, categoryData, recent }] = await Promise.all([
    getHomeData(),
    getAccountBalances(),
  ]);

  const hero = splitCurrency(monthSpend);
  const balanceSplit = splitCurrency(monthBalance);

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <header className="sticky top-0 z-30 bg-paper -mx-6 px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 flex items-center justify-between">
        <span className="text-xs text-ink-faint font-semibold uppercase tracking-widest">
          {formatDate(new Date(), { month: 'long', year: 'numeric' })}
        </span>
        <HeaderIconButton href="/manage" className="-mr-2">
          <Settings2 />
        </HeaderIconButton>
      </header>

      <QuickAddIsland />

      {/* Hero: this month's spend */}
      <section className="pt-8 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-3">Spent this month</p>
        <div className="flex items-end gap-1 leading-none">
          <span className="text-[4.5rem] font-bold tracking-tighter text-ink tabular-nums leading-none">
            ${hero.dollars}
          </span>
          <span className="text-2xl font-bold tracking-tight text-ink/30 tabular-nums mb-1">
            .{hero.cents}
          </span>
        </div>
      </section>

      {/* Category breakdown */}
      <section className="pb-8 border-b border-line">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-5">By category</h2>
        <CategoryBreakdown data={categoryData} />
      </section>

      {/* Today / Income / Balance */}
      <section className="grid grid-cols-3 gap-4 py-8 border-b border-line">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Today</p>
          <p className="text-xl font-bold text-accent tabular-nums">${splitCurrency(todaySpend).dollars}<span className="text-sm text-accent/50">.{splitCurrency(todaySpend).cents}</span></p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Income</p>
          <p className="text-xl font-bold text-ink tabular-nums">+${splitCurrency(monthIncome).dollars}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Balance</p>
          <p className={`text-xl font-bold tabular-nums ${monthBalance >= 0 ? 'text-ink' : 'text-accent'}`}>
            {monthBalance >= 0 ? '+' : '−'}${balanceSplit.dollars}
          </p>
        </div>
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
          <div className="pt-8 pb-4">
            <p className="text-3xl font-bold tracking-tighter text-ink-faint leading-tight">
              NO SPENDING<br />YET.
            </p>
            <Link href="/add" className="inline-block mt-6 text-xs font-bold uppercase tracking-widest text-ink underline underline-offset-4">
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
