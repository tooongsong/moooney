'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AccountCircles } from '@/components/AccountCircles';

/** AccountCircles needs an onSelect callback, which a server component cannot
 *  hand it — this owns the navigation so the page can stay on the server. */
export function AccountCirclesClient({
  accounts,
  selected,
}: {
  accounts: { id: string; name: string; type: string; balance: number }[];
  selected: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('account', id);
    else params.delete('account');
    router.push(`/accounts?${params.toString()}`);
  }

  return <AccountCircles accounts={accounts} selected={selected} onSelect={select} />;
}
