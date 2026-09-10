import { getOverviewData, type OverviewPeriod } from '@/app/actions/overview';
import { OverviewClient } from '@/components/OverviewClient';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';

function parseAnchor(period: OverviewPeriod, month: string | undefined, year: string | undefined): Date {
  const now = new Date();
  if (period === 'month' && month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (match) {
      const candidate = new Date(Number(match[1]), Number(match[2]) - 1, 1);
      if (candidate.getTime() <= now.getTime()) return candidate;
    }
  }
  if (period === 'year' && year) {
    const y = Number(year);
    if (Number.isInteger(y) && y <= now.getFullYear()) return new Date(y, 0, 1);
  }
  return now;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const period: OverviewPeriod = params.period === 'year' ? 'year' : params.period === 'all' ? 'all' : 'month';
  const anchor = parseAnchor(period, params.month, params.year);
  const data = await getOverviewData(period, anchor);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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
