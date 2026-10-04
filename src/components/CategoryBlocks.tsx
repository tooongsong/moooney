'use client';

import { motion } from 'motion/react';
import { formatCurrency } from '@/lib/utils';

interface CategoryBlocksProps {
  data: { name: string; value: number }[];
  /** Desktop passes a larger ceiling; the phone keeps 132. */
  maxSize?: number;
  minSize?: number;
  /** When provided, the circles become controls. */
  selected?: string | null;
  onSelect?: (name: string | null) => void;
  /** Labels outside the circle, so a long category name is not cramped. */
  labelOutside?: boolean;
}

const MAX_SHOWN = 5;
const ORGANIC_RADIUS = '48% 52% 50% 50% / 52% 48% 52% 48%';

export function CategoryBlocks({
  data,
  maxSize = 132,
  minSize = 64,
  selected = null,
  onSelect,
  labelOutside = false,
}: CategoryBlocksProps) {
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
        const size = max > 0 ? minSize + (entry.value / max) * (maxSize - minSize) : minSize;
        // With no selection the largest circle leads, as it always has. Once
        // something is selected the accent follows it instead — two accented
        // shapes would leave neither of them emphasised.
        const isAccent = selected === null ? i === 0 : selected === entry.name;
        const isSelected = selected === entry.name;

        const circle = (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: i * 0.04 }}
            className="flex flex-col items-center justify-center text-center shrink-0 px-2"
            style={{
              width: size,
              height: size,
              borderRadius: isAccent ? ORGANIC_RADIUS : '9999px',
              background: isAccent ? 'var(--accent)' : 'var(--sand)',
              // --sand on --paper is a six-value difference, so an unaccented
              // circle had no visible edge at all. Size is the data in this
              // chart, and a shape you cannot see carries none of it.
              border: isAccent ? undefined : '1px solid var(--line)',
            }}
          >
            {!labelOutside && (
              <span className={`text-[8px] font-bold uppercase tracking-widest truncate max-w-full ${isAccent ? 'text-white/80' : 'text-ink-faint'}`}>
                {entry.name}
              </span>
            )}
            <span className={`text-sm font-bold tabular-nums ${isAccent ? 'text-white' : 'text-ink'}`}>
              {formatCurrency(entry.value)}
            </span>
          </motion.div>
        );

        const label = labelOutside ? (
          <span className={`text-[8px] font-bold uppercase tracking-widest text-center max-w-[7rem] ${isSelected ? 'text-accent' : 'text-ink-soft'}`}>
            {entry.name}
          </span>
        ) : null;

        if (!onSelect) {
          return (
            <div key={entry.name} className="flex flex-col items-center gap-1.5 shrink-0">
              {circle}
              {label}
            </div>
          );
        }

        return (
          <button
            key={entry.name}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? null : entry.name)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {circle}
            {label}
          </button>
        );
      })}
    </div>
  );
}
