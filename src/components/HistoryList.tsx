'use client';

import { useState } from 'react';
import { SwipeableTransactionRow } from '@/components/SwipeableTransactionRow';
import { SwipeableTransferRow } from '@/components/SwipeableTransferRow';
import type { HistoryItem } from '@/app/actions/history';

export function HistoryList({ transactions }: { transactions: HistoryItem[] }) {
  const [items, setItems] = useState(transactions);
  // Reset local state when the server gives us a new filtered list (search/month/category
  // changed) — adjusted during render rather than an effect, per React's own guidance for
  // "state derived from props that needs to reset."
  const [prevTransactions, setPrevTransactions] = useState(transactions);
  if (transactions !== prevTransactions) {
    setPrevTransactions(transactions);
    setItems(transactions);
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  if (items.length === 0) {
    return (
      <p className="py-4 text-sm text-ink-faint">
        Nothing here — try different filters.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item) =>
        item.kind === 'transfer' ? (
          <SwipeableTransferRow key={item.id} transfer={item} onDeleted={handleDeleted} />
        ) : (
          <SwipeableTransactionRow key={item.id} transaction={item} onDeleted={handleDeleted} />
        )
      )}
    </div>
  );
}
