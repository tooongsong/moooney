'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter, useSearchParams } from 'next/navigation';

export function CategoryFilter({ categories }: { categories: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('category') || 'all';

  function handleValueChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('category');
    } else {
      params.set('category', value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full bg-paper-card border-line rounded-xl shadow-subtle text-ink focus:ring-ink-faint">
        <SelectValue placeholder="Category" />
      </SelectTrigger>
      <SelectContent className="rounded-xl border-line">
        <SelectItem value="all" className="text-ink-soft focus:bg-sand">
          All categories
        </SelectItem>
        {categories.map((c) => (
          <SelectItem key={c} value={c} className="text-ink-soft focus:bg-sand">
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
