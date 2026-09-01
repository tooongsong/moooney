import { SearchInput } from '@/components/SearchInput';
import { MonthFilter } from '@/components/MonthFilter';
import { CategoryFilter } from '@/components/CategoryFilter';
import { AccountFilterChip } from '@/components/AccountFilterChip';
import { HistoryList } from '@/components/HistoryList';
import { BottomNav } from '@/components/BottomNav';
import { listHistoryItems } from '@/app/actions/history';
import { getAllCategories } from '@/app/actions/manage';

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; category?: string; account?: string }>;
}) {
  const params = await searchParams;
  const [data, categories] = await Promise.all([
    listHistoryItems({
      query: params.q,
      month: params.month,
      category: params.category,
      account: params.account,
    }),
    getAllCategories(),
  ]);

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <header className="sticky top-0 z-30 bg-paper -mx-6 px-6 py-4 border-b-2 border-ink">
        <h1 className="text-4xl font-bold tracking-tighter text-ink">History</h1>
      </header>

      <section className="pt-2 pb-6 space-y-3">
        <SearchInput placeholder="Search merchant or description…" />
        <div className="grid grid-cols-2 gap-3">
          <MonthFilter />
          <CategoryFilter categories={categories} />
        </div>
        <AccountFilterChip />
      </section>

      <section>
        <HistoryList transactions={data} />
      </section>

      <BottomNav />
    </div>
  );
}
