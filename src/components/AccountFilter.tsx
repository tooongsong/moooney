'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

export function AccountFilter({ accounts }: { accounts: { name: string; value: number }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('account');

  function select(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('account', value);
    else params.delete('account');
    router.push(`?${params.toString()}`);
  }

  if (accounts.length === 0) return null;

  // Bar length is read directly, so it scales linearly — the square-root
  // correction circles need would understate the differences here.
  const max = Math.max(...accounts.map((a) => a.value), 1);

  return (
    <div className="flex flex-col gap-1.5">
      {accounts.map((a) => {
        const selected = current === a.name;
        return (
          <button
            key={a.name}
            type="button"
            aria-pressed={selected}
            onClick={() => select(selected ? null : a.name)}
            className="group flex items-center gap-2 text-left"
          >
            <span
              className="h-4 rounded-full shrink-0 transition-colors"
              style={{
                width: `${Math.max(8, (a.value / max) * 72)}px`,
                background: selected ? 'var(--accent)' : 'var(--ink)',
              }}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-widest truncate ${
                selected ? 'text-accent' : 'text-ink-soft group-hover:text-ink'
              }`}
            >
              {a.name}
            </span>
            <span className="text-[10px] font-semibold tabular-nums text-ink-faint shrink-0 ml-auto">
              {formatCurrency(a.value)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
