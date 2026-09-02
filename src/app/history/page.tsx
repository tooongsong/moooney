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
    <div className="max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <header className="sticky top-0 z-30 bg-paper -mx-6 px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3">
        <h1 className="text-4xl font-bold tracking-tighter text-ink">History</h1>
      </header>

      <QuickAddIsland />

      <section className="pt-4 pb-6 space-y-4">
        <SearchInput placeholder="Search…" />
        <MonthFilter />
        <CategoryFilter categories={categories} />
        {accountNames.length > 0 && <AccountFilter accounts={accountNames} />}
      </section>

      <section>
        <HistoryList transactions={data} />
      </section>

      <BottomNav />
    </div>
  );
}
