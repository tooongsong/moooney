'use client';

import { motion } from 'motion/react';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { accountCircles } from '@/lib/accountCircles';

const MAX_SIZE = 140;
const MIN_SIZE = 44;
const MIN_STEP = 8;
const ORGANIC_RADIUS = '48% 52% 50% 50% / 52% 48% 52% 48%';
/** A circle's inscribed square: text wider than this reaches past the curve. */
const INSCRIBED = 0.707;

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function AccountCircles({
  accounts,
  selected,
  onSelect,
}: {
  accounts: Account[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const circles = accountCircles(accounts, { min: MIN_SIZE, max: MAX_SIZE, minStep: MIN_STEP });
  const byName = new Map(accounts.map((a) => [a.name, a]));

  return (
    <div className="flex flex-wrap items-end gap-4">
      {circles.map((c, i) => {
        const account = byName.get(c.name)!;
        const isSelected = selected === account.id;
        const inner = Math.floor(c.size * INSCRIBED);

        return (
          <button
            key={account.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? null : account.id)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26, delay: i * 0.04 }}
              className="flex items-center justify-center text-center shrink-0"
              style={{
                width: c.size,
                height: c.size,
                borderRadius: isSelected ? ORGANIC_RADIUS : '9999px',
                // Owing is outlined, not filled: nothing is there to fill.
                background: c.owing ? 'transparent' : isSelected ? 'var(--accent)' : 'var(--sand)',
                border: c.owing
                  ? `2px solid ${isSelected ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 55%, transparent)'}`
                  : '1px solid color-mix(in srgb, var(--ink) 18%, transparent)',
                color: c.owing ? 'var(--accent)' : isSelected ? '#fff' : 'var(--ink)',
              }}
            >
              <ResponsiveAmount
                value={Math.abs(c.balance)}
                baseSize={Math.round(c.size * 0.15)}
                minSize={9}
                style={{ width: inner }}
                className="text-center leading-none"
                spanClassName="text-[currentColor]"
              />
            </motion.div>
            <span
              className={`text-[8px] font-bold uppercase tracking-widest text-center max-w-[7rem] ${
                isSelected ? 'text-accent' : 'text-ink-soft'
              }`}
            >
              {account.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
