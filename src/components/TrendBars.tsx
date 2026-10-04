'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';

export interface TrendBarItem {
  key: string;
  value: number;
  href?: string;
}

interface TrendBarsProps {
  items: TrendBarItem[];
  labelEvery?: number;
  /** Desktop panels use a taller chart; the phone keeps 128. */
  height?: number;
}

export function TrendBars({ items, labelEvery = 1, height = 128 }: TrendBarsProps) {
  const router = useRouter();

  if (items.length === 0) return null;

  const max = Math.max(1, ...items.map((i) => i.value));
  const maxIndex = items.reduce((best, item, i) => (item.value > items[best].value ? i : best), 0);
  const hasSpend = items.some((i) => i.value > 0);
  const gapClass = items.length > 20 ? 'gap-0.5' : items.length > 6 ? 'gap-1.5' : 'gap-3';

  return (
    <div className={`flex items-end ${gapClass}`} style={{ height: height + 20 }}>
      {items.map((item, i) => {
        const heightPx = item.value > 0 ? Math.max(6, (item.value / max) * height) : 3;
        const isMax = hasSpend && i === maxIndex;
        const Tag = item.href ? 'button' : 'div';

        return (
          <Tag
            key={item.key}
            {...(item.href ? { type: 'button' as const, onClick: () => router.push(item.href!) } : {})}
            className="flex-1 flex flex-col items-center justify-end gap-1.5 active:scale-[0.97] transition-transform"
            style={{ height: height + 20 }}
          >
            <motion.div
              className="w-full rounded-t-full"
              style={{ background: isMax ? 'var(--accent)' : 'var(--ink)' }}
              initial={{ height: 0 }}
              animate={{ height: heightPx }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            />
            {i % labelEvery === 0 && (
              <span className="text-[8px] font-bold uppercase tracking-widest text-ink-faint shrink-0">
                {item.key}
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
