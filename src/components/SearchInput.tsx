'use client';

import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [text, setText] = useState(query);

  useEffect(() => {
    const handler = setTimeout(() => {
      const currentQ = searchParams.get('q') || '';
      if (currentQ === text) return;
      const params = new URLSearchParams(searchParams.toString());
      if (text) { params.set('q', text); } else { params.delete('q'); }
      router.replace(`?${params.toString()}`);
    }, 300);
    return () => clearTimeout(handler);
  }, [text, router, searchParams]);

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 pl-10 pr-4 bg-sand rounded-full text-sm text-ink placeholder:text-ink-faint outline-none focus:ring-2 focus:ring-ink/10 transition-shadow"
      />
    </div>
  );
}
