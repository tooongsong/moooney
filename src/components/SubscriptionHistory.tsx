'use client';

import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getLinkCandidates, getSubscriptionHistory, linkTransaction, unlinkTransaction,
  type LinkCandidate, type OccurrenceState,
} from '@/app/actions/subscriptions';
import { LINK_CANDIDATE_LIMIT } from '@/lib/subscriptionSchedule';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATE_LABEL = { upcoming: 'Upcoming', confirmed: 'Confirmed', unconfirmed: 'Unconfirmed' } as const;

export function SubscriptionHistory({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getSubscriptionHistory>>>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  // Three states, not two. "Still looking" and "the request failed" are each
  // different from "none found", and saying "none found" for either is a lie
  // the user acts on by giving up.
  const [candidates, setCandidates] = useState<LinkCandidate[] | 'loading' | 'failed'>('loading');
  // Taps can outrun responses: without this, opening one row and quickly
  // opening another can show the first row's candidates under the second
  // row's date, and linking one would attach it to the wrong occurrence.
  const pickSeq = useRef(0);
  const [busy, setBusy] = useState(false);

  // No setLoading here: this runs after a link or unlink, and swapping the
  // list for a spinner on every click would make a one-row change look like a
  // page reload.
  async function reload() {
    setData(await getSubscriptionHistory(subscriptionId));
  }

  useEffect(() => {
    let live = true;
    getSubscriptionHistory(subscriptionId)
      .then((d) => { if (live) setData(d); })
      .catch((error) => {
        // Rethrow first, exactly as the picker and the dialog do: a
        // signed-out panel reaches here on its way to /login, and without
        // this it arrives with a false "could not load" toast on top.
        unstable_rethrow(error);
        // Otherwise the spinner would stay up for good, with an uncaught
        // rejection behind it and nothing to act on.
        if (live) toast.error('Could not load payments.');
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [subscriptionId]);

  async function openPicker(o: OccurrenceState) {
    const seq = ++pickSeq.current;
    setPicking(o.date);
    setCandidates('loading');
    try {
      const rows = await getLinkCandidates(subscriptionId, o.date);
      if (seq === pickSeq.current) setCandidates(rows);
    } catch (error) {
      unstable_rethrow(error);
      if (seq !== pickSeq.current) return;
      setCandidates('failed');
      toast.error('Could not reach the server. Please try again.');
    }
  }

  // try/catch/finally for the same reason SubscriptionDialog has it: the
  // actions catch database errors, but nothing catches the request itself
  // failing. Without the finally, `busy` stays true and every control in this
  // panel is disabled with no way back.
  async function link(transactionId: string, period: string) {
    setBusy(true);
    try {
      const res = await linkTransaction(transactionId, subscriptionId, period);
      if (!res.success) { toast.error(res.error || 'Could not link'); return; }
      setPicking(null);
      // The write succeeded. A failing refresh after it is a stale screen,
      // not a failed link, and must not be reported as one.
      try { await reload(); router.refresh(); } catch { /* stale, not failed */ }
    } catch (error) {
      unstable_rethrow(error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(transactionId: string) {
    setBusy(true);
    try {
      const res = await unlinkTransaction(transactionId);
      if (!res.success) { toast.error(res.error || 'Could not unlink'); return; }
      try { await reload(); router.refresh(); } catch { /* stale, not failed */ }
    } catch (error) {
      unstable_rethrow(error);
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-3 text-[11px] text-ink-faint">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading payments…
      </p>
    );
  }
  // Not `occurrences.length === 0` alone: a series can have no live
  // occurrences and still hold stranded links, and hiding them here would
  // undo the only way to reach them.
  if (!data) return null;
  if (data.occurrences.length === 0 && data.orphaned.length === 0) return null;

  return (
    // min-w-0: this panel sits in a grid, and a grid item's default
    // min-width is auto, so it refuses to shrink below its content and
    // pushes the dialog sideways instead — measured at 361.7px in a 327px
    // column, and again at 1280 with a long merchant name.
    <div className="min-w-0 pt-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">Payments</p>
      {/* Newest first: the ones you are most likely to be confirming. */}
      {[...data.occurrences].reverse().map((o) => (
        <div key={o.date} className="border-t border-line py-2">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">
                {formatDate(o.date, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {/* A word, not only a colour — and not in the faintest ink
                  available, since the state is the thing being read. */}
              <span className="block text-[11px] text-ink-soft">{STATE_LABEL[o.state]}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums text-ink">
                {formatCurrency(o.paidAmount ?? data.expected)}
              </span>
              {o.paidAmount !== null && o.paidAmount !== data.expected && (
                <span className="block text-[10px] tabular-nums text-ink-soft">
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
              {candidates === 'loading' ? (
                <p className="flex items-center gap-2 text-[11px] text-ink-faint">
                  <Loader2 className="h-3 w-3 animate-spin" /> Looking…
                </p>
              ) : candidates === 'failed' ? (
                <p className="text-[11px] text-ink-soft">
                  Could not load. Tap Link again to retry.
                </p>
              ) : candidates.length === 0 ? (
                <p className="text-[11px] text-ink-faint">
                  No unlinked expense within ten days of this date.
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
              {Array.isArray(candidates) && candidates.length === LINK_CANDIDATE_LIMIT && (
                <p className="pt-1 text-[10px] text-ink-soft">
                  Showing the {LINK_CANDIDATE_LIMIT} payments nearest this date.
                </p>
              )}
              <button type="button" onClick={() => setPicking(null)}
                      className="pt-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink">
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Links the series no longer has a period for — after the billing day
          moved across a month, or the cycle changed. The spec calls this the
          known ceiling and says it is fixed by re-linking; that is only true
          if the stranded link can be found, because a linked transaction is
          excluded from every candidate list. Unlink here, then link it where
          it belongs. */}
      {data.orphaned.length > 0 && (
        <div className="pt-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">
            No longer matches a payment date
          </p>
          {data.orphaned.map((o) => (
            <div key={o.transactionId} className="flex items-center gap-3 border-t border-line py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  {formatDate(o.period, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="block text-[11px] text-ink-soft">Linked to a date this subscription no longer bills on</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {formatCurrency(o.amount)}
              </span>
              <button type="button" disabled={busy} onClick={() => unlink(o.transactionId)}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
