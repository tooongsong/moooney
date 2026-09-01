'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export function AccountFilter({ accounts }: { accounts: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('account') || 'all';

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('account');
    } else {
      params.set('account', value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6">
      <Pill active={current === 'all'} onClick={() => select('all')}>All accounts</Pill>
      {accounts.map((a) => (
        <Pill key={a} active={current === a} onClick={() => select(a)}>
          {a}
        </Pill>
      ))}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 h-8 px-4 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors',
        active ? 'bg-ink text-paper' : 'bg-sand text-ink-soft hover:bg-sand/70'
      )}
    >
      {children}
    </button>
  );
}
