'use client';

import { X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export function AccountFilterChip() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = searchParams.get('account');

  if (!account) return null;

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('account');
    router.push(`?${params.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={clear}
      className="inline-flex items-center gap-1.5 bg-sand text-ink-soft text-xs font-semibold uppercase tracking-widest px-3 py-1.5"
    >
      {account}
      <X className="h-3 w-3" />
    </button>
  );
}
