'use client';

import { useState } from 'react';
import { SwipeableTransactionRow } from '@/components/SwipeableTransactionRow';
import { SwipeableTransferRow } from '@/components/SwipeableTransferRow';
import { AdjustmentRow } from '@/components/AdjustmentRow';
import { BALANCE_ADJUSTMENT_TYPE } from '@/lib/categories';
import { formatSignedCurrency, formatDate } from '@/lib/utils';
import type { AccountLedger as Ledger } from '@/app/actions/accounts';

/**
 * One account's entries with the balance standing after each, and the opening
 * balance they start from.
 *
 * Separate from HistoryList rather than a flag on it: History spans every
 * account, where a running balance would be meaningless, and a shared
 * component carrying a concept most of its callers must ignore is worse than
 * two small ones.
 */
export function AccountLedger({ ledger }: { ledger: Ledger }) {
  const [entries, setEntries] = useState(ledger.entries);

  // Reset when the server sends a different account's ledger, adjusted during
  // render as HistoryList does rather than through an effect.
  const [prev, setPrev] = useState(ledger.entries);
  if (ledger.entries !== prev) {
    setPrev(ledger.entries);
    setEntries(ledger.entries);
  }

  function handleDeleted(id: string) {
    // The balances below a removed row no longer hold, so the row goes but the
    // numbers stay as they were until the server sends a recomputed ledger.
    setEntries((rows) => rows.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col">
      {entries.map((item) =>
        item.kind === 'transfer' ? (
          <SwipeableTransferRow
            key={item.id}
            transfer={item}
            balanceAfter={item.balanceAfter}
            onDeleted={handleDeleted}
          />
        ) : item.type === BALANCE_ADJUSTMENT_TYPE ? (
          <AdjustmentRow key={item.id} transaction={item} balanceAfter={item.balanceAfter} />
        ) : (
          <SwipeableTransactionRow
            key={item.id}
            transaction={item}
            balanceAfter={item.balanceAfter}
            onDeleted={handleDeleted}
          />
        )
      )}

      {/* The opening balance was invisible in this app until now — it lives in
          the edit form, so an account could open at a figure that was also
          recorded as a transaction and nothing on screen would say so. */}
      <div className="flex items-center justify-between py-3 border-t border-line">
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-ink-faint">Opening balance</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint/70 mt-0.5">
            {ledger.firstEntryDate
              ? `Before ${formatDate(ledger.firstEntryDate, { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'No entries yet'}
          </span>
        </div>
        <span
          className={`text-sm font-semibold tabular-nums shrink-0 ${
            ledger.opening < 0 ? 'text-accent' : 'text-ink-faint'
          }`}
        >
          {formatSignedCurrency(ledger.opening)}
        </span>
      </div>

      {entries.length === 0 && (
        <p className="py-4 text-sm text-ink-faint">
          Nothing recorded on this account yet.
        </p>
      )}
    </div>
  );
}
