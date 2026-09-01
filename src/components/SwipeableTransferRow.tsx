'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { deleteTransfer } from '@/app/actions/transfers';
import type { Transfer } from '@/db/schema';

const DELETE_WIDTH = 76;
const OPEN_THRESHOLD = 40;
const TAP_THRESHOLD = 6;

interface SwipeableTransferRowProps {
  transfer: Transfer;
  onDeleted: (id: string) => void;
}

export function SwipeableTransferRow({ transfer, onDeleted }: SwipeableTransferRowProps) {
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
    router.push(`/transfer/${transfer.id}`);
  }

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteTransfer(transfer.id);
    if (result.success) {
      toast.success('Deleted');
      onDeleted(transfer.id);
    } else {
      toast.error('Failed to delete');
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
          <span className="w-6 h-6 shrink-0 flex items-center justify-center text-ink-faint">
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-ink truncate">
              {transfer.fromAccount} → {transfer.toAccount}
            </span>
            <span className="text-xs text-ink-faint flex items-center gap-1.5 min-w-0">
              <span className="uppercase tracking-wide shrink-0">Transfer</span>
              <span className="w-0.5 h-0.5 rounded-full bg-ink-faint shrink-0" />
              <span className="shrink-0">{formatDate(transfer.date, { day: 'numeric', month: 'short' })}</span>
            </span>
          </div>
        </div>
        <span className="text-sm font-bold tabular-nums shrink-0 ml-2 text-ink-soft">{formatCurrency(transfer.amount)}</span>
      </div>
    </div>
  );
}
