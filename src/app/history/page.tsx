import { SearchInput } from '@/components/SearchInput';
import { MonthFilter } from '@/components/MonthFilter';
import { CategoryFilter } from '@/components/CategoryFilter';
import { AccountFilter } from '@/components/AccountFilter';
import { HistoryList } from '@/components/HistoryList';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';
import { listHistoryItems } from '@/app/actions/history';
import { getAllCategories, getPaymentMethodNames } from '@/app/actions/manage';

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; category?: string; account?: string }>;
}) {
  const params = await searchParams;
  const [data, categories, accountNames] = await Promise.all([
    listHistoryItems({
      query:    params.q,
      month:    params.month,
      category: params.category,
      account:  params.account,
    }),
    getAllCategories(),
    getPaymentMethodNames(),
  ]);

  return (
    <div className="d-max-xl max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">

      {/* QuickAddIsland — mobile only */}
      <div className="d-mobile-only">
        <QuickAddIsland />
      </div>

      {/* Desktop: filters left (sticky), list right */}
      <div className="d-row d-gap-md">

        {/* Filters */}
        <section className="pt-4 pb-6 space-y-4 d-col-nav d-sticky">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">History</p>
          <SearchInput placeholder="Search…" />
          <MonthFilter />
          <CategoryFilter categories={categories} />
          {accountNames.length > 0 && <AccountFilter accounts={accountNames} />}
        </section>

        {/* Transaction list */}
        <section className="d-col-grow d-divide-l d-pt">
          <HistoryList transactions={data} />
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
