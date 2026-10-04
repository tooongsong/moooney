'use client';

import { useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatSignedCurrency, formatDate } from '@/lib/utils';
import { deleteTransaction } from '@/app/actions/transactions';
import { withBackTarget } from '@/lib/backTarget';
import type { Transaction } from '@/db/schema';
import type { TransactionListRow } from '@/app/actions/transactions';

/** The location to come back to: this page, with whatever filters are on it. */
function useHere(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function sign(type: Transaction['type']) {
  return type === 'expense' ? '−' : '+';
}

const DELETE_WIDTH = 76;
const OPEN_THRESHOLD = 40;
const TAP_THRESHOLD = 6;

interface SwipeableTransactionRowProps {
  transaction: TransactionListRow;
  onDeleted: (id: string) => void;
  /** Balance standing after this entry. Shown only on an account's own
   *  ledger — across accounts a running balance means nothing. */
  balanceAfter?: number;
}

export function SwipeableTransactionRow({ transaction, onDeleted, balanceAfter }: SwipeableTransactionRowProps) {
  const router = useRouter();
  const here = useHere();
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const moved = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startOffset.current = offset;
    moved.current = false;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > TAP_THRESHOLD) moved.current = true;
    const next = Math.min(0, Math.max(-DELETE_WIDTH, startOffset.current + delta));
    setOffset(next);
  }

  function onPointerUp() {
    setDragging(false);
    setOffset(offset < -OPEN_THRESHOLD ? -DELETE_WIDTH : 0);
  }

  function handleTap() {
    if (moved.current) return;
    if (offset !== 0) { setOffset(0); return; }
    router.push(withBackTarget(`/history/${transaction.id}`, here));
  }

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteTransaction(transaction.id);
    if (result.success) {
      toast.success('Deleted');
      onDeleted(transaction.id);
    } else {
      toast.error(result.error || 'Failed to delete');
      setIsDeleting(false);
      setOffset(0);
    }
  }

  return (
    <div className="relative overflow-hidden border-b border-line last:border-0 -mx-6">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="absolute right-0 top-0 h-full flex items-center justify-center bg-destructive text-white disabled:opacity-60"
        style={{ width: DELETE_WIDTH }}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleTap}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
        }}
        className="relative bg-paper flex items-center justify-between py-4 px-6 cursor-pointer select-none"
      >
        <div className="flex flex-col min-w-0 flex-1 pr-4">
          <span className="text-base font-semibold text-ink truncate leading-snug">
            {transaction.merchant}
          </span>
          <span className="flex items-baseline gap-1 text-[10px] font-semibold uppercase tracking-widest text-ink-faint mt-0.5">
            {/* The balance is the point of this line, so the category and date
                give way first — a cut-off number is a wrong number. */}
            <span className="truncate">
              {transaction.category}
              {' · '}
              {formatDate(transaction.date, { day: 'numeric', month: 'short' })}
              {transaction.paymentMethod ? ` · ${transaction.paymentMethod}` : ''}
              {transaction.needsReview ? ' · Review' : ''}
            </span>
            {balanceAfter !== undefined && (
              <span className="shrink-0 tabular-nums">· {formatSignedCurrency(balanceAfter)}</span>
            )}
          </span>
        </div>
        <span className="text-base font-bold tabular-nums shrink-0 text-ink">
          {sign(transaction.type)}{formatCurrency(transaction.amount)}
        </span>
      </div>
    </div>
  );
}
