'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Plus, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-paper border-t-2 border-ink px-8 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-between items-center z-40 max-w-md mx-auto">
      <Link
        href="/"
        className={cn(
          'flex flex-col items-center gap-1 w-16 transition-colors',
          pathname === '/' ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
        )}
      >
        <Home className="h-5 w-5" strokeWidth={pathname === '/' ? 2.5 : 2} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">Home</span>
      </Link>

      <Link href="/add" className="-mt-8">
        <div className="w-14 h-14 bg-accent rounded-full text-white flex items-center justify-center active:scale-95 transition-transform border-4 border-paper">
          <Plus className="h-6 w-6" />
        </div>
      </Link>

      <Link
        href="/history"
        className={cn(
          'flex flex-col items-center gap-1 w-16 transition-colors',
          pathname === '/history' ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
        )}
      >
        <ListFilter className="h-5 w-5" strokeWidth={pathname === '/history' ? 2.5 : 2} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">History</span>
      </Link>
    </nav>
  );
}
