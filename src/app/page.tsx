import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getHomeData } from '@/app/actions/transactions';
import { getAccountBalances } from '@/app/actions/accounts';
import { TransactionRow } from '@/components/TransactionRow';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';

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

  const balanceSplit = splitCurrency(monthBalance);
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' })
    .format(new Date()).toUpperCase();

  return (
    <div className="d-max-xl max-lg:max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">

      {/* QuickAddIsland — mobile only */}
      <div className="d-mobile-only">
        <QuickAddIsland month={monthLabel} manageHref="/settings" />
      </div>

      {/* Two-column on desktop, single column on mobile */}
      <div className="d-row d-gap-lg">

        {/* LEFT: hero + breakdown + stats */}
        <div className="d-col-grow">
          <section className="pt-8 pb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-3">Spent this month</p>
            <ResponsiveAmount value={monthSpend} baseSize={72} minSize={28} split />
          </section>

          <section className="pb-8 border-b border-line">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-5">By category</h2>
            <CategoryBreakdown data={categoryData} />
          </section>

          <section className="grid grid-cols-3 gap-4 py-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Today</p>
              <p className="text-xl font-bold text-accent tabular-nums">
                ${splitCurrency(todaySpend).dollars}<span className="text-sm text-accent/50">.{splitCurrency(todaySpend).cents}</span>
              </p>
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
        </div>

        {/* RIGHT: recent transactions */}
        <section className="pt-8 d-col-side d-sticky d-divide-l">
          <div className="flex items-center justify-between mb-4">
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
      </div>

      <BottomNav />
    </div>
  );
}
