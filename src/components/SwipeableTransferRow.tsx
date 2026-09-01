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
    if (offset !== 0) { setOffset(0); return; }
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
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
          <ArrowRightLeft className="h-3.5 w-3.5 text-ink-faint shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-base font-semibold text-ink truncate leading-snug">
              {transfer.fromAccount} → {transfer.toAccount}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mt-0.5">
              Transfer · {formatDate(transfer.date, { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
        <span className="text-base font-bold tabular-nums shrink-0 text-ink">
          {formatCurrency(transfer.amount)}
        </span>
      </div>
    </div>
  );
}
