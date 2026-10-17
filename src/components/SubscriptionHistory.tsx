'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getLinkCandidates, getSubscriptionHistory, linkTransaction, unlinkTransaction,
  type LinkCandidate, type OccurrenceState,
} from '@/app/actions/subscriptions';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATE_LABEL = { upcoming: 'Upcoming', confirmed: 'Confirmed', unconfirmed: 'Unconfirmed' } as const;

export function SubscriptionHistory({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getSubscriptionHistory>>>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [busy, setBusy] = useState(false);

  // No setLoading here: this runs after a link or unlink, and swapping the
  // list for a spinner on every click would make a one-row change look like a
  // page reload.
  async function reload() {
    setData(await getSubscriptionHistory(subscriptionId));
  }

  useEffect(() => {
    let live = true;
    getSubscriptionHistory(subscriptionId).then((d) => {
      if (!live) return;
      setData(d);
      setLoading(false);
    });
    return () => { live = false; };
  }, [subscriptionId]);

  async function openPicker(o: OccurrenceState) {
    setPicking(o.date);
    setCandidates([]);
    setCandidates(await getLinkCandidates(subscriptionId, o.date));
  }

  async function link(transactionId: string, period: string) {
    setBusy(true);
    const res = await linkTransaction(transactionId, subscriptionId, period);
    setBusy(false);
    if (!res.success) { toast.error(res.error || 'Could not link'); return; }
    setPicking(null);
    await reload();
    router.refresh();
  }

  async function unlink(transactionId: string) {
    setBusy(true);
    const res = await unlinkTransaction(transactionId);
    setBusy(false);
    if (!res.success) { toast.error(res.error || 'Could not unlink'); return; }
    await reload();
    router.refresh();
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-3 text-[11px] text-ink-faint">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading payments…
      </p>
    );
  }
  if (!data || data.occurrences.length === 0) return null;

  // min-w-0 because the dialog is a grid and this is a grid item, and a grid item
  // will not shrink below its content: one long merchant name in the picker would
  // widen the whole dialog sideways instead of being cut off by truncate.
  return (
    <div className="pt-1 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">Payments</p>
      {/* Newest first: the ones you are most likely to be confirming. */}
      {[...data.occurrences].reverse().map((o) => (
        <div key={o.date} className="border-t border-line py-2">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">
                {formatDate(o.date, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {/* A word, not only a colour. */}
              <span className="block text-[11px] text-ink-faint">{STATE_LABEL[o.state]}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums text-ink">
                {formatCurrency(o.paidAmount ?? data.expected)}
              </span>
              {o.paidAmount !== null && o.paidAmount !== data.expected && (
                <span className="block text-[10px] tabular-nums text-ink-faint">
                  expected {formatCurrency(data.expected)}
                </span>
              )}
            </span>
            {o.state === 'confirmed' ? (
              <button type="button" disabled={busy} onClick={() => unlink(o.transactionId!)}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Unlink
              </button>
            ) : o.state === 'unconfirmed' ? (
              <button type="button" disabled={busy} onClick={() => openPicker(o)}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Link
              </button>
            ) : null}
          </div>

          {/* Inline rather than a second dialog: a dialog inside a dialog is
              a focus-trap argument nobody wins. */}
          {picking === o.date && (
            <div className="pt-2 pl-1">
              {candidates.length === 0 ? (
                <p className="text-[11px] text-ink-faint">
                  No unlinked transactions within ten days of this date.
                </p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() => link(c.id, o.date)}
                    className="w-full flex items-center gap-3 py-1.5 text-left disabled:opacity-40"
                  >
                    <span className="text-[11px] tabular-nums text-ink-faint shrink-0">
                      {formatDate(c.date, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{c.merchant}</span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink">
                      {formatCurrency(c.amount)}
                    </span>
                  </button>
                ))
              )}
              <button type="button" onClick={() => setPicking(null)}
                      className="pt-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink">
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
