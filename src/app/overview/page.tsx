import { getOverviewData } from '@/app/actions/overview';
import { OverviewClient } from '@/components/OverviewClient';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';

export default async function OverviewPage() {
  const [month, year, all] = await Promise.all([
    getOverviewData('month'),
    getOverviewData('year'),
    getOverviewData('all'),
  ]);

  return (
    <div className="d-max-xl max-lg:max-w-md mx-auto px-6 min-h-screen pb-28 bg-paper">
      <div className="d-mobile-only">
        <QuickAddIsland />
      </div>

      <section className="pt-2 lg:pt-8">
        <OverviewClient month={month} year={year} all={all} />
      </section>

      <BottomNav />
    </div>
  );
}
