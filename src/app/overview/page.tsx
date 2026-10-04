import { getOverviewData, type OverviewPeriod } from '@/app/actions/overview';
import { getCurrentPeriod } from '@/app/actions/time';
import { OverviewClient } from '@/components/OverviewClient';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const period: OverviewPeriod = params.period === 'year' ? 'year' : params.period === 'all' ? 'all' : 'month';
  const [data, { year: currentYear, month: currentMonth }] = await Promise.all([
    getOverviewData(period, { month: params.month, year: params.year }),
    getCurrentPeriod(),
  ]);

  return (
    <div className="d-max-xl max-lg:max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <div className="d-mobile-only">
        <QuickAddIsland />
      </div>

      <section className="pt-2 lg:pt-8">
        <OverviewClient data={data} period={period} currentYear={currentYear} currentMonth={currentMonth} />
      </section>

      <BottomNav />
    </div>
  );
}
