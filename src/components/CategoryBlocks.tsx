'use client';

import { motion } from 'motion/react';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { circleSizes } from '@/lib/circleSizes';

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

/** Guaranteed gap between adjacent ranks, so the ordering is visible even when
 *  two categories are within a few percent of each other. */
const MIN_STEP = 8;
const ORGANIC_RADIUS = '48% 52% 50% 50% / 52% 48% 52% 48%';
/** A circle's inscribed square: side = diameter / √2. Text wider than this
 *  reaches past the curve even though it fits the bounding box. */
const INSCRIBED = 0.707;

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

  // Every category that has spending, largest first — the old cap at five hid
  // the tail, and a category you cannot see is one you cannot reason about.
  const top = [...data].sort((a, b) => b.value - a.value);
  const sizes = circleSizes(top.map((e) => e.value), { min: minSize, max: maxSize, minStep: MIN_STEP });

  return (
    <div className="flex flex-wrap items-end gap-4">
      {top.map((entry, i) => {
        const size = sizes[i];
        // With no selection the largest circle leads, as it always has. Once
        // something is selected the accent follows it instead — two accented
        // shapes would leave neither of them emphasised.
        const isAccent = selected === null ? i === 0 : selected === entry.name;
        const isSelected = selected === entry.name;
        const inner = Math.floor(size * INSCRIBED);

        const circle = (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: i * 0.04 }}
            className="flex flex-col items-center justify-center text-center shrink-0"
            style={{
              width: size,
              height: size,
              borderRadius: isAccent ? ORGANIC_RADIUS : '9999px',
              background: isAccent ? 'var(--accent)' : 'var(--sand)',
              // --sand on --paper is a six-value difference, so an unaccented
              // circle had no visible edge at all. Size is the data in this
              // chart, and a shape you cannot see carries none of it.
              //
              // Mixed from --ink rather than --line so the edge flips with the
              // scheme: --line sits within six values of --sand in dark mode,
              // where it would draw nothing.
              border: isAccent
                ? undefined
                : '1px solid color-mix(in srgb, var(--ink) 18%, transparent)',
            }}
          >
            {!labelOutside && (
              <span
                className={`font-bold uppercase tracking-widest text-center leading-tight ${isAccent ? 'text-white/80' : 'text-ink-faint'}`}
                style={{ fontSize: 8, maxWidth: inner, overflowWrap: 'break-word' }}
              >
                {entry.name}
              </span>
            )}
            {/* The circle's diameter comes from the value's share, its text
                width from the value's digit count — nothing ties the two
                together, so a small circle can easily hold a long number.
                ResponsiveAmount measures and shrinks to fit; it never cuts. */}
            <ResponsiveAmount
              value={entry.value}
              baseSize={Math.round(size * 0.16)}
              minSize={9}
              style={{ width: inner }}
              className="text-center leading-none"
              spanClassName={isAccent ? 'text-white' : 'text-ink'}
            />
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
