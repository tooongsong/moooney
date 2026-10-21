import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { SubscriptionCalendar } from '@/components/SubscriptionCalendar';
import { SubscriptionDialog } from '@/components/SubscriptionDialog';
import { SubscriptionList } from '@/components/SubscriptionList';
import { SubscriptionDue } from '@/components/SubscriptionDue';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { getAllCategories } from '@/app/actions/manage';
import { getAccountOptions, getMonthOccurrences, getSubscriptionsView } from '@/app/actions/subscriptions';
import { relativeDayLabel } from '@/lib/subscriptionSchedule';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const params = await searchParams;
  const calendarView = params.view === 'calendar';

  // Phone only. The bottom-nav pill is full at four tabs, so Subscriptions
  // has none: the page is reached from the Overview row and, until this, had
  // no way back to it. Desktop keeps the sidebar and needs nothing here.
  const heading = (spacing: string) => (
    <div className={cn('flex items-center gap-2', spacing)}>
      <Link href="/overview"
            className="d-mobile-only text-ink-faint hover:text-ink transition-colors -ml-1">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Subscriptions</p>
    </div>
  );

  const [view, categories, accounts, month] = await Promise.all([
    getSubscriptionsView(),
    getAllCategories(),
    getAccountOptions(),
    getMonthOccurrences(params.month),
  ]);

  return (
    <div className="d-max-xl max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      <div className="d-mobile-only">
        <QuickAddIsland />
      </div>

      {view.subscriptions.length === 0 ? (
        <div className="pt-10 pb-16">
          {heading('mb-6')}
          <p className="text-3xl font-bold tracking-tighter text-ink-faint leading-tight">
            NOTHING<br />RECURRING.
          </p>
          {/* mt-6 as on /accounts' "Add one": without it the control sits flush
              against the leading of the big type. */}
          <div className="mt-6">
            <SubscriptionDialog today={view.today} categories={categories} accounts={accounts}>
              <button type="button" className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors">
                <Plus className="h-3 w-3" />
                Add subscription
              </button>
            </SubscriptionDialog>
          </div>
        </div>
      ) : (
        <>
          {/* ── What the standing commitment costs ── */}
          <section className="pt-3 pb-5">
            {heading('mb-3')}
            <ResponsiveAmount value={view.monthlyTotal} baseSize={68} minSize={28} className="mb-3" split />
            {/* "equivalent", not "spend": a yearly subscription contributes a
                twelfth here every month and its whole amount in the month it
                actually bills. Both are true; only one of them is spending. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-ink-faint">Monthly equivalent</span>
              <span className="text-line">·</span>
              <span className="text-ink-faint">
                Annual <span className="font-semibold text-ink tabular-nums">{formatCurrency(view.annualTotal)}</span>
              </span>
              <span className="text-line">·</span>
              <span className="text-ink-faint">
                <span className="font-semibold text-ink tabular-nums">{view.activeCount}</span> active
              </span>
            </div>
          </section>

          <div className="pb-5">
            <SubscriptionDialog today={view.today} categories={categories} accounts={accounts}>
              <button type="button" className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors">
                <Plus className="h-3 w-3" />
                Add subscription
              </button>
            </SubscriptionDialog>
          </div>

          {/* ── What was expected and never recorded. Above Upcoming
                 deliberately: it is the only part of this page with
                 something to do. ── */}
          <SubscriptionDue due={view.due} />

          {/* ── What is coming ── */}
          {view.upcoming.length > 0 && (
            <section className="pb-6">
              <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">Upcoming</p>
              {view.upcoming.map((o) => (
                <div
                  key={`${o.subscriptionId}-${o.date}`}
                  className="flex items-center gap-3 py-3 border-t border-line"
                >
                  <SubscriptionMark name={o.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{o.name}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {formatDate(o.date, { month: 'short', day: 'numeric' })} · {relativeDayLabel(o.daysAway)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                    {formatCurrency(o.amount)}
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* Phone only: both will not fit in one column. Desktop shows both. */}
          <div className="d-mobile-only">
            <div className="flex items-center gap-4 pb-3 border-t border-line pt-4">
              <Link href="/subscriptions"
                    className={cn('text-[10px] font-bold uppercase tracking-widest transition-colors',
                                  calendarView ? 'text-ink-faint' : 'text-ink')}>
                List
              </Link>
              <Link href="/subscriptions?view=calendar"
                    className={cn('text-[10px] font-bold uppercase tracking-widest transition-colors',
                                  calendarView ? 'text-ink' : 'text-ink-faint')}>
                Calendar
              </Link>
            </div>
          </div>

          <div className="d-split">
            <div className={cn('d-split-main', calendarView && 'max-lg:hidden')}>
              <SubscriptionList items={view.subscriptions} today={view.today}
                                categories={categories} accounts={accounts} />
            </div>
            <div className={cn('d-split-panel d-panel-rule', !calendarView && 'max-lg:hidden')}>
              <SubscriptionCalendar data={month} preserveView={calendarView} />
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
