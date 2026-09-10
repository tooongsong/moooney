'use client';

import { motion } from 'motion/react';
import { formatCurrency } from '@/lib/utils';

interface CategoryBlocksProps {
  data: { name: string; value: number }[];
}

const MAX_SHOWN = 5;
const MIN_SIZE = 64;
const MAX_SIZE = 132;

export function CategoryBlocks({ data }: CategoryBlocksProps) {
  if (data.length === 0) {
    return (
      <p className="text-2xl font-bold tracking-tighter text-ink-faint leading-tight py-2">
        NO SPENDING<br />YET.
      </p>
    );
  }

  const top = data.slice(0, MAX_SHOWN);
  const max = top[0].value;

  return (
    <div className="flex flex-wrap items-end gap-4">
      {top.map((entry, i) => {
        const size = max > 0 ? MIN_SIZE + (entry.value / max) * (MAX_SIZE - MIN_SIZE) : MIN_SIZE;
        const isTop = i === 0;

        return (
          <motion.div
            key={entry.name}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: i * 0.04 }}
            className="flex flex-col items-center justify-center text-center shrink-0 px-2"
            style={{
              width: size,
              height: size,
              borderRadius: isTop ? '48% 52% 50% 50% / 52% 48% 52% 48%' : '9999px',
              background: isTop ? 'var(--accent)' : 'var(--sand)',
            }}
          >
            <span className={`text-[8px] font-bold uppercase tracking-widest truncate max-w-full ${isTop ? 'text-white/80' : 'text-ink-faint'}`}>
              {entry.name}
            </span>
            <span className={`text-sm font-bold tabular-nums ${isTop ? 'text-white' : 'text-ink'}`}>
              {formatCurrency(entry.value)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
