'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListFilter, Plus, Settings, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/',         icon: Home,       label: 'Home',     match: (p: string) => p === '/' },
  { href: '/accounts', icon: Wallet,     label: 'Accounts', match: (p: string) => p.startsWith('/accounts') },
  { href: '/history',  icon: ListFilter, label: 'History',  match: (p: string) => p.startsWith('/history') },
];

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="d-sidebar fixed inset-y-0 left-0 w-56 flex-col bg-paper border-r border-line z-40 px-5 py-8">
      {/* Wordmark */}
      <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-ink mb-8 px-2">
        Moooney
      </p>

      {/* Add button */}
      <Link
        href="/add"
        className="flex items-center gap-2 px-3 py-2.5 mb-6 rounded-xl bg-accent text-white text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        New
      </Link>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                active
                  ? 'bg-sand text-ink font-semibold'
                  : 'text-ink-faint hover:text-ink hover:bg-sand/60'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <Link
        href="/settings"
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
          pathname === '/settings'
            ? 'bg-sand text-ink font-semibold'
            : 'text-ink-faint hover:text-ink hover:bg-sand/60'
        )}
      >
        <Settings className="h-4 w-4 shrink-0" />
        Settings
      </Link>
    </aside>
  );
}
