import { formatCurrency } from '@/lib/utils';

// Theme-aware: reference the CSS custom properties directly so colors flip correctly in dark mode
// (a literal hex like #18181b would be invisible against a near-black dark background).
const COLORS = ['var(--accent)', 'var(--ink)', 'var(--ink-soft)', 'var(--ink-faint)', 'var(--line)', 'var(--sand)'];

interface CategoryBreakdownProps {
  data: { name: string; value: number }[];
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-faint border border-dashed border-line">No spending yet this month.</div>;
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const top = data.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Abstract graphic bar — proportional blocks, no traditional donut/pie */}
      <div className="flex h-10 w-full gap-0.5">
        {top.map((entry, index) => (
          <div
            key={entry.name}
            style={{ backgroundColor: COLORS[index % COLORS.length], width: `${Math.max((entry.value / total) * 100, 2)}%` }}
          />
        ))}
      </div>

      <div className="space-y-3">
        {top.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-3 text-sm">
            <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span className="text-ink-soft truncate flex-1 uppercase tracking-wide text-xs font-semibold">{entry.name}</span>
            <span className="text-ink font-bold tabular-nums shrink-0">{formatCurrency(entry.value)}</span>
            <span className="text-ink-faint text-xs w-9 text-right shrink-0 tabular-nums">
              {Math.round((entry.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
