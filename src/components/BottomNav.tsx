'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Plus, ListFilter, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', icon: Home, label: 'Home', match: (p: string) => p === '/' },
  { href: '/accounts', icon: Wallet, label: 'Accounts', match: (p: string) => p.startsWith('/accounts') },
  { href: '/history', icon: ListFilter, label: 'History', match: (p: string) => p === '/history' },
];

export function BottomNav() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([null, null, null]);
  const barRef = useRef<HTMLSpanElement>(null);
  const initialized = useRef(false);

  const activeIdx = TABS.findIndex((t) => t.match(pathname));

  useEffect(() => {
    const el = tabRefs.current[activeIdx];
    const container = containerRef.current;
    const bar = barRef.current;
    if (!el || !container || !bar || activeIdx === -1) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const x = elRect.left - containerRect.left;
    const w = elRect.width;

    if (!initialized.current) {
      initialized.current = true;
      // Position without animating on first load, then fade in
      bar.style.transition = 'none';
      bar.style.left = `${x}px`;
      bar.style.width = `${w}px`;
      requestAnimationFrame(() => {
        bar.style.transition = '';
        bar.style.opacity = '1';
      });
    } else {
      bar.style.left = `${x}px`;
      bar.style.width = `${w}px`;
    }
  }, [pathname, activeIdx]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-[calc(1.5rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div
        ref={containerRef}
        className="relative flex items-center bg-ink rounded-full p-1.5 pointer-events-auto"
      >
        {/* Sliding active pill */}
        <span
          ref={barRef}
          aria-hidden
          className="absolute top-1.5 bottom-1.5 rounded-full bg-white/[0.12] opacity-0 [transition:left_220ms_cubic-bezier(.4,0,.2,1),width_220ms_cubic-bezier(.4,0,.2,1),opacity_150ms_ease-out]"
          style={{ left: 0, width: 56 }}
        />

        {TABS.slice(0, 2).map((tab, i) => (
          <Link
            key={tab.href}
            ref={(el) => { tabRefs.current[i] = el; }}
            href={tab.href}
            className={cn(
              'relative z-10 flex flex-col items-center gap-0.5 px-5 py-2 min-w-[4rem] transition-colors duration-150',
              tab.match(pathname) ? 'text-white' : 'text-white/40'
            )}
          >
            <tab.icon className="h-5 w-5" strokeWidth={tab.match(pathname) ? 2.5 : 2} />
            <span className="text-[9px] font-semibold uppercase tracking-widest">{tab.label}</span>
          </Link>
        ))}

        {/* Center add button */}
        <Link
          href="/add"
          className="relative z-10 mx-1 w-12 h-12 bg-accent rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0"
        >
          <Plus className="h-5 w-5 text-white" strokeWidth={2.5} />
        </Link>

        <Link
          ref={(el) => { tabRefs.current[2] = el; }}
          href="/history"
          className={cn(
            'relative z-10 flex flex-col items-center gap-0.5 px-5 py-2 min-w-[4rem] transition-colors duration-150',
            TABS[2].match(pathname) ? 'text-white' : 'text-white/40'
          )}
        >
          <ListFilter className="h-5 w-5" strokeWidth={TABS[2].match(pathname) ? 2.5 : 2} />
          <span className="text-[9px] font-semibold uppercase tracking-widest">History</span>
        </Link>
      </div>
    </div>
  );
}
