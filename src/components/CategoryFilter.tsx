'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CategoryBlocks } from '@/components/CategoryBlocks';

/** Smaller than Overview's: this is a sidebar control, not the page's subject. */
const MAX_SIZE = 96;
const MIN_SIZE = 44;

export function CategoryFilter({ categories }: { categories: { name: string; value: number }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('category');

  function select(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('category', value);
    else params.delete('category');
    router.push(`?${params.toString()}`);
  }

  if (categories.length === 0) {
    return (
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
        No spending this period
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Wraps. The old strip was flex + overflow-x-auto + no-scrollbar inside a
          15rem column, so everything past the second pill was invisible and
          unreachable, with nothing on screen to say more existed. */}
      <CategoryBlocks
        data={categories}
        maxSize={MAX_SIZE}
        minSize={MIN_SIZE}
        selected={current}
        onSelect={select}
        labelOutside
      />
      {current && (
        <button
          type="button"
          onClick={() => select(null)}
          className="text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
        >
          Clear category
        </button>
      )}
    </div>
  );
}
