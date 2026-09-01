'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter, useSearchParams } from 'next/navigation';

export function AccountFilter({ accounts }: { accounts: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('account') || 'all';

  function handleValueChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('account');
    } else {
      params.set('account', value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full bg-paper-card border-line rounded-xl shadow-subtle text-ink focus:ring-ink-faint">
        <SelectValue placeholder="Account" />
      </SelectTrigger>
      <SelectContent className="rounded-xl border-line">
        <SelectItem value="all" className="text-ink-soft focus:bg-sand">
          All accounts
        </SelectItem>
        {accounts.map((a) => (
          <SelectItem key={a} value={a} className="text-ink-soft focus:bg-sand">
            {a}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
