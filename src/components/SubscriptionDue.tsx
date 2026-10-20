'use client';

import { useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { recordSubscriptionPayment, type DuePayment } from '@/app/actions/subscriptions';
import { relativeDayLabel } from '@/lib/subscriptionSchedule';
import { formatDate, parseAmountInput } from '@/lib/utils';

/**
 * Charges the schedule expected that have not been recorded.
 *
 * The app proposes; a tap confirms. It never writes a transaction on its own,
 * because a subscription is an expectation and only a person knows whether
 * the money actually left — a cancelled service, a declined card and a free
 * month all look identical from here.
 *
 * The amount is editable before saving, since a price rise is the common
 * reason the expected figure is wrong.
 *
 * A row that should not be here is the app saying the subscription needs
 * ending, with the date it really stopped. Not recording it is the correct
 * action, so there is no dismiss.
 */
export function SubscriptionDue({ due }: { due: DuePayment[] }) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (due.length === 0) return null;

  const keyOf = (d: DuePayment) => `${d.subscriptionId}|${d.date}`;

  async function record(d: DuePayment) {
    const key = keyOf(d);
    const typed = amounts[key];
    const amount = typed === undefined ? d.amount : parseAmountInput(typed);
    if (Number.isNaN(amount)) {
      toast.error('Enter the amount like 11.99 or 1,288.88');
      return;
    }

    setBusy(key);
    try {
      const res = await recordSubscriptionPayment(d.subscriptionId, d.date, amount);
      if (!res.success) {
        toast.error(res.error || 'Could not record it');
        return;
      }
      toast.success(`${d.name} recorded`);
      router.refresh();
    } catch (error) {
      unstable_rethrow(error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="pb-6">
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">
        Expected, not recorded
      </p>
      {due.map((d) => {
        const key = keyOf(d);
        return (
          <div key={key} className="flex items-center gap-3 py-3 border-t border-line">
            <SubscriptionMark name={d.name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{d.name}</span>
              <span className="block text-[11px] text-ink-soft">
                {formatDate(d.date, { month: 'short', day: 'numeric' })} · {relativeDayLabel(-d.daysAgo)}
              </span>
            </span>
            {/* Prefilled with what was expected, and editable, because the
                price going up is the usual reason it is wrong. */}
            <Input
              aria-label={`Amount for ${d.name}`}
              value={amounts[key] ?? d.amount.toFixed(2)}
              onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
              inputMode="decimal"
              className="h-8 w-24 shrink-0 text-right text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={() => record(d)}
              disabled={busy !== null}
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40"
            >
              {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Record'}
            </button>
          </div>
        );
      })}
    </section>
  );
}
