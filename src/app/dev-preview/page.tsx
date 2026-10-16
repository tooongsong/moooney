import { notFound } from 'next/navigation';
import { SubscriptionList, type ListItem } from '@/components/SubscriptionList';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { formatCurrency } from '@/lib/utils';

// A folder named with a leading underscore is private in Next.js and never
// routes at all — hence "dev-preview". Gated so it cannot ship.
const TODAY = '2026-10-15';

const ITEMS: ListItem[] = [
  { id: '1', name: 'Spotify', emoji: '🎵', amount: 11.99, cycle: 'monthly', anchorDate: '2026-01-15',
    status: 'active', stoppedOn: null, category: 'Entertainment', paymentMethodId: null, website: null,
    notes: null, next: '2026-10-15' },
  { id: '2', name: 'iCloud+ with a deliberately long product name', emoji: null, amount: 2.99,
    cycle: 'monthly', anchorDate: '2026-01-31', status: 'active', stoppedOn: null, category: 'Bills',
    paymentMethodId: null, website: null, notes: null, next: '2026-10-31' },
  { id: '3', name: '网易云音乐', emoji: null, amount: 1288.88, cycle: 'yearly', anchorDate: '2026-03-09',
    status: 'active', stoppedOn: null, category: 'Entertainment', paymentMethodId: null, website: null,
    notes: null, next: '2027-03-09' },
  { id: '4', name: 'Oatly delivery', emoji: '🥛', amount: 24.5, cycle: 'weekly', anchorDate: '2026-10-12',
    status: 'active', stoppedOn: null, category: 'Groceries', paymentMethodId: null, website: null,
    notes: null, next: '2026-10-19' },
  { id: '5', name: 'Figma', emoji: null, amount: 15, cycle: 'monthly', anchorDate: '2026-02-01',
    status: 'paused', stoppedOn: null, category: 'Other', paymentMethodId: null, website: null,
    notes: null, next: null },
  { id: '6', name: 'Old gym', emoji: null, amount: 89, cycle: 'monthly', anchorDate: '2025-06-01',
    status: 'ended', stoppedOn: '2026-08-31', category: 'Health', paymentMethodId: null, website: null,
    notes: null, next: null },
];

export default function DevPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <div className="d-max-lg max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      <section className="pt-3 pb-5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-3">Subscriptions</p>
        {/* The four active fixtures: 11.99 + 2.99 + 1288.88/12 + 24.5 × (365.25/7/12). */}
        <ResponsiveAmount value={228.92} baseSize={68} minSize={28} className="mb-3" split />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-ink-faint">Monthly equivalent</span>
          <span className="text-line">·</span>
          <span className="text-ink-faint">Annual <span className="font-semibold text-ink tabular-nums">{formatCurrency(2747.02)}</span></span>
          <span className="text-line">·</span>
          <span className="text-ink-faint"><span className="font-semibold text-ink tabular-nums">4</span> active</span>
        </div>
      </section>
      <div className="flex items-center gap-3 pb-6">
        <SubscriptionMark name="Spotify" emoji="🎵" size={36} />
        <SubscriptionMark name="网易云音乐" emoji={null} size={36} />
        <SubscriptionMark name="iCloud" emoji={null} size={36} />
      </div>
      <SubscriptionList items={ITEMS} today={TODAY} categories={['Entertainment', 'Bills', 'Groceries', 'Health', 'Other']} accounts={[{ id: 'a1', name: 'Amex Gold', archived: false }, { id: 'a2', name: 'Chase Checking', archived: true }]} />
    </div>
  );
}
