import { formatCurrency } from '@/lib/utils';

interface CategoryBreakdownProps {
  data: { name: string; value: number }[];
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return (
      <p className="text-3xl font-bold tracking-tighter text-ink-faint leading-tight py-4">
        NO SPENDING<br />YET.
      </p>
    );
  }

  const top = data.slice(0, 5);
  const max = top[0].value;

  return (
    <div className="space-y-5">
      {top.map((entry, index) => (
        <div key={entry.name}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              {entry.name}
            </span>
            <span className="text-xl font-bold tabular-nums text-ink">
              {formatCurrency(entry.value)}
            </span>
          </div>
          <div className="h-2 bg-sand rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((entry.value / max) * 100, 2)}%`,
                backgroundColor: index === 0 ? 'var(--accent)' : 'var(--ink)',
                opacity: index === 0 ? 1 : Math.max(0.12, 0.55 - index * 0.1),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
