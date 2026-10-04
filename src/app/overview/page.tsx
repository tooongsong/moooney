import { getOverviewData, getTrailingTrend, getCategoryDetail, type OverviewPeriod } from '@/app/actions/overview';
import { getCurrentPeriod } from '@/app/actions/time';
import { OverviewClient } from '@/components/OverviewClient';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; year?: string; category?: string }>;
}) {
  const params = await searchParams;
  const period: OverviewPeriod = params.period === 'year' ? 'year' : params.period === 'all' ? 'all' : 'month';
  const category = params.category?.trim() || null;

  const [data, { year: currentYear, month: currentMonth }, trend, detail] = await Promise.all([
    getOverviewData(period, { month: params.month, year: params.year }),
    getCurrentPeriod(),
    // ponytail: fetched on every load, including phones that never render the
    // panel — the server cannot know the viewport, and deferring it to the
    // client would turn one parallel query into a waterfall. It selects four
    // columns over twelve months, so the cost is small; revisit if it grows.
    getTrailingTrend(12),
    category
      ? getCategoryDetail(category, period, { month: params.month, year: params.year })
      : Promise.resolve(null),
  ]);

  return (
    <div className="d-max-xl max-lg:max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <div className="d-mobile-only">
        <QuickAddIsland />
      </div>

      <section className="pt-2 lg:pt-8">
        <OverviewClient data={data} period={period} currentYear={currentYear} currentMonth={currentMonth} trend={trend} detail={detail} />
      </section>

      <BottomNav />
    </div>
  );
}
