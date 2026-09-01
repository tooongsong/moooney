'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { deleteTransaction } from '@/app/actions/transactions';
import type { Transaction } from '@/db/schema';

const TYPE_STYLES: Record<Transaction['type'], string> = {
  expense: 'text-ink',
  income: 'text-emerald-600',
  refund: 'text-sky-600',
};

const DOT_STYLES: Record<Transaction['type'], string> = {
  expense: 'bg-accent',
  income: 'bg-emerald-600',
  refund: 'bg-sky-600',
};

function sign(type: Transaction['type']) {
  return type === 'expense' ? '-' : '+';
}

const DELETE_WIDTH = 76;
const OPEN_THRESHOLD = 40;
const TAP_THRESHOLD = 6;

interface SwipeableTransactionRowProps {
  transaction: Transaction;
  onDeleted: (id: string) => void;
}

export function SwipeableTransactionRow({ transaction, onDeleted }: SwipeableTransactionRowProps) {
  const router = useRouter();
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
    if (offset !== 0) {
      setOffset(0);
      return;
    }
    router.push(`/history/${transaction.id}`);
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
    <div className="relative overflow-hidden border-b border-line last:border-0">
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
        className="relative bg-paper flex items-center justify-between py-3.5 px-2 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', DOT_STYLES[transaction.type])} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-ink truncate">{transaction.merchant}</span>
            <span className="text-xs text-ink-faint flex items-center gap-1.5 min-w-0">
              <span className="truncate uppercase tracking-wide">{transaction.category}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-ink-faint shrink-0" />
              <span className="shrink-0">{formatDate(transaction.date, { day: 'numeric', month: 'short' })}</span>
              {transaction.paymentMethod && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-ink-faint shrink-0" />
                  <span className="truncate">{transaction.paymentMethod}</span>
                </>
              )}
              {transaction.needsReview && <span className="shrink-0 text-accent font-medium">· Review</span>}
            </span>
          </div>
        </div>
        <span className={cn('text-sm font-bold tabular-nums shrink-0 ml-2', TYPE_STYLES[transaction.type])}>
          {sign(transaction.type)}
          {formatCurrency(transaction.amount)}
        </span>
      </div>
    </div>
  );
}
